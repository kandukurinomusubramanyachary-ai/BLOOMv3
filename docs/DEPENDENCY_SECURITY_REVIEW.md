# Dependency security review ? 2026-11-01

The Node 22/npm 10 clean install succeeds. Root full-tree audit: **0 high, 0 critical, 26 moderate, 1 low**. Root runtime tree: **0 high, 0 critical, 17 moderate, 1 low**. Meg standalone tree after supported-range updates: **0 vulnerabilities** (101 installed packages). These are package-node counts, not a count of distinct exploited defects.

Patched root advisories cover grpc certificate authorization, shell quoting, body-parser compressed-body crashes, re2js exhaustion, Zod collection validation, and inherited UUID buffer handling. Scoped overrides are documented in the lockfile and exercised against real Expo plugin/MCP schemas, Firebase transport and Google multipart upload callers. No Expo/RN downgrade was accepted to satisfy npm audit.

The separate Meg lockfile still had body-parser 2.x below 2.4 and proxy-addr below 2.0.8. Supported-range updates resolve both, with behavioral regressions for forged IPv4-mapped IPv6 proxy trust and compressed payloads with trailing bytes against both Express transports. The unused bloom file:.. dependency was removed; no engine source imports it, and it recorded an obsolete Expo 51 matrix in a backend lockfile.

Remaining advisories are not hidden:

| Dependency / advisory | Scope and disposition |
|---|---|
| glob ? GHSA-3g3m-2fjr-6pw4 | Expo/build and CLI filesystem traversal cancellation. Patched upstream major 14.0.2 is outside installed caller ranges. No app/API endpoint accepts user glob patterns. Retain supported SDK matrix; revisit upstream update. |
| minimatch ? GHSA-g3hv-75wg-m249 | Glob/build pattern amplification. Upstream patch is major 11.0.1; do not force a major API change through Expo/CLI consumers without compatibility work. Patterns here are repository/tool inputs, not health-chat inputs. |
| deepmerge ? GHSA-gcqx-w48m-w2h4 | Expo configuration object merging. No published patched version at review time. Configuration is repository-controlled. Treat untrusted imported build configuration as unsafe and revisit upstream resolution. |
| OpenTelemetry core ? GHSA-8988-4f7v-96qf | Development Firebase CLI dependency only, absent from runtime audit. Track the upstream CLI/SDK fix; do not replace its dependency major blindly. |

Primary sources: [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249), [deepmerge](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), [OpenTelemetry](https://github.com/advisories/GHSA-8988-4f7v-96qf). Audit evidence is retained locally under ignored tmp/release-evidence. No secret or environment files are committed.
