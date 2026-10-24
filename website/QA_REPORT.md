# Bloom: assets, original story and 20 requested features

## Verified

- All 22 original story paragraphs and the original homepage excerpt match the fetched original HTML verbatim.
- The approved logo, lockup, lotus and favicon match BLOOMv3's source bytes exactly.
- Both light and dark homepages at 390 px and 1280 px report zero WCAG A/AA axe violations, no horizontal overflow and no visible targets below 24 px.
- The original story page at 390 px also reports zero violations and no overflow.
- Native password-field JSX parses and the exact AuthField component passes isolated rendering tests for initial masking, show/hide, retained value, masking after clearing, and no toggle on ordinary fields.
- Empty sample check-in produces a real error; choosing energy produces its success state and next action.
- Reset cancellation retains the selection; confirmation clears it. Dialogs and mobile navigation support Escape and focus restoration.
- Local search finds text from the full original story, including its final line.
- Feedback validation rejects incomplete input, produces an accurate draft-ready state and copies the draft successfully. Nothing is posted during verification.
- Without attribution permission, signup has no UTM fields. Allowing attribution adds the synthetic test source/campaign; rejecting again removes them.
- Back to top returns the hero to its initial position, restores brand focus and resets the progress bar to zero. The header stays at viewport top while scrolling.
- JavaScript syntax and all local asset references are checked. Print CSS removes navigation, dialogs and floating controls; last-updated markup is machine readable.

## Implementation boundary

Nineteen checklist features are implemented in the marketing website. Password visibility is implemented in the actual application's existing shared sign-in/sign-up/confirmation field, delivered in the GitHub branch. The app's normal build and release process is required to ship that native change.

Campaign attribution captures, remembers and forwards permitted UTM values. No third-party analytics or downstream conversion dashboard is added. Signup still runs on the original website. Contact prepares a public GitHub issue draft which the visitor reviews and posts themselves.

## Limits

The supported browser does not expose device throttling, native OS reduced-motion emulation or native mobile compilation. Those measurements/builds are not claimed. The generic static preview error handler remains separate from the included designed 404.html page. No production accounts, health records, waitlist entries or feedback issues were created during testing.

The latest screenshots are in docs/preview. Source asset hashes are in content/provenance.json and the full checklist is in FEATURES_20.md.
