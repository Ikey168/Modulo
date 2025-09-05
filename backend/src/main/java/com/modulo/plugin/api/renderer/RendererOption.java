package com.modulo.plugin.api.renderer;

/**
 * Configuration option for a note renderer
 */
public class RendererOption {
    
    public enum OptionType {
        STRING,
        INTEGER,
        DOUBLE,
        BOOLEAN,
        SELECT,
        COLOR,
        FONT_SIZE,
        PERCENTAGE
    }
    
    private final String name;
    private final String displayName;
    private final String description;
    private final OptionType type;
    private final Object defaultValue;
    private final Object[] allowedValues;
    private final Object minValue;
    private final Object maxValue;
    private final boolean required;
    
    private RendererOption(Builder builder) {
        this.name = builder.name;
        this.displayName = builder.displayName;
        this.description = builder.description;
        this.type = builder.type;
        this.defaultValue = builder.defaultValue;
        this.allowedValues = builder.allowedValues;
        this.minValue = builder.minValue;
        this.maxValue = builder.maxValue;
        this.required = builder.required;
    }
    
    // Getters
    public String getName() { return name; }
    public String getDisplayName() { return displayName; }
    public String getDescription() { return description; }
    public OptionType getType() { return type; }
    public Object getDefaultValue() { return defaultValue; }
    public Object[] getAllowedValues() { return allowedValues; }
    public Object getMinValue() { return minValue; }
    public Object getMaxValue() { return maxValue; }
    public boolean isRequired() { return required; }
    
    /**
     * Validate a value for this option
     * @param value Value to validate
     * @return true if the value is valid
     */
    public boolean isValidValue(Object value) {
        if (value == null && required) {
            return false;
        }
        
        if (value == null) {
            return true;
        }
        
        // Type validation
        switch (type) {
            case STRING:
                if (!(value instanceof String)) return false;
                break;
            case INTEGER:
                if (!(value instanceof Integer)) return false;
                if (minValue != null && (Integer) value < (Integer) minValue) return false;
                if (maxValue != null && (Integer) value > (Integer) maxValue) return false;
                break;
            case DOUBLE:
                if (!(value instanceof Double)) return false;
                if (minValue != null && (Double) value < (Double) minValue) return false;
                if (maxValue != null && (Double) value > (Double) maxValue) return false;
                break;
            case BOOLEAN:
                if (!(value instanceof Boolean)) return false;
                break;
            case SELECT:
                if (allowedValues != null) {
                    for (Object allowed : allowedValues) {
                        if (allowed.equals(value)) return true;
                    }
                    return false;
                }
                break;
            case COLOR:
                if (!(value instanceof String)) return false;
                String colorStr = (String) value;
                // Basic hex color validation
                if (!colorStr.matches("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")) return false;
                break;
            case PERCENTAGE:
                if (!(value instanceof Double)) return false;
                Double pct = (Double) value;
                if (pct < 0.0 || pct > 100.0) return false;
                break;
        }
        
        return true;
    }
    
    /**
     * Builder for creating RendererOption instances
     */
    public static class Builder {
        private String name;
        private String displayName;
        private String description;
        private OptionType type;
        private Object defaultValue;
        private Object[] allowedValues;
        private Object minValue;
        private Object maxValue;
        private boolean required = false;
        
        public Builder(String name, OptionType type) {
            this.name = name;
            this.type = type;
            this.displayName = name;
        }
        
        public Builder displayName(String displayName) {
            this.displayName = displayName;
            return this;
        }
        
        public Builder description(String description) {
            this.description = description;
            return this;
        }
        
        public Builder defaultValue(Object defaultValue) {
            this.defaultValue = defaultValue;
            return this;
        }
        
        public Builder allowedValues(Object... allowedValues) {
            this.allowedValues = allowedValues;
            return this;
        }
        
        public Builder range(Object min, Object max) {
            this.minValue = min;
            this.maxValue = max;
            return this;
        }
        
        public Builder required(boolean required) {
            this.required = required;
            return this;
        }
        
        public RendererOption build() {
            return new RendererOption(this);
        }
    }
}
