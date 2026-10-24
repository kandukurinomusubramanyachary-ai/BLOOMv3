# Bloom website design contract

This upgrade applies Impeccable, Leonxlnx/taste-skill and Emil Kowalski’s design engineering guidance to the established Bloom identity. The homepage is a marketing surface; the sample journal is a fictional, interactive product fragment.

## Direction

Taste Skill’s selected direction is “The product performs”, seed 682090058. Bloom’s promise to help women feel heard becomes a check-in that listens: choosing an energy level changes the response and carries into the larger sample journal. The app fragment uses the “Editorial greeting” arrangement, adapted to the existing Today, Patterns and Doctor note views.

One clear headline leads to one usable panel at reading size. Equal outer margins, flat rose and sage fields, full-contrast body text and generous controls carry the design. Repeated oversized wordmarks, tilted paper, grain, colored headline words and decorative labels have been removed. The footer closes with a small approved lockup.

## Brand and content

Use the actual BLOOMv3 repository and its approved PNG artwork, source commit 15241e53e14a783dba5736e314c4a2525f8d77f5. Never redraw, recolor, invert or stretch the artwork. The black wordmark receives a light plate in dark mode. Palette roles follow src/utils/constants.js: brand #B52F50, ink #222222, light canvas #FFFEFF; dark canvas #121113 and brand #EE718B.

The original website’s full 22-paragraph story and seven-paragraph homepage excerpt remain verbatim. Layout and typography may change; the story may not. No outside stock photography, invented account flow, traction, testimonials or customer data are introduced.

Typography remains self-hosted DM Sans and Bricolage Grotesque, with tracking no tighter than −0.04em. The responsive bands are 960px, 760px and 359px. Mobile navigation folds away, the journal tabs keep their labels, and its secondary note stacks under the controls.

## Interaction and motion

CSS handles readable initial entrances and a single lotus reveal. WAAPI handles short UI feedback with a strong ease-out: 160ms for a selection, 200ms for a pointer tab change, 220ms for the menu, 240ms for an occasional dialog. Keyboard navigation and search open immediately. Hover requires a fine pointer. Motion preferences have a complete static path; readable content is never clipped or hidden.

Scrolling is native. Progress updates on scroll, resize and content-size changes. Loading feedback reflects real image/font work. The back-to-top control appears in the sticky header after scrolling; only contact floats on phones. The full story reserves a narrow reading rail for it.

## Existing features and boundaries

FEATURES_20.md maps the original 20-item request. Password visibility belongs to the real app’s shared AuthField, covering login, signup and confirmation, and is retained in the GitHub PR. The marketing page has no account form.

The sample stores no health data. Campaign attribution requires consent. Feedback prepares a public GitHub draft for visitor review and does not post it. Registration continues on the original Bloom website. No private contact information, diagnoses or release date are published.
