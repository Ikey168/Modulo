{{- define "modulo-plugin.name" -}}
modulo-plugin-{{ .Values.pluginName }}
{{- end }}

{{- define "modulo-plugin.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "modulo-plugin.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
modulo.plugin/name: {{ .Values.pluginName }}
modulo.plugin/tier: external
{{- end }}

{{- define "modulo-plugin.selectorLabels" -}}
app.kubernetes.io/name: {{ include "modulo-plugin.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
