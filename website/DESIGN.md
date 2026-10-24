# Bloom website: current design contract

Use the actual BLOOMv3 repository and its approved PNG artwork. Source commit: 15241e53e14a783dba5736e314c4a2525f8d77f5. Artwork is not redrawn, recolored, inverted or stretched. The black wordmark receives a light plate in dark mode. Palette roles follow src/utils/constants.js: brand #B52F50, ink #222222, light canvas #FFFEFF; dark canvas #121113, brand #EE718B.

The original website story is authoritative. Preserve the full 22-paragraph story and seven-paragraph homepage excerpt verbatim. Layout and typography may change; the story copy may not. The generated botanical artwork and recreated SVG mark from the first version are removed.

Keep the landing page responsive, with its local sample journal and useful product progression. The requested 20-feature map is in FEATURES_20.md. Website code is buildless HTML/CSS/JS. The password visibility addition belongs in the real app's shared AuthField; no unrelated account flow is added to the landing page.

Dark and light colors switch without background-color animation to avoid transient contrast failures. Loading feedback reflects real font/image work and does not block content. Native cursor, keyboard navigation, reduced-motion paths and visible focus remain available. The mobile floating tools use a compact vertical rail, and story prose reserves space so the controls do not cover it.

No real health data is saved by the demo. Campaign attribution requires consent. Feedback creates a public GitHub draft for the visitor to review; it is not automatically posted. Real waitlist signup stays on the existing Bloom website. Do not publish private contact information or invent traction, testimonials, diagnoses or release dates.
