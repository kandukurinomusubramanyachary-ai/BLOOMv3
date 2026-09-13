# Strength experience audit and direction

Scope: the existing Bloom Strength feature, web first and native guided sessions. The September 2026 brief pins the visual direction; this is not a new app identity or a concept-selection exercise. Meg, Firebase rules and pose thresholds are outside this redesign.

## Existing screen audit

| Surface | User task | Observed problem | Design response |
| --- | --- | --- | --- |
| Web and native catalog | Decide what to do today | Stats dominate before any useful action; duplicate layouts; every movement has a bordered card | Shared home with one recommendation, secondary library and progress; open movement rows |
| Exercise detail | Understand and configure a movement | Generic “Set up” title, oversized icon, detached metrics; timing does not react to set choice | Named overview, accurate plan metadata, set control and progressive instructions |
| Camera consent | Understand privacy and choose guidance | Two paragraphs plus safety text compete with the action | Short trust explanation, explicit camera consent, camera-free alternative and expandable limitations |
| Camera setup/framing | Position device and body | Small camera beside lengthy supporting UI | Camera is the main surface; concise framing cue and clear readiness state |
| Active tracked session | Move, glance at reps and guidance | Camera and controls feel unrelated; feedback and options compete | Camera-first layout, one feedback line, labeled controls and secondary options |
| Tracked rest | Recover before another set | No visible rest timer; same visual weight as active tracking | Quiet countdown with +15 seconds and user-controlled continuation |
| Guided preparation/active/paused | Follow a paced set | No upfront explanation that reps are timer-paced, large progress ring, clipped exercise title, 40-point close target | Shared preparation language, clear paced/not-measured labeling, readable count and pause state |
| Guided rest | Rest between sets | Cannot add time; sparse next-step context | Rest countdown, add time, skip rest and next-set preview |
| Camera and save failures | Recover without losing progress | Safe error text exists but presentation differs | Common recovery states; preserve retry, save and explicit guided fallback |
| Two completion screens | Recognize effort and decide what next | Separate designs, immediate stats/cards, guided saving failures hidden | Shared visual grammar, “Beautiful work”, truthful local-save states and summary disclosure |
| Progress/history | Understand consistency | No dedicated view; guided storage methods missing; tracked summaries absent from local history | Actual saved activity across modes, accessible seven-day view and useful empty/error states |
| Unsupported native entry | Choose a supported mode | Technical module copy and automatic fallback | Explicit camera-free explanation; no claim of native pose tracking |

## Direction contract

THESIS: One clear movement decision, then the interface recedes. Replace the statistics-first catalog and disconnected player styles, not Bloom's identity.

OWN-WORLD: Warm cream surfaces, accessible clay actions, charcoal text, sage reassurance, existing Bloom outline icons and humanist UI type. Open lists; containers only for a recommended workout, instruction guide or meaningful state.

STORY: Choose an existing movement or a sequence composed from the existing library, understand what will happen, move at a comfortable pace, and leave with an honest record.

FIRST VIEWPORT: Compact Strength header; 30-point invitation; one recommendation with duration, level, movement count and a 52-point action; weekly activity follows. Active sessions prioritize the camera or paced count.

FORM: Brief-pinned mobile Operate flow; no random concept roll. Target 375/390/430 widths plus desktop and dark mode. Signature interaction: a restrained rep increment; reduced motion preserves an immediate state change.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Truth boundaries

- Eight existing movements; camera engines only for squat, wall push-up and standing side-leg raise.
- No invented calorie estimates, form scores, personal records or artificial history.
- Guided reps are paced by a timer, not observed. Text movement guides are not represented as demonstration videos.
- Native camera tracking is not implemented. Strength remains off in the release defaults; a separate local preview can enable it for QA.
- No provider keys or camera frames enter the redesign, screenshots or fixtures.
