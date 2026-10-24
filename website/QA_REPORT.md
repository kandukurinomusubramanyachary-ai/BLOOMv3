# Bloom upgrade verification · 24 October 2026

## Source and content

- JavaScript syntax checks pass for app.js and enhancements.js.
- The full 22-paragraph story remains verbatim in content/original-story.html and the story page. The homepage’s seven-paragraph excerpt matches the previous source exactly.
- The approved logo, lockup, lotus and favicon match the BLOOMv3 source PNGs byte for byte.
- Every local page reference resolves, IDs are unique, and each page has one h1.
- Taste source lint: 0 FAIL, 0 WARN. Narrow, documented exceptions are real interface boundaries and floating overlays permitted by the skill.
- Impeccable’s mechanical detector returned an empty findings list for the changed UI files.

## Browser checks

The supported CUA browser rendered the site in responsive frames at 320, 390, 768 and 1440 CSS pixels. Home-page axe WCAG A/AA scans reported no violations, no horizontal overflow and no interactive targets below 24px in both themes. Main headings fit within two lines. The final sticky-header top control was also checked at 320px while scrolled.

The full story was checked at 390px in both themes: one h1, no overflow, no small targets and zero reported axe violations. The unchanged original paragraphs remain readable beside a reserved contact rail.

Interaction checks passed:

- Missing energy produces a real validation message; selecting energy synchronizes the hero, sample and doctor summary.
- Saving completes the fictional check-in; the next action opens Patterns. Keyboard arrows move between tabs immediately.
- Doctor-note copy reports success. Reset cancellation retains the selection; confirmation clears it and returns to Today.
- Ctrl K opens local search. A sentence from the full original story finds its page; an unknown query gives an honest empty state.
- Mobile navigation opens, supports Escape, and restores its control state.
- Invalid feedback shows a field error. Synthetic product feedback produces a reviewable GitHub draft and copies successfully; no issue was posted.
- Cookie settings reopen and essential-only closes the panel. Signup still points to https://bloom-nine-eta.vercel.app/.
- Native FAQ details open the selected answer and close the previous answer.
- Back-to-top, sticky navigation, theme changes and the original signup information dialog remain functional.

## Visual review

Round 1 found a journal reveal that could leave content clipped, crowded tablet actions, and a three-line reminder heading at 320px. The reveal now affects only the lotus; tablet actions have deliberate spacing; the narrow reminder uses 24px. A later phone check moved back-to-top into the header so it does not cover the check-in controls.

ROUND 2
Seen in one second: Bloom’s reassurance, then a real energy choice.
Idea: The promise to help women feel heard becomes a check-in that responds gently.
Live thing: Energy selection carries from the hero into the sample journal and doctor note.
Layout words by section: hero=working fragment / promise=strip / care=paired text / journal=tool / story=letter and quotation / FAQ=disclosure / close=invitation.
Self-review scores: design 7.5 · usability 8 · creativity 6.5 · content 8 → overall 7.5.
Caps: Creativity stays below 7 because a live product demonstration is an established approach.
Remaining limits: The page is a concept, signup is an external handoff, and its imagery is approved brand artwork plus interface fragments. These are self-review observations, not an award or independent rating.

## Verification limits

Automated accessibility checks do not establish full conformance. Physical phones, iOS/Safari behavior, OS keyboard/safe-area behavior, reduced-motion emulation, native app builds, print-dialog output and throttled performance were not available or measured. Reduced-motion and print paths were checked in source. The prior isolated AuthField password visibility tests remain applicable because that app source did not change in this upgrade. Taste’s standalone browser inspector was not run; browser QA used the supported CUA preview workflow.

No real account, waitlist submission, health record or GitHub issue was created during checks. Temporary audit files are removed before publication.
