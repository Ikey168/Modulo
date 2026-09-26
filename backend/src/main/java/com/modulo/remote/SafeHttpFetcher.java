package com.modulo.remote;

import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import org.apache.http.Header;
import org.apache.http.HttpEntity;
import org.apache.http.HttpResponse;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.client.methods.HttpRequestBase;
import org.apache.http.conn.DnsResolver;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.entity.ContentType;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.apache.http.impl.conn.SystemDefaultDnsResolver;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Outbound HTTP for server-side replacements of desktop services (#495).
 *
 * The URLs come from users, so every request is treated as a server-side
 * request forgery attempt until proven otherwise:
 * <ul>
 *   <li>only http/https on ports 80, 443, 8080 and 8443, without userinfo;</li>
 *   <li>every connection, including each redirect hop, resolves through a DNS
 *       resolver that refuses loopback, private, link-local, carrier-grade NAT,
 *       unique-local, multicast and unspecified addresses, so DNS rebinding
 *       cannot reach the internal network between the check and the connect;</li>
 *   <li>no system proxy (a proxy would resolve names itself), bounded
 *       redirects, timeouts and response size.</li>
 * </ul>
 */
public class SafeHttpFetcher implements AutoCloseable {
  public static final int MAX_BYTES = 5 * 1024 * 1024;
  private static final Set<Integer> PORTS = Set.of(80, 443, 8080, 8443);
  private static final int TIMEOUT_MS = 10_000;

  public record Response(int status, String contentType, byte[] body, URI finalUri) {
    public String text() {
      Charset charset = StandardCharsets.UTF_8;
      try {
        ContentType type = ContentType.parse(contentType == null ? "text/plain" : contentType);
        if (type.getCharset() != null) charset = type.getCharset();
      } catch (RuntimeException ignored) {
        // Unparseable content types fall back to UTF-8.
      }
      return new String(body, charset);
    }
  }

  private final CloseableHttpClient client;
  private final boolean allowPrivateNetworks;

  public SafeHttpFetcher() {
    this(false);
  }

  /** {@code allowPrivateNetworks} exists for tests against a local stub server only. */
  SafeHttpFetcher(boolean allowPrivateNetworks) {
    this.allowPrivateNetworks = allowPrivateNetworks;
    DnsResolver resolver =
        host -> {
          InetAddress[] addresses = SystemDefaultDnsResolver.INSTANCE.resolve(host);
          if (!allowPrivateNetworks) {
            for (InetAddress address : addresses) {
              if (!isPublic(address)) {
                throw new UnknownHostException("Refusing non-public address for " + host);
              }
            }
          }
          return addresses;
        };
    PoolingHttpClientConnectionManager connections = new PoolingHttpClientConnectionManager(
        org.apache.http.config.RegistryBuilder.<org.apache.http.conn.socket.ConnectionSocketFactory>create()
            .register("http", org.apache.http.conn.socket.PlainConnectionSocketFactory.getSocketFactory())
            .register("https", org.apache.http.conn.ssl.SSLConnectionSocketFactory.getSocketFactory())
            .build(),
        null, null, resolver, -1, java.util.concurrent.TimeUnit.MILLISECONDS);
    connections.setMaxTotal(20);
    connections.setDefaultMaxPerRoute(4);
    this.client =
        HttpClients.custom()
            .setConnectionManager(connections)
            .setDefaultRequestConfig(
                RequestConfig.custom()
                    .setConnectTimeout(TIMEOUT_MS)
                    .setSocketTimeout(TIMEOUT_MS)
                    .setConnectionRequestTimeout(TIMEOUT_MS)
                    .setMaxRedirects(5)
                    .setCircularRedirectsAllowed(false)
                    .build())
            .setRedirectStrategy(new org.apache.http.impl.client.LaxRedirectStrategy() {
              @Override
              public java.net.URI getLocationURI(org.apache.http.HttpRequest request, HttpResponse response,
                  org.apache.http.protocol.HttpContext context) throws org.apache.http.ProtocolException {
                URI location = super.getLocationURI(request, response, context);
                try {
                  validate(location);
                } catch (ResponseStatusException refused) {
                  throw new org.apache.http.ProtocolException(refused.getReason());
                }
                return location;
              }
            })
            .setUserAgent("Modulo/1.0 (+https://github.com/Ikey168/Modulo)")
            .disableCookieManagement()
            .build();
  }

  /** Scheme, port and userinfo policy; addresses are checked at connect time. */
  public URI validate(String raw) {
    if (raw == null || raw.isBlank() || raw.length() > 2048) throw bad("URL_INVALID");
    try {
      String normalized = raw.strip();
      if (normalized.regionMatches(true, 0, "webcal://", 0, 9)) normalized = "https://" + normalized.substring(9);
      return validate(new URI(normalized));
    } catch (java.net.URISyntaxException invalid) {
      throw bad("URL_INVALID");
    }
  }

  URI validate(URI uri) {
    String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
    if (!scheme.equals("http") && !scheme.equals("https")) throw bad("URL_SCHEME_NOT_ALLOWED");
    if (uri.getRawUserInfo() != null) throw bad("URL_CREDENTIALS_NOT_ALLOWED");
    if (uri.getHost() == null || uri.getHost().isBlank()) throw bad("URL_INVALID");
    int port = uri.getPort() == -1 ? (scheme.equals("https") ? 443 : 80) : uri.getPort();
    if (!allowPrivateNetworks && !PORTS.contains(port)) throw bad("URL_PORT_NOT_ALLOWED");
    return uri;
  }

  public Response get(String url, Map<String, String> headers) {
    return execute(new HttpGet(validate(url)), headers);
  }

  public Response post(String url, Map<String, String> headers, byte[] body, String contentType) {
    HttpPost post = new HttpPost(validate(url));
    post.setEntity(new ByteArrayEntity(body, ContentType.parse(contentType)));
    return execute(post, headers);
  }

  /** A request with a body and an arbitrary method (CalDAV uses REPORT). */
  public Response send(String method, String url, Map<String, String> headers, byte[] body, String contentType) {
    URI uri = validate(url);
    org.apache.http.client.methods.HttpEntityEnclosingRequestBase request =
        new org.apache.http.client.methods.HttpEntityEnclosingRequestBase() {
          @Override
          public String getMethod() {
            return method;
          }
        };
    request.setURI(uri);
    request.setEntity(new ByteArrayEntity(body, ContentType.parse(contentType)));
    return execute(request, headers);
  }

  private Response execute(HttpRequestBase request, Map<String, String> headers) {
    headers.forEach(request::setHeader);
    org.apache.http.client.protocol.HttpClientContext context = org.apache.http.client.protocol.HttpClientContext.create();
    try (CloseableHttpResponse response = client.execute(request, context)) {
      HttpEntity entity = response.getEntity();
      byte[] body = new byte[0];
      if (entity != null) {
        if (entity.getContentLength() > MAX_BYTES) throw error(HttpStatus.BAD_GATEWAY, "REMOTE_RESPONSE_TOO_LARGE");
        try (InputStream in = entity.getContent()) {
          body = in.readNBytes(MAX_BYTES + 1);
        }
        if (body.length > MAX_BYTES) throw error(HttpStatus.BAD_GATEWAY, "REMOTE_RESPONSE_TOO_LARGE");
      }
      Header type = response.getFirstHeader("Content-Type");
      java.util.List<URI> redirects = context.getRedirectLocations();
      URI finalUri = redirects == null || redirects.isEmpty() ? request.getURI() : redirects.get(redirects.size() - 1);
      return new Response(response.getStatusLine().getStatusCode(), type == null ? null : type.getValue(), body, finalUri);
    } catch (UnknownHostException refused) {
      throw error(HttpStatus.BAD_REQUEST, refused.getMessage() != null && refused.getMessage().startsWith("Refusing")
          ? "URL_ADDRESS_NOT_ALLOWED" : "REMOTE_HOST_UNKNOWN");
    } catch (org.apache.http.client.ClientProtocolException protocol) {
      throw error(HttpStatus.BAD_GATEWAY, "REMOTE_PROTOCOL_ERROR");
    } catch (IOException io) {
      throw error(HttpStatus.BAD_GATEWAY, "REMOTE_UNREACHABLE");
    }
  }

  /** True only for globally routable unicast addresses. */
  static boolean isPublic(InetAddress address) {
    if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
        || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
    byte[] b = address.getAddress();
    if (address instanceof Inet4Address) {
      int first = b[0] & 0xff;
      int second = b[1] & 0xff;
      if (first == 0 || first >= 224) return false; // this network, multicast, reserved, broadcast
      if (first == 100 && second >= 64 && second <= 127) return false; // carrier-grade NAT
      if (first == 192 && second == 0 && (b[2] & 0xff) == 0) return false; // IETF protocol assignments
      if (first == 198 && (second == 18 || second == 19)) return false; // benchmarking
      return true;
    }
    if (address instanceof Inet6Address) {
      if ((b[0] & 0xfe) == 0xfc) return false; // unique local fc00::/7
      // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::/96) carry an IPv4 address; judge that.
      boolean mapped = Arrays.equals(Arrays.copyOfRange(b, 0, 12), new byte[] {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, (byte) 0xff, (byte) 0xff});
      boolean nat64 = b[0] == 0 && b[1] == 0x64 && (b[2] & 0xff) == 0xff && (b[3] & 0xff) == 0x9b
          && Arrays.equals(Arrays.copyOfRange(b, 4, 12), new byte[8]);
      if (mapped || nat64) {
        try {
          return isPublic(InetAddress.getByAddress(Arrays.copyOfRange(b, 12, 16)));
        } catch (UnknownHostException impossible) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  private static ResponseStatusException bad(String code) {
    return error(HttpStatus.BAD_REQUEST, code);
  }

  static ResponseStatusException error(HttpStatus status, String code) {
    return new ResponseStatusException(status, code);
  }

  @Override
  public void close() throws IOException {
    client.close();
  }
}
