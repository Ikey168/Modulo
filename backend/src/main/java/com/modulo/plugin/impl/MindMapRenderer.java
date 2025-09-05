package com.modulo.plugin.impl;

import com.modulo.plugin.api.renderer.NoteRenderer;
import com.modulo.plugin.api.renderer.RendererOutput;
import com.modulo.plugin.api.renderer.RendererOption;
import com.modulo.plugin.api.renderer.RendererEventResponse;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

/**
 * Mind Map renderer for converting markdown notes to interactive mind maps
 */
@Component
public class MindMapRenderer implements NoteRenderer {
    
    private static final Logger logger = LoggerFactory.getLogger(MindMapRenderer.class);
    
    private static final String RENDERER_ID = "mindmap";
    private static final String RENDERER_NAME = "Mind Map Renderer";
    private static final String RENDERER_VERSION = "1.0.0";
    private static final String RENDERER_DESCRIPTION = "Converts markdown notes with hierarchical structure to interactive mind maps";
    
    // Markdown heading pattern
    private static final Pattern HEADING_PATTERN = Pattern.compile("^(#{1,6})\\s+(.+)$", Pattern.MULTILINE);
    
    @Override
    public String getRendererId() {
        return RENDERER_ID;
    }
    
    @Override
    public String getName() {
        return RENDERER_NAME;
    }
    
    @Override
    public String getVersion() {
        return RENDERER_VERSION;
    }
    
    @Override
    public String getDescription() {
        return RENDERER_DESCRIPTION;
    }
    
    @Override
    public List<String> getSupportedNoteTypes() {
        return Arrays.asList("markdown", "md", "text");
    }
    
    @Override
    public boolean canRender(String content, String noteType) {
        if (content == null || content.trim().isEmpty()) {
            return false;
        }
        
        // Check if note type is supported
        if (!getSupportedNoteTypes().contains(noteType.toLowerCase())) {
            return false;
        }
        
        // Check if content has hierarchical structure (headings)
        return HEADING_PATTERN.matcher(content).find();
    }
    
    @Override
    public RendererOutput render(String content, String noteType, Map<String, Object> options) {
        try {
            // Parse options
            String theme = getStringOption(options, "theme", "default");
            String layout = getStringOption(options, "layout", "radial");
            Boolean showConnectors = getBooleanOption(options, "showConnectors", true);
            String nodeColor = getStringOption(options, "nodeColor", "#4CAF50");
            Integer fontSize = getIntegerOption(options, "fontSize", 14);
            
            // Parse markdown content into mind map structure
            MindMapNode root = parseMarkdownToMindMap(content);
            
            // Generate mind map HTML/JavaScript
            String mindMapHtml = generateMindMapHtml(root, theme, layout, showConnectors, nodeColor, fontSize);
            
            // Create metadata
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("nodeCount", countNodes(root));
            metadata.put("maxDepth", getMaxDepth(root, 0));
            metadata.put("theme", theme);
            metadata.put("layout", layout);
            metadata.put("interactive", true);
            
            return new RendererOutput(mindMapHtml, "text/html", metadata, true);
            
        } catch (Exception e) {
            logger.error("Failed to render mind map: {}", e.getMessage(), e);
            return new RendererOutput(
                "<div class=\"error\">Failed to render mind map: " + e.getMessage() + "</div>",
                "text/html",
                Collections.singletonMap("error", true),
                false
            );
        }
    }
    
    @Override
    public List<RendererOption> getAvailableOptions() {
        return Arrays.asList(
            new RendererOption.Builder("theme", RendererOption.OptionType.SELECT)
                .displayName("Theme")
                .description("Visual theme for the mind map")
                .defaultValue("default")
                .allowedValues("default", "dark", "colorful", "minimal")
                .build(),
                
            new RendererOption.Builder("layout", RendererOption.OptionType.SELECT)
                .displayName("Layout")
                .description("Layout algorithm for node positioning")
                .defaultValue("radial")
                .allowedValues("radial", "tree", "force", "hierarchical")
                .build(),
                
            new RendererOption.Builder("showConnectors", RendererOption.OptionType.BOOLEAN)
                .displayName("Show Connectors")
                .description("Display connecting lines between nodes")
                .defaultValue(true)
                .build(),
                
            new RendererOption.Builder("nodeColor", RendererOption.OptionType.COLOR)
                .displayName("Node Color")
                .description("Default color for mind map nodes")
                .defaultValue("#4CAF50")
                .build(),
                
            new RendererOption.Builder("fontSize", RendererOption.OptionType.INTEGER)
                .displayName("Font Size")
                .description("Font size for node text")
                .defaultValue(14)
                .range(10, 24)
                .build()
        );
    }
    
    @Override
    public RendererEventResponse handleEvent(String eventType, Map<String, Object> eventData, Map<String, Object> context) {
        switch (eventType) {
            case "node-click":
                return handleNodeClick(eventData, context);
            case "node-expand":
                return handleNodeExpand(eventData, context);
            case "node-collapse":
                return handleNodeCollapse(eventData, context);
            case "export":
                return handleExport(eventData, context);
            default:
                return RendererEventResponse.none();
        }
    }
    
    @Override
    public void initialize() {
        logger.info("Mind Map Renderer initialized");
    }
    
    @Override
    public void shutdown() {
        logger.info("Mind Map Renderer shut down");
    }
    
    // Helper classes and methods
    private static class MindMapNode {
        String text;
        int level;
        List<MindMapNode> children = new ArrayList<>();
        String id;
        
        MindMapNode(String text, int level) {
            this.text = text;
            this.level = level;
            this.id = "node-" + UUID.randomUUID().toString().substring(0, 8);
        }
    }
    
    private MindMapNode parseMarkdownToMindMap(String content) {
        MindMapNode root = new MindMapNode("Root", 0);
        Stack<MindMapNode> stack = new Stack<>();
        stack.push(root);
        
        Matcher matcher = HEADING_PATTERN.matcher(content);
        
        while (matcher.find()) {
            int level = matcher.group(1).length();
            String text = matcher.group(2).trim();
            
            MindMapNode node = new MindMapNode(text, level);
            
            // Find the appropriate parent
            while (stack.size() > 1 && stack.peek().level >= level) {
                stack.pop();
            }
            
            stack.peek().children.add(node);
            stack.push(node);
        }
        
        return root;
    }
    
    private String generateMindMapHtml(MindMapNode root, String theme, String layout, 
                                     Boolean showConnectors, String nodeColor, Integer fontSize) {
        StringBuilder html = new StringBuilder();
        
        html.append("<!DOCTYPE html>\n");
        html.append("<html>\n<head>\n");
        html.append("<meta charset=\"UTF-8\">\n");
        html.append("<title>Mind Map</title>\n");
        html.append("<style>\n");
        html.append(generateMindMapCSS(theme, nodeColor, fontSize));
        html.append("</style>\n");
        html.append("<script src=\"https://d3js.org/d3.v7.min.js\"></script>\n");
        html.append("</head>\n<body>\n");
        html.append("<div id=\"mindmap-container\">\n");
        html.append("  <div id=\"mindmap\"></div>\n");
        html.append("</div>\n");
        html.append("<script>\n");
        html.append(generateMindMapJavaScript(root, layout, showConnectors));
        html.append("</script>\n");
        html.append("</body>\n</html>");
        
        return html.toString();
    }
    
    private String generateMindMapCSS(String theme, String nodeColor, Integer fontSize) {
        return String.format("""
            #mindmap-container {
                width: 100%%;
                height: 600px;
                border: 1px solid #ddd;
                background: %s;
                overflow: hidden;
            }
            
            .node {
                fill: %s;
                stroke: #fff;
                stroke-width: 2px;
                cursor: pointer;
            }
            
            .node:hover {
                fill: %s;
            }
            
            .node-text {
                fill: %s;
                font-size: %dpx;
                font-family: Arial, sans-serif;
                text-anchor: middle;
                pointer-events: none;
            }
            
            .link {
                fill: none;
                stroke: %s;
                stroke-width: 2px;
            }
            
            .tooltip {
                position: absolute;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                pointer-events: none;
                z-index: 1000;
            }
            """,
            theme.equals("dark") ? "#2b2b2b" : "#ffffff",
            nodeColor,
            adjustBrightness(nodeColor, -20),
            theme.equals("dark") ? "#ffffff" : "#000000",
            fontSize,
            theme.equals("dark") ? "#555555" : "#cccccc"
        );
    }
    
    private String generateMindMapJavaScript(MindMapNode root, String layout, Boolean showConnectors) {
        StringBuilder js = new StringBuilder();
        
        js.append("const data = ").append(nodeToJSON(root)).append(";\n");
        js.append("""
            const width = document.getElementById('mindmap-container').clientWidth;
            const height = document.getElementById('mindmap-container').clientHeight;
            
            const svg = d3.select('#mindmap')
                .append('svg')
                .attr('width', width)
                .attr('height', height);
            
            const g = svg.append('g');
            
            // Create zoom behavior
            const zoom = d3.zoom()
                .scaleExtent([0.1, 3])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });
            
            svg.call(zoom);
            
            function renderMindMap(data) {
                const root = d3.hierarchy(data);
                
                const tree = d3.tree()
                    .size([height - 100, width - 200])
                    .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);
                
                tree(root);
                
                // Adjust positions to center the tree
                root.descendants().forEach(d => {
                    d.y += 100;
                    d.x += 50;
                });
            """);
        
        if (showConnectors) {
            js.append("""
                // Create links
                const links = g.selectAll('.link')
                    .data(root.links())
                    .enter().append('path')
                    .attr('class', 'link')
                    .attr('d', d3.linkHorizontal()
                        .x(d => d.y)
                        .y(d => d.x));
                """);
        }
        
        js.append("""
                // Create nodes
                const nodes = g.selectAll('.node-group')
                    .data(root.descendants())
                    .enter().append('g')
                    .attr('class', 'node-group')
                    .attr('transform', d => `translate(${d.y}, ${d.x})`)
                    .on('click', handleNodeClick);
                
                nodes.append('circle')
                    .attr('class', 'node')
                    .attr('r', d => d.children ? 8 : 6);
                
                nodes.append('text')
                    .attr('class', 'node-text')
                    .attr('dy', d => d.children ? -15 : 4)
                    .text(d => d.data.text);
            }
            
            function handleNodeClick(event, d) {
                // Dispatch custom event to parent application
                const customEvent = new CustomEvent('mindmap-node-click', {
                    detail: {
                        nodeId: d.data.id,
                        nodeText: d.data.text,
                        level: d.data.level
                    }
                });
                window.dispatchEvent(customEvent);
            }
            
            // Initialize the mind map
            renderMindMap(data);
            
            // Center the view
            const bbox = g.node().getBBox();
            const scale = 0.8 / Math.max(bbox.width / width, bbox.height / height);
            const translate = [width / 2 - scale * bbox.width / 2, height / 2 - scale * bbox.height / 2];
            
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
            """);
        
        return js.toString();
    }
    
    private String nodeToJSON(MindMapNode node) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"id\":\"").append(node.id).append("\",");
        json.append("\"text\":\"").append(node.text.replace("\"", "\\\"")).append("\",");
        json.append("\"level\":").append(node.level);
        
        if (!node.children.isEmpty()) {
            json.append(",\"children\":[");
            for (int i = 0; i < node.children.size(); i++) {
                if (i > 0) json.append(",");
                json.append(nodeToJSON(node.children.get(i)));
            }
            json.append("]");
        }
        
        json.append("}");
        return json.toString();
    }
    
    // Event handlers
    private RendererEventResponse handleNodeClick(Map<String, Object> eventData, Map<String, Object> context) {
        String nodeId = (String) eventData.get("nodeId");
        String nodeText = (String) eventData.get("nodeText");
        
        return new RendererEventResponse.Builder(RendererEventResponse.ResponseType.MESSAGE)
            .message("Clicked node: " + nodeText)
            .data("nodeId", nodeId)
            .data("action", "node-selected")
            .build();
    }
    
    private RendererEventResponse handleNodeExpand(Map<String, Object> eventData, Map<String, Object> context) {
        return RendererEventResponse.refreshView();
    }
    
    private RendererEventResponse handleNodeCollapse(Map<String, Object> eventData, Map<String, Object> context) {
        return RendererEventResponse.refreshView();
    }
    
    private RendererEventResponse handleExport(Map<String, Object> eventData, Map<String, Object> context) {
        String format = (String) eventData.getOrDefault("format", "png");
        return RendererEventResponse.message("Export to " + format + " not yet implemented");
    }
    
    // Utility methods
    private String getStringOption(Map<String, Object> options, String key, String defaultValue) {
        Object value = options.get(key);
        return value instanceof String ? (String) value : defaultValue;
    }
    
    private Boolean getBooleanOption(Map<String, Object> options, String key, Boolean defaultValue) {
        Object value = options.get(key);
        return value instanceof Boolean ? (Boolean) value : defaultValue;
    }
    
    private Integer getIntegerOption(Map<String, Object> options, String key, Integer defaultValue) {
        Object value = options.get(key);
        return value instanceof Integer ? (Integer) value : defaultValue;
    }
    
    private int countNodes(MindMapNode node) {
        int count = 1;
        for (MindMapNode child : node.children) {
            count += countNodes(child);
        }
        return count;
    }
    
    private int getMaxDepth(MindMapNode node, int currentDepth) {
        int maxDepth = currentDepth;
        for (MindMapNode child : node.children) {
            maxDepth = Math.max(maxDepth, getMaxDepth(child, currentDepth + 1));
        }
        return maxDepth;
    }
    
    private String adjustBrightness(String hexColor, int adjustment) {
        // Simple brightness adjustment - in a real implementation, you'd use proper color manipulation
        return hexColor; // Placeholder
    }
}
