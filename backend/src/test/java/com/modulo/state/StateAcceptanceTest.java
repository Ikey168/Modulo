package com.modulo.state;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.security.AuthenticatedUserService;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.*;
import java.net.*;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.server.LocalServerPort;
import org.springframework.context.annotation.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.MountableFile;

@Testcontainers
@SpringBootTest(
    classes = StateAcceptanceTest.Config.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "spring.sql.init.mode=never",
      "spring.flyway.enabled=false",
      "server.servlet.context-path=",
      "spring.main.allow-bean-definition-overriding=true",
      "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration,org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration,org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration,org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration,org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration"
    })
class StateAcceptanceTest {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  static final String ISSUER = "https://state-fixture.invalid";
  static final byte[] KEY =
      "state-acceptance-only-key-32-bytes-long".getBytes(java.nio.charset.StandardCharsets.UTF_8);

  @Configuration
  @EnableAutoConfiguration
  @EnableWebSecurity
  @Import(PluginStateController.class)
  static class Config {
    @Bean
    DriverManagerDataSource source() {
      return new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    }

    @Bean
    JdbcTemplate jdbc(DriverManagerDataSource source) throws Exception {
      try (var connection = source.getConnection()) {
        connection.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
        for (String file :
            List.of(
                "V3__Versioned_plugin_state.sql",
                "V5__Plugin_state_grants_and_delivery.sql",
                "V6__State_storage_generation.sql"))
          ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/postgresql/" + file));
      }
      return new JdbcTemplate(source);
    }

    @Bean
    AuthenticatedUserService users() {
      var repository = mock(UserRepository.class);
      for (long id : List.of(1L, 2L)) {
        var user = new User();
        user.setId(id);
        when(repository.findByKeycloakSubject("owner-" + id)).thenReturn(Optional.of(user));
      }
      return new AuthenticatedUserService(repository, ISSUER);
    }

    @Bean
    PluginStateStore store(
        JdbcTemplate jdbc, DriverManagerDataSource source, AuthenticatedUserService users) {
      return new PluginStateStore(
          jdbc, new DataSourceTransactionManager(source), users, new ObjectMapper());
    }

    @Bean
    JwtDecoder decoder() {
      var decoder = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(KEY, "HmacSHA256")).build();
      decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
      return decoder;
    }

    @Bean
    SecurityFilterChain chain(HttpSecurity http) throws Exception {
      http.csrf()
          .disable()
          .authorizeRequests()
          .anyRequest()
          .authenticated()
          .and()
          .oauth2ResourceServer()
          .jwt();
      return http.build();
    }
  }

  @LocalServerPort int port;
  @Autowired JdbcTemplate jdbc;
  @Autowired DriverManagerDataSource source;
  final ObjectMapper json = new ObjectMapper();
  final HttpClient first = HttpClient.newHttpClient(), second = HttpClient.newHttpClient();

  @BeforeEach
  void fixture() {
    source.setUrl(source.getUrl().replace("/restored_state", "/" + DB.getDatabaseName()));
    jdbc.execute("TRUNCATE users CASCADE");
    jdbc.update("INSERT INTO users VALUES (1),(2)");
    for (long owner : List.of(1L, 2L))
      for (int version : List.of(1, 2))
        jdbc.update(
            "INSERT INTO"
                + " plugin_state_schemas(owner_id,namespace,schema_id,schema_version,definition)"
                + " VALUES (?,'acceptance','fixture',?,CAST(? AS jsonb))",
            owner,
            version,
            "{\"type\":\"object\"}");
  }

  String token(long owner, boolean expired) throws Exception {
    var claims =
        new JWTClaimsSet.Builder()
            .issuer(ISSUER)
            .subject("owner-" + owner)
            .expirationTime(Date.from(Instant.now().plusSeconds(expired ? -180 : 300)))
            .build();
    var jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
    jwt.sign(new MACSigner(KEY));
    return jwt.serialize();
  }

  HttpResponse<String> request(
      HttpClient client, long owner, String method, String suffix, String body, String generation)
      throws Exception {
    return requestToken(client, token(owner, false), method, suffix, body, generation);
  }

  HttpResponse<String> requestToken(
      HttpClient client, String token, String method, String suffix, String body, String generation)
      throws Exception {
    var builder =
        HttpRequest.newBuilder(
                URI.create(
                    "http://localhost:"
                        + port
                        + "/api/workspaces/personal/plugin-state/acceptance"
                        + suffix))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(10));
    if (generation != null) builder.header("X-Modulo-State-Generation", generation);
    return client.send(
        builder
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build(),
        HttpResponse.BodyHandlers.ofString());
  }

  String generation() throws Exception {
    var response = request(first, 1, "GET", "?generation", null, null);
    assertEquals(200, response.statusCode(), response.body());
    return json.readTree(response.body()).get("generation").asText();
  }

  String write(long version, String text) {
    return "{\"expectedVersion\":"
        + version
        + ",\"schemaId\":\"fixture\",\"schemaVersion\":2,\"value\":{\"text\":\""
        + text
        + "\"}}";
  }

  @Test
  void twoClientsEnforceTenantsExpiryStaleReplayAndGeneration() throws Exception {
    String epoch = generation();
    assertEquals(200, request(first, 1, "PUT", "/shared", write(0, "private"), epoch).statusCode());
    assertEquals(409, request(second, 1, "PUT", "/shared", write(0, "stale"), epoch).statusCode());
    assertEquals(404, request(second, 2, "GET", "/shared", null, null).statusCode());
    assertEquals(
        409, request(second, 2, "PUT", "/shared", write(1, "foreign"), epoch).statusCode());
    assertEquals(
        "[]",
        json.readTree(request(second, 2, "GET", "", null, null).body()).get("records").toString());
    assertEquals(
        401, requestToken(second, token(1, true), "GET", "/shared", null, null).statusCode());
    assertEquals(
        428, request(first, 1, "PUT", "/new", write(0, "missing-generation"), null).statusCode());
    jdbc.update("UPDATE plugin_state_storage SET generation=gen_random_uuid()");
    var rejected = request(first, 1, "PUT", "/shared", write(1, "old-history"), epoch);
    assertEquals(412, rejected.statusCode());
    assertEquals(
        "STATE_STORAGE_GENERATION_CHANGED", json.readTree(rejected.body()).get("code").asText());
    assertEquals(
        "private",
        json.readTree(request(first, 1, "GET", "/shared", null, null).body())
            .path("value")
            .path("text")
            .asText());
  }

  @Test
  void realBackupRestorePreservesSchemasTombstonesAndOwnerDataButRotatesAuthority()
      throws Exception {
    String epoch = generation();
    assertEquals(200, request(first, 1, "PUT", "/live", write(0, "backup"), epoch).statusCode());
    assertEquals(200, request(first, 1, "PUT", "/deleted", write(0, "gone"), epoch).statusCode());
    assertEquals(
        200, request(first, 1, "DELETE", "/deleted?expectedVersion=1", null, epoch).statusCode());
    assertEquals(200, request(second, 2, "PUT", "/live", write(0, "bob"), epoch).statusCode());
    jdbc.update(
        "INSERT INTO"
            + " plugin_state_grants(token_hash,owner_id,workspace_id,namespace,plugin_id,can_read,can_write,expires_at)"
            + " VALUES (?,1,'personal','acceptance','acceptance',TRUE,TRUE,CURRENT_TIMESTAMP +"
            + " interval '1 hour')",
        "a".repeat(64));
    Path script = Path.of("scripts/state-backup.sh");
    if (!Files.exists(script)) script = Path.of("../scripts/state-backup.sh");
    DB.copyFileToContainer(
        MountableFile.forHostPath(script.toAbsolutePath(), 0755), "/tmp/state-backup.sh");
    exec(
        "env",
        "PGDATABASE=" + DB.getDatabaseName(),
        "PGUSER=" + DB.getUsername(),
        "/tmp/state-backup.sh",
        "backup",
        "/tmp/state.dump");
    exec("createdb", "-U", DB.getUsername(), "restored_state");
    exec(
        "env",
        "PGDATABASE=restored_state",
        "PGUSER=" + DB.getUsername(),
        "/tmp/state-backup.sh",
        "restore",
        "/tmp/state.dump");
    source.setUrl(DB.getJdbcUrl().replace("/" + DB.getDatabaseName(), "/restored_state"));
    DB.getDockerClient().restartContainerCmd(DB.getContainerId()).exec();
    var inspected = DB.getDockerClient().inspectContainerCmd(DB.getContainerId()).exec();
    String mappedPort =
        inspected
            .getNetworkSettings()
            .getPorts()
            .getBindings()
            .get(new com.github.dockerjava.api.model.ExposedPort(5432))[0]
            .getHostPortSpec();
    source.setUrl("jdbc:postgresql://" + DB.getHost() + ":" + mappedPort + "/restored_state");
    boolean available = false;
    String lastFailure = "";
    for (int attempt = 0; attempt < 300; attempt++) {
      try (var connection = source.getConnection()) {
        available = connection.isValid(1);
        if (available) break;
      } catch (java.sql.SQLException restarting) {
        lastFailure = restarting.getMessage();
        Thread.sleep(100);
      }
    }
    assertTrue(available, "Restored database did not restart: " + lastFailure);
    assertNotEquals(epoch, generation());
    assertEquals(
        0L,
        jdbc.queryForObject(
            "SELECT count(*) FROM plugin_state_grants WHERE NOT revoked", Long.class));
    assertEquals(
        0L,
        jdbc.queryForObject(
            "SELECT count(*) FROM plugin_state_events WHERE delivered_at IS NULL", Long.class));
    assertEquals(
        "backup",
        json.readTree(request(first, 1, "GET", "/live", null, null).body())
            .path("value")
            .path("text")
            .asText());
    assertEquals(
        "bob",
        json.readTree(request(second, 2, "GET", "/live", null, null).body())
            .path("value")
            .path("text")
            .asText());
    assertEquals(
        2L,
        jdbc.queryForObject(
            "SELECT version FROM plugin_state WHERE owner_id=1 AND state_key='deleted' AND deleted",
            Long.class));
    assertEquals(4L, jdbc.queryForObject("SELECT count(*) FROM plugin_state_schemas", Long.class));
    assertEquals(
        2,
        json.readTree(request(first, 1, "GET", "/live", null, null).body())
            .get("schemaVersion")
            .asInt());
    assertEquals(
        412,
        request(first, 1, "PUT", "/live", write(1, "queued-after-backup"), epoch).statusCode());
  }

  void exec(String... command) throws Exception {
    var result = DB.execInContainer(command);
    assertEquals(0, result.getExitCode(), result.getStderr());
  }
}
