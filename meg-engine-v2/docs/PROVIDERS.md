# Providers and reliability

## Adapter contract

Every provider exposes:

```js
isConfigured()
stream({ messages, temperature, maxTokens, signal }) // async iterable of text chunks
generate(request)
healthCheck()
normalizeError(error)
```

Adapters only translate Meg's neutral messages into provider wire formats. They do not know about PCOS, route classes, memory, safety, or Bloom.

Gemini uses its native SSE API. Groq and OpenRouter share the small OpenAI-compatible adapter. Ollama consumes newline-delimited JSON. `TextDecoder` is used in streaming mode so a multi-byte UTF-8 character split across network chunks is not corrupted.

## Provider manager

`src/providers/providerManager.js` is the only fallback/retry implementation. It:

- skips unconfigured providers;
- applies route-specific timeouts;
- retries retryable errors at most the configured number of times;
- uses exponential backoff with bounded jitter;
- records latency, status, 429s, retry count, and fallbacks;
- does not retry permanent 4xx/auth errors;
- never inserts a second provider after a partial stream;
- propagates client cancellation through a linked `AbortController`.

## Circuit states

- `CLOSED`: normal routing.
- `OPEN`: provider is skipped until cooldown expires.
- `HALF_OPEN`: one limited probe is allowed. Success closes the circuit; failure reopens it.

The breaker uses consecutive failures plus a rolling failure-rate window. All thresholds and cooldowns are environment configurable.

## Configuration

Use `.env.example` as the source of names. The important controls are:

- `FAST_PROVIDER_ORDER`, `SMART_PROVIDER_ORDER`, `SAFETY_PROVIDER_ORDER`, `DOCTOR_PROVIDER_ORDER`, `LOCAL_PROVIDER_ORDER`
- `PRIMARY_FAST_PROVIDER`, `PRIMARY_SMART_PROVIDER`
- `FAST_TIMEOUT_MS`, `SMART_TIMEOUT_MS`, `LOCAL_TIMEOUT_MS`
- `PROVIDER_RETRIES`, `RETRY_BASE_DELAY_MS`, `RETRY_MAX_DELAY_MS`
- `CIRCUIT_FAILURE_THRESHOLD`, `CIRCUIT_COOLDOWN_MS`, `CIRCUIT_ROLLING_WINDOW_MS`
- `ENABLE_LOCAL_FALLBACK`, `ENABLE_HEDGING`

Hedging is intentionally only a configuration placeholder in this beta; it is disabled by default and no duplicate cloud request is made today.

## November 2026 hardening

Groq defaults to `openai/gpt-oss-20b`; the prior Llama default was retired for
ordinary developer accounts ([Groq deprecations](https://console.groq.com/docs/deprecations)).
GPT-OSS uses the provider-supported reasoning controls and completion-token cap
([API reference](https://console.groq.com/docs/api-reference)). Overrides remain
server-only. Gemini uses an API-key header, keeps thought parts out of replies,
and retains the configurable model ID. Verify model access with the actual
account; catalog presence does not prove project access. Missing cloud keys and
disabled local fallback now report unavailable readiness.

`npm run check:meg-live` requires a dedicated QA Firebase token or QA credentials
in ignored/server environment variables. It sends only a synthetic greeting,
requires a named supported cloud provider, checks idempotent replay and persisted
feedback/history, and reports actual timing without printing content or tokens.
It does not certify backend restart, device accuracy or legal approval.
