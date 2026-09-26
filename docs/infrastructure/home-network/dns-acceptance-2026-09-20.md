# Home DNS and service-discovery acceptance — 2026-09-20

## Result

Local names are reliable for Trusted and Infrastructure without exposing the
private namespace to IoT, Guest, or WAN. The canonical local suffix is
`home.arpa`. The router uses a fixed Cloudflare/Quad9 upstream pair, while IoT
and Guest receive that pair directly and cannot use arbitrary classic DNS.

The network does not currently need an mDNS reflector or a network-wide
filtering service. Neither was deployed. Remote-client DNS is deliberately
owned by the WireGuard project so this project does not duplicate that work.

## Live policy

| Source | Resolver policy | Local records |
| --- | --- | --- |
| Trusted | MikroTik zone gateway; upstream `1.1.1.1`, `9.9.9.9` | Allowed |
| Infrastructure | MikroTik zone gateway; upstream `1.1.1.1`, `9.9.9.9` | Allowed |
| IoT | Direct `1.1.1.1`, `9.9.9.9`; other UDP/TCP 53 denied | Hidden |
| Guest | Direct `1.1.1.1`, `9.9.9.9`; other UDP/TCP 53 denied | Hidden |
| WAN | No DNS service | Hidden |

ISP-supplied dynamic DNS is disabled. This keeps the configured resolver
policy deterministic. DNS-over-HTTPS and DNS-over-TLS are not intercepted, so
the rule is a classic-DNS control rather than a claim of complete resolver
enforcement.

## Naming and discovery decisions

- The router holds stable A records for the gateway, AP, Pi, endpoints, and
  current Pi-hosted services. `paperless.home.arpa` and the other migrated
  service aliases resolve to `10.10.20.10`.
- Existing `.lan` records remain as compatibility aliases. New references use
  `.home.arpa`; the old suffix can be removed after dependent bookmarks and
  configurations have migrated.
- MikroTik mDNS repeat interfaces are empty. No current AirPrint, AirPlay,
  Chromecast, or similar cross-VLAN requirement was identified, so discovery
  traffic remains inside its source VLAN.
- AdGuard Home was not added. The existing router cache and two upstreams meet
  the reliability goal without introducing another stateful dependency on the
  Pi. Filtering can be revisited only with a concrete requirement.
- DNSSEC behavior was not claimed from the legacy `dnssec-failed.org` probe:
  during this run it returned an address through all tested public resolvers
  and therefore was not a valid discriminator.

## Acceptance evidence

- Trusted directly queried `192.168.88.1` for `router.home.arpa`,
  `pi.home.arpa`, `paperless.home.arpa`, and a public name; all answered.
- The Pi directly queried `10.10.20.1` for the same local and public names;
  each response had `NOERROR` and at least one answer.
- A real IoT Wi-Fi client renewed as `10.10.30.100/24` and received only
  `1.1.1.1` and `9.9.9.9`. Both answered, `10.10.30.1` and `8.8.8.8` timed out,
  and HTTPS returned 200.
- A real Guest Wi-Fi client renewed as `10.10.40.100/24` with the same result:
  both approved resolvers answered, its gateway and `8.8.8.8` timed out, and
  HTTPS returned 200.
- An off-site Oracle-hosted probe received no DNS response from the observed
  home public IPv4 over UDP or TCP port 53.
- With the primary resolver temporarily replaced by the unreachable
  documentation address `192.0.2.1`, a public query still succeeded through
  the secondary. With only that unreachable address configured, local static
  names continued to resolve and a public query failed. Restoring
  `1.1.1.1,9.9.9.9` restored public resolution.
- The final RouterOS state has no dynamic upstream, no DoH server, and no mDNS
  repeat interfaces. The normal resolver pair was restored before acceptance
  ended.

## Operations

Capture a fresh encrypted MikroTik export after DNS, DHCP, or firewall changes.
Re-run one Trusted, Infrastructure, IoT, Guest, and WAN-negative test after any
resolver-policy change. Review this design when WireGuard is enabled, when a
real cross-VLAN discovery need appears, or by 2026-12-20.
