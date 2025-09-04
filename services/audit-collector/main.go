package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// DecisionLog represents an OPA decision log entry with full audit context
type DecisionLog struct {
	DecisionID    string                 `json:"decision_id"`
	Timestamp     int64                  `json:"timestamp"`
	TraceID       string                 `json:"trace_id"`
	SpanID        string                 `json:"span_id"`
	RequestID     string                 `json:"request_id"`
	CorrelationID string                 `json:"correlation_id"`
	User          UserContext            `json:"user"`
	Request       RequestContext         `json:"request"`
	Decision      DecisionContext        `json:"decision"`
	Metadata      map[string]interface{} `json:"metadata"`
}

type UserContext struct {
	ID        string   `json:"id"`
	Username  string   `json:"username"`
	Email     string   `json:"email"`    // Pre-hashed for PII protection
	Tenant    string   `json:"tenant"`
	Roles     []string `json:"roles"`
	SessionID string   `json:"session_id"`
}

type RequestContext struct {
	Method       string `json:"method"`
	Path         string `json:"path"`
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Action       string `json:"action"`
	Workspace    string `json:"workspace"`
	SourceIP     string `json:"source_ip"`
}

type DecisionContext struct {
	Allow             bool    `json:"allow"`
	PolicyID          string  `json:"policy_id"`
	PolicyVersion     string  `json:"policy_version"`
	Rule              string  `json:"rule"`
	Reason            string  `json:"reason"`
	EvaluationTimeMS  float64 `json:"evaluation_time_ms"`
	TokenValid        bool    `json:"token_valid"`
}

// Prometheus metrics for monitoring
var (
	decisionCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_decisions_total",
			Help: "Total number of OPA authorization decisions processed",
		},
		[]string{"decision", "resource_type", "action", "policy_id", "tenant"},
	)

	decisionDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "opa_decision_duration_ms",
			Help:    "OPA decision evaluation time in milliseconds",
			Buckets: []float64{1, 2, 5, 10, 20, 50, 100, 200, 500},
		},
		[]string{"decision", "resource_type", "tenant"},
	)

	deniedRequestsCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "opa_denied_requests_total",
			Help: "Total number of denied authorization requests",
		},
		[]string{"resource_type", "action", "rule", "tenant", "reason_category"},
	)

	auditLogProcessed = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "audit_logs_processed_total",
			Help: "Total number of audit log entries processed",
		},
		[]string{"status", "destination"},
	)

	auditLogForwardingDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "audit_log_forwarding_duration_ms",
			Help: "Time taken to forward audit logs to storage",
		},
		[]string{"destination"},
	)
)

func init() {
	prometheus.MustRegister(decisionCounter)
	prometheus.MustRegister(decisionDuration)
	prometheus.MustRegister(deniedRequestsCounter)
	prometheus.MustRegister(auditLogProcessed)
	prometheus.MustRegister(auditLogForwardingDuration)
}

// AuditCollector handles audit log collection and forwarding
type AuditCollector struct {
	forwarders []LogForwarder
	config     *Config
}

// Config holds service configuration
type Config struct {
	LokiEndpoint     string
	ElasticEndpoint  string
	RetentionDays    int
	BatchSize        int
	AlertThresholds  AlertConfig
}

type AlertConfig struct {
	DenialRateThreshold    float64
	SuspiciousUserActions  int
	HighPrivilegeActions   []string
}

// LogForwarder interface for different log destinations
type LogForwarder interface {
	ForwardLog(ctx context.Context, log DecisionLog) error
	ForwardBatch(ctx context.Context, logs []DecisionLog) error
	GetName() string
}

// LokiForwarder sends logs to Grafana Loki
type LokiForwarder struct {
	endpoint string
	client   *http.Client
}

func (l *LokiForwarder) GetName() string {
	return "loki"
}

func (l *LokiForwarder) ForwardLog(ctx context.Context, log DecisionLog) error {
	return l.ForwardBatch(ctx, []DecisionLog{log})
}

func (l *LokiForwarder) ForwardBatch(ctx context.Context, logs []DecisionLog) error {
	start := time.Now()
	defer func() {
		duration := time.Since(start).Milliseconds()
		auditLogForwardingDuration.WithLabelValues("loki").Observe(float64(duration))
	}()

	// Group logs by labels for efficient Loki ingestion
	streams := make(map[string][]interface{})

	for _, log := range logs {
		// Create Loki labels
		labels := fmt.Sprintf(`{service="opa-audit",environment="production",decision="%t",resource_type="%s",action="%s",tenant="%s"}`,
			log.Decision.Allow, log.Request.ResourceType, log.Request.Action, log.User.Tenant)

		// Convert timestamp to nanoseconds string
		timestampNs := fmt.Sprintf("%d", log.Timestamp)

		// Create log line with structured JSON
		logLine, _ := json.Marshal(log)

		// Group by labels
		if streams[labels] == nil {
			streams[labels] = make([]interface{}, 0)
		}
		streams[labels] = append(streams[labels], []string{timestampNs, string(logLine)})
	}

	// Build Loki payload
	lokiPayload := map[string]interface{}{
		"streams": make([]interface{}, 0, len(streams)),
	}

	for labels, values := range streams {
		stream := map[string]interface{}{
			"stream": parseLabels(labels),
			"values": values,
		}
		lokiPayload["streams"] = append(lokiPayload["streams"].([]interface{}), stream)
	}

	// Send to Loki
	body, err := json.Marshal(lokiPayload)
	if err != nil {
		auditLogProcessed.WithLabelValues("error", "loki").Inc()
		return fmt.Errorf("failed to marshal Loki payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", l.endpoint+"/loki/api/v1/push", bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := l.client.Do(req)
	if err != nil {
		auditLogProcessed.WithLabelValues("error", "loki").Inc()
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		auditLogProcessed.WithLabelValues("error", "loki").Inc()
		return fmt.Errorf("Loki returned status %d", resp.StatusCode)
	}

	auditLogProcessed.WithLabelValues("success", "loki").Add(float64(len(logs)))
	return nil
}

// ElasticsearchForwarder sends logs to Elasticsearch
type ElasticsearchForwarder struct {
	endpoint string
	client   *http.Client
}

func (e *ElasticsearchForwarder) GetName() string {
	return "elasticsearch"
}

func (e *ElasticsearchForwarder) ForwardLog(ctx context.Context, log DecisionLog) error {
	return e.ForwardBatch(ctx, []DecisionLog{log})
}

func (e *ElasticsearchForwarder) ForwardBatch(ctx context.Context, logs []DecisionLog) error {
	start := time.Now()
	defer func() {
		duration := time.Since(start).Milliseconds()
		auditLogForwardingDuration.WithLabelValues("elasticsearch").Observe(float64(duration))
	}()

	// Create bulk request for Elasticsearch
	var bulkBody bytes.Buffer

	for _, log := range logs {
		// Index directive
		indexDate := time.Unix(log.Timestamp/1e9, 0).Format("2006.01.02")
		indexName := fmt.Sprintf("opa-audit-%s", indexDate)

		indexAction := map[string]interface{}{
			"index": map[string]interface{}{
				"_index": indexName,
				"_type":  "_doc",
				"_id":    log.DecisionID,
			},
		}

		actionLine, _ := json.Marshal(indexAction)
		bulkBody.Write(actionLine)
		bulkBody.WriteString("\n")

		// Document body
		docLine, _ := json.Marshal(log)
		bulkBody.Write(docLine)
		bulkBody.WriteString("\n")
	}

	req, err := http.NewRequestWithContext(ctx, "POST", e.endpoint+"/_bulk", &bulkBody)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := e.client.Do(req)
	if err != nil {
		auditLogProcessed.WithLabelValues("error", "elasticsearch").Inc()
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		auditLogProcessed.WithLabelValues("error", "elasticsearch").Inc()
		return fmt.Errorf("Elasticsearch returned status %d", resp.StatusCode)
	}

	auditLogProcessed.WithLabelValues("success", "elasticsearch").Add(float64(len(logs)))
	return nil
}

// NewAuditCollector creates a new audit collector with configured forwarders
func NewAuditCollector() *AuditCollector {
	config := &Config{
		LokiEndpoint:    getEnv("LOKI_ENDPOINT", "http://loki:3100"),
		ElasticEndpoint: getEnv("ELASTIC_ENDPOINT", "http://elasticsearch:9200"),
		RetentionDays:   getEnvInt("AUDIT_RETENTION_DAYS", 90),
		BatchSize:       getEnvInt("BATCH_SIZE", 100),
		AlertThresholds: AlertConfig{
			DenialRateThreshold:   getEnvFloat("DENIAL_RATE_THRESHOLD", 0.1),
			SuspiciousUserActions: getEnvInt("SUSPICIOUS_ACTIONS_THRESHOLD", 10),
			HighPrivilegeActions:  []string{"delete", "admin", "manage"},
		},
	}

	var forwarders []LogForwarder

	// Add Loki forwarder
	if config.LokiEndpoint != "" {
		forwarders = append(forwarders, &LokiForwarder{
			endpoint: config.LokiEndpoint,
			client: &http.Client{
				Timeout: 10 * time.Second,
			},
		})
	}

	// Add Elasticsearch forwarder
	if config.ElasticEndpoint != "" {
		forwarders = append(forwarders, &ElasticsearchForwarder{
			endpoint: config.ElasticEndpoint,
			client: &http.Client{
				Timeout: 10 * time.Second,
			},
		})
	}

	return &AuditCollector{
		forwarders: forwarders,
		config:     config,
	}
}

// HandleDecisionLog processes incoming OPA decision logs
func (ac *AuditCollector) HandleDecisionLog(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse decision logs from OPA
	var opaLogs []map[string]interface{}
	if err := c.ShouldBindJSON(&opaLogs); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	processedLogs := make([]DecisionLog, 0, len(opaLogs))

	for _, opaLog := range opaLogs {
		// Extract audit context from OPA decision log
		decisionLog, err := ac.extractDecisionLog(opaLog)
		if err != nil {
			log.Printf("Failed to extract decision log: %v", err)
			continue
		}

		// Validate and enrich log
		if err := ac.validateAndEnrichLog(&decisionLog); err != nil {
			log.Printf("Invalid decision log: %v", err)
			continue
		}

		processedLogs = append(processedLogs, decisionLog)

		// Record metrics
		ac.recordMetrics(decisionLog)

		// Check for alerts
		ac.checkForAlerts(decisionLog)
	}

	// Forward logs to all configured destinations
	for _, forwarder := range ac.forwarders {
		if err := forwarder.ForwardBatch(ctx, processedLogs); err != nil {
			log.Printf("Failed to forward logs to %s: %v", forwarder.GetName(), err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"processed": len(processedLogs),
		"total":     len(opaLogs),
	})
}

// extractDecisionLog extracts structured decision log from OPA log entry
func (ac *AuditCollector) extractDecisionLog(opaLog map[string]interface{}) (DecisionLog, error) {
	// Extract audit context from OPA result
	result, ok := opaLog["result"].(map[string]interface{})
	if !ok {
		return DecisionLog{}, fmt.Errorf("missing result in OPA log")
	}

	audit, ok := result["audit"].(map[string]interface{})
	if !ok {
		return DecisionLog{}, fmt.Errorf("missing audit context in OPA result")
	}

	// Parse timestamp
	timestamp, _ := audit["timestamp"].(float64)
	if timestamp == 0 {
		timestamp = float64(time.Now().UnixNano())
	}

	// Extract user context
	userMap, _ := audit["user"].(map[string]interface{})
	user := UserContext{
		ID:        getString(userMap, "id"),
		Username:  getString(userMap, "username"),
		Email:     getString(userMap, "email"),
		Tenant:    getString(userMap, "tenant"),
		Roles:     getStringSlice(userMap, "roles"),
		SessionID: getString(userMap, "session_id"),
	}

	// Extract request context
	requestMap, _ := audit["request"].(map[string]interface{})
	request := RequestContext{
		Method:       getString(requestMap, "method"),
		Path:         getString(requestMap, "path"),
		ResourceType: getString(requestMap, "resource_type"),
		ResourceID:   getString(requestMap, "resource_id"),
		Action:       getString(requestMap, "action"),
		Workspace:    getString(requestMap, "workspace"),
		SourceIP:     getString(requestMap, "source_ip"),
	}

	// Extract decision context
	decisionMap, _ := audit["decision"].(map[string]interface{})
	decision := DecisionContext{
		Allow:             getBool(decisionMap, "allow"),
		PolicyID:          getString(decisionMap, "policy_id"),
		PolicyVersion:     getString(decisionMap, "policy_version"),
		Rule:              getString(decisionMap, "rule"),
		Reason:            getString(decisionMap, "reason"),
		EvaluationTimeMS:  getFloat64(decisionMap, "evaluation_time_ms"),
		TokenValid:        getBool(decisionMap, "token_valid"),
	}

	// Extract metadata
	metadata, _ := audit["metadata"].(map[string]interface{})

	return DecisionLog{
		DecisionID:    getString(audit, "decision_id"),
		Timestamp:     int64(timestamp),
		TraceID:       getString(audit, "trace_id"),
		SpanID:        getString(audit, "span_id"),
		RequestID:     getString(audit, "request_id"),
		CorrelationID: getString(audit, "correlation_id"),
		User:          user,
		Request:       request,
		Decision:      decision,
		Metadata:      metadata,
	}, nil
}

// validateAndEnrichLog ensures log integrity and adds enrichment data
func (ac *AuditCollector) validateAndEnrichLog(log *DecisionLog) error {
	if log.DecisionID == "" {
		return fmt.Errorf("missing decision_id")
	}

	if log.User.ID == "" {
		return fmt.Errorf("missing user.id")
	}

	if log.Request.ResourceType == "" {
		return fmt.Errorf("missing request.resource_type")
	}

	// Ensure timestamp is valid
	if log.Timestamp == 0 {
		log.Timestamp = time.Now().UnixNano()
	}

	// Add enrichment data
	if log.Metadata == nil {
		log.Metadata = make(map[string]interface{})
	}
	log.Metadata["processed_at"] = time.Now().Unix()
	log.Metadata["collector_version"] = "1.0.0"

	return nil
}

// recordMetrics updates Prometheus metrics
func (ac *AuditCollector) recordMetrics(log DecisionLog) {
	decision := "allow"
	if !log.Decision.Allow {
		decision = "deny"
	}

	decisionCounter.WithLabelValues(
		decision,
		log.Request.ResourceType,
		log.Request.Action,
		log.Decision.PolicyID,
		log.User.Tenant,
	).Inc()

	decisionDuration.WithLabelValues(
		decision,
		log.Request.ResourceType,
		log.User.Tenant,
	).Observe(log.Decision.EvaluationTimeMS)

	if !log.Decision.Allow {
		reasonCategory := categorizeReason(log.Decision.Reason)
		deniedRequestsCounter.WithLabelValues(
			log.Request.ResourceType,
			log.Request.Action,
			log.Decision.Rule,
			log.User.Tenant,
			reasonCategory,
		).Inc()
	}
}

// checkForAlerts analyzes logs for suspicious patterns
func (ac *AuditCollector) checkForAlerts(log DecisionLog) {
	// Alert on denied high-privilege actions
	if !log.Decision.Allow {
		for _, action := range ac.config.AlertThresholds.HighPrivilegeActions {
			if log.Request.Action == action {
				log.Printf("ALERT: Denied high-privilege action %s by user %s on %s:%s",
					action, log.User.Username, log.Request.ResourceType, log.Request.ResourceID)
			}
		}

		// Alert on repeated denials (this would typically integrate with external alerting)
		log.Printf("AUDIT: Authorization denied - User: %s, Action: %s, Resource: %s:%s, Reason: %s",
			log.User.Username, log.Request.Action, log.Request.ResourceType, log.Request.ResourceID, log.Decision.Reason)
	}
}

// Health check endpoint
func (ac *AuditCollector) HealthCheck(c *gin.Context) {
	health := map[string]interface{}{
		"status":     "healthy",
		"timestamp":  time.Now().Unix(),
		"version":    "1.0.0",
		"forwarders": make([]map[string]interface{}, 0, len(ac.forwarders)),
	}

	for _, forwarder := range ac.forwarders {
		forwarderHealth := map[string]interface{}{
			"name":   forwarder.GetName(),
			"status": "healthy", // Could add actual health checks here
		}
		health["forwarders"] = append(health["forwarders"].([]map[string]interface{}), forwarderHealth)
	}

	c.JSON(http.StatusOK, health)
}

// Utility functions
func parseLabels(labelString string) map[string]string {
	// Simple label parser - in production use proper parser
	labels := make(map[string]string)
	// This is simplified - would need proper LogQL parser
	return labels
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func getFloat64(m map[string]interface{}, key string) float64 {
	if v, ok := m[key].(float64); ok {
		return v
	}
	return 0
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if v, ok := m[key].([]interface{}); ok {
		result := make([]string, len(v))
		for i, item := range v {
			if s, ok := item.(string); ok {
				result[i] = s
			}
		}
		return result
	}
	return []string{}
}

func categorizeReason(reason string) string {
	reason = strings.ToLower(reason)
	if strings.Contains(reason, "insufficient") || strings.Contains(reason, "cannot") {
		return "insufficient_privileges"
	} else if strings.Contains(reason, "expired") || strings.Contains(reason, "invalid") {
		return "invalid_token"
	} else if strings.Contains(reason, "unknown") {
		return "unknown_resource"
	}
	return "other"
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if f, err := strconv.ParseFloat(value, 64); err == nil {
			return f
		}
	}
	return defaultValue
}

func main() {
	// Initialize Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// Create audit collector
	collector := NewAuditCollector()

	// API routes
	v1 := router.Group("/v1")
	{
		v1.POST("/decisions", collector.HandleDecisionLog)
		v1.GET("/health", collector.HealthCheck)
	}

	// Metrics endpoint for Prometheus
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Start server
	port := getEnv("PORT", "8080")
	log.Printf("Starting audit collector on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
