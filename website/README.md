# Bloom website

This revision uses the actual BLOOMv3 repository, approved brand PNGs and the original website story. The latest upgrade applies Impeccable, Taste Skill and Emil Kowalski’s design engineering guidance; SKILLS_APPLIED.md records the decisions. ASSETS.md records provenance; FEATURES_20.md maps the requested checklist.

The source is prepared for the website/ directory in BLOOMv3. It is buildless HTML, CSS and JavaScript, with no package installation required for the marketing site. Serve that directory with a static HTTP server. For Vercel, select website as the Root Directory, use no build command, and serve the directory itself.

The ChatGPT Sites checkout keeps the same content in dist/ and preserves its existing hosting manifest and private access.

The sample journal is browser-local and fictional. Site preferences use essential storage. Campaign attribution is optional and consent-controlled. The contact form prepares a public GitHub feedback draft; visitors review and post it themselves. Real signup continues through the existing Bloom website.

The password show/hide control is implemented in the actual app's shared AuthField in src/screens/AuthScreen.js. Clearing the field restores masking. It is delivered with the GitHub changes and requires the app's normal build/release process.

Verification and limits are recorded in QA_REPORT.md.

Motion uses CSS and the Web Animations API. Scrolling is native; the marketing site has no JavaScript package or motion-library runtime dependency.
