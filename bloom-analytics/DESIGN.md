# Bloom Analytics Design

## Brand
- Uses the exact `assets/lotus-mark.png` artwork from `src/components/BrandMark.js`, also used in Today and Meg. It is derived from the canonical `assets/bloom-logo-approved.png`; no redraw or tint. The favicon uses `assets/favicon.png`. Both are embedded unchanged as PNG data URLs so the isolated HTML remains portable.
- Actual V3 tokens come from `src/utils/constants.js` (`LIGHT_COLORS`): brand/terracotta alias `#B52F50`, approved logo rose `#ED3F5B`, ink `#222222`, body `#484848`, muted `#6A6A6A`, hairline `#E5E5E2`. V3's primary accent is rose, not the previous dashboard's brown terracotta.
- Warm canvas uses `surfaceWarm #FBF3EF`; cards use `canvas #FFFEFF`; grouped controls and metrics use `surfaceSoft #F7F7F5`. Supporting blush `#FBE5EA`, sage `#60745C` / `#E7ECE4`, and error `#B42318` / `#FCEBE8` retain their semantic roles.
- Uses the real web `FONTS.body` stack: Inter, system-ui, Apple system, Segoe UI, sans-serif. No external font dependency; installed/system fallback follows the app. Title 28/34, section 20/26, metric 24/30, supporting 14/20, captions 12/16 follow `TYPOGRAPHY` (mobile title 24/30 for density).

## Layout
- Operate mode: a readable founder tool with all existing metrics and filters retained.
- Keeps the existing 1240px analytics page cap, a deliberate adaptation of the consumer app's 720px reading width for multi-column comparisons. Uses the app's 4px spacing base: 8/12/16/20/24/32px.
- Review Pulse leads with Usage and Quality groups. Secondary sections use a 12-column grid with 24px desktop / 16px mobile gaps. No new navigation or analytics sections.
- Six core KPIs: six desktop columns, three at intermediate widths, two at 361–720px, one at 360px and below. Mobile tables become labeled rows; filters wrap and controls stay at least 44px high.

## Components
- Cards: 16px corners, 20px padding, one hairline border, flat elevation, from `src/components/Card.js`. Warm and sage groupings reference `TodayScreen.js` and `strength/strengthTheme.js`.
- Buttons: 12px corners, Bloom fill for actions, visible focus, 44px minimum target; references `Button.js`, `WEB_FOCUS`, and `LAYOUT`.
- Filters: quiet neutral pills with rose selection and `aria-pressed`, following onboarding `SelectionCard.js` and the app's selected-state tokens. Date range remains segmented.
- KPIs: restrained tabular values, muted explanations, existing denominators/small-n states, keyboard-visible definition help. No metric definition changes.
- Charts: Bloom rose for primary series, sage for supporting series, neutral gridlines, retained keyboard inspection and descriptions.
- Tables: dividers and grouped rows echo Profile settings. Onboarding highlights only the existing largest-drop calculation, labeled in text; never health answer values.
- Meg: the same small untinted lotus and soft rose divider used in its brand/presence treatment. Strength uses its theme's sage support. Diet retains current action terminology.
- Feedback: neutral metrics. Technical health is separately labeled; danger tint applies only when the critical-error count is nonzero.
- Empty/loading/error: real lotus, neutral skeletons, clear unavailable states and retry, referencing `FeedbackStates.js`. Reduced motion removes animation. Privacy remains visible in the footer; no content or identifiers added.

## Principles
Warm, calm, premium, feminine without childish decoration, health/wellness oriented, low visual noise, readable, and privacy-first. Reuse actual Bloom evidence; do not invent a new identity. Root `DESIGN.md` is supporting guidance; current component code and tokens are the implementation authority.

Accessibility note: small status-chip labels use the existing body-ink token on sage/amber fills to meet text contrast; semantic fills and icons retain their status colors. Growth-chart axis tick placement was corrected to match its existing plotted scale without changing data.
