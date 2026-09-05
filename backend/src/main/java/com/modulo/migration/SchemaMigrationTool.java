package com.modulo.migration;

import java.sql.DriverManager;
import javax.persistence.Entity;
import org.flywaydb.core.Flyway;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.tool.hbm2ddl.SchemaValidator;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

/** Offline administration entrypoint: never starts web endpoints or background jobs. */
public final class SchemaMigrationTool {
    private SchemaMigrationTool() { }

    public static Flyway flyway(String url, String user, String password) {
        return Flyway.configure().dataSource(url, user, password)
            .locations("classpath:db/postgresql").schemas("public", "application")
            .defaultSchema("public").table("modulo_schema_history")
            .baselineVersion("1").baselineOnMigrate(false).cleanDisabled(true).load();
    }

    public static void validateSchema(String url, String user, String password) throws Exception {
        var registry = new StandardServiceRegistryBuilder()
            .applySetting("hibernate.connection.url", url)
            .applySetting("hibernate.connection.username", user)
            .applySetting("hibernate.connection.password", password)
            .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQL10Dialect")
            .applySetting("hibernate.physical_naming_strategy", "org.springframework.boot.orm.jpa.hibernate.SpringPhysicalNamingStrategy")
            .applySetting("hibernate.implicit_naming_strategy", "org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy")
            .build();
        try {
            var sources = new MetadataSources(registry);
            var scanner = new ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
            for (var bean : scanner.findCandidateComponents("com.modulo")) {
                sources.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
            }
            new SchemaValidator().validate(sources.buildMetadata());
        } finally {
            StandardServiceRegistryBuilder.destroy(registry);
        }
        // Non-JPA tables are accessed by JdbcTemplate. Verify the baseline columns too.
        try (var connection = DriverManager.getConnection(url, user, password);
             var statement = connection.createStatement()) {
            for (String query : new String[] {
                "SELECT id,name,version,description,author,type,runtime,status,path,endpoint,config,config_schema,created_at,updated_at FROM plugin_registry LIMIT 0",
                "SELECT id,plugin_id,event_type,event_action,created_at FROM plugin_events LIMIT 0",
                "SELECT id,plugin_id,permission,granted,created_at FROM plugin_permissions LIMIT 0",
                "SELECT id,plugin_id,execution_type,status,message,execution_time_ms,created_at FROM plugin_execution_logs LIMIT 0",
                "SELECT id,plugin_id,status,message,response_time_ms,checked_at FROM plugin_health_checks LIMIT 0",
                "SELECT id,plugin_id,config_before,config_after,changed_by,change_reason,created_at FROM plugin_config_history LIMIT 0"
            }) {
                try (var result = statement.executeQuery(query)) { /* SQL compilation validates columns. */ }
            }
        }
    }

    /** Validate the immutable V1 contract before adopting, rather than requiring future migration columns. */
    static void validateBaseline(String url, String user, String password) throws Exception {
        String baseline;
        try (var stream = SchemaMigrationTool.class.getResourceAsStream("/db/postgresql/V1__Current_JPA_baseline.sql")) {
            if (stream == null) throw new IllegalStateException("Baseline resource missing");
            baseline = new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        var tables = java.util.regex.Pattern.compile("(?is)create\\s+table\\s+([a-z_][a-z_0-9.]*)\\s*\\((.*?)\\)\\s*;").matcher(baseline);
        try (var connection = DriverManager.getConnection(url, user, password)) {
            int count = 0;
            while (tables.find()) {
                count++;
                String[] qualified = tables.group(1).toLowerCase(java.util.Locale.ROOT).split("\\.");
                String schema = qualified.length == 2 ? qualified[0] : "public", table = qualified[qualified.length - 1];
                for (String line : tables.group(2).split("\\r?\\n")) {
                    var column = java.util.regex.Pattern.compile("(?i)^\\s*([a-z_][a-z_0-9]*)\\s+([a-z0-9]+)(?:\\((\\d+)(?:,\\d+)?\\))?").matcher(line);
                    if (!column.find() || java.util.Set.of("primary", "unique", "constraint", "foreign", "check").contains(column.group(1).toLowerCase(java.util.Locale.ROOT))) continue;
                    String expected = column.group(2).toLowerCase(java.util.Locale.ROOT);
                    expected = java.util.Map.of("bigint", "int8", "integer", "int4", "boolean", "bool", "smallint", "int2", "double", "float8", "bigserial", "int8", "serial", "int4").getOrDefault(expected, expected);
                    try (var statement = connection.prepareStatement("SELECT udt_name,character_maximum_length FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?")) {
                        statement.setString(1, schema); statement.setString(2, table); statement.setString(3, column.group(1).toLowerCase(java.util.Locale.ROOT));
                        try (var result = statement.executeQuery()) {
                            if (!result.next() || !(expected.equals(result.getString(1)) || (expected.equals("varchar") && result.getString(1).equals("text"))))
                                throw new IllegalStateException("Baseline column missing or incompatible: " + schema + "." + table + "." + column.group(1));
                            if (expected.equals("varchar") && column.group(3) != null && result.getObject(2) != null && result.getInt(2) < Integer.parseInt(column.group(3)))
                                throw new IllegalStateException("Baseline column is too short: " + table + "." + column.group(1));
                        }
                    }
                }
            }
            if (count == 0) throw new IllegalStateException("No baseline tables found");
        }
    }

    public static void adopt(String url, String user, String password) throws Exception {
        // Validate before writing any history: UUID-era or incomplete schemas fail closed.
        validateBaseline(url, user, password);
        flyway(url, user, password).baseline();
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !java.util.Set.of("adopt", "migrate", "validate").contains(args[0])) {
            throw new IllegalArgumentException("Usage: SchemaMigrationTool adopt|migrate|validate");
        }
        String url = required("SPRING_DATASOURCE_URL"), user = required("SPRING_DATASOURCE_USERNAME"), password = required("SPRING_DATASOURCE_PASSWORD");
        if (!url.startsWith("jdbc:postgresql:")) throw new IllegalArgumentException("PostgreSQL is required");
        if (args[0].equals("adopt")) adopt(url, user, password);
        else if (args[0].equals("migrate")) flyway(url, user, password).migrate();
        else { flyway(url, user, password).validate(); validateSchema(url, user, password); }
        System.out.println("Schema " + args[0] + " succeeded.");
    }
    private static String required(String key) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing " + key);
        return value;
    }
}
