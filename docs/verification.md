# Verification record — 6-7 November 2026

This record separates actual checks from claims about future operation. It is not a production-readiness certification.

## Automated checks

23 automated tests pass on Node 24. The suite covers FEFO order, expired/future-receipt exclusion, shortage rollback, immutable source state, duplicate requests, over-selling, finished-food and raw-stock waste, close requirements, closed-day locks, aggregate ingredient demand, explained weekday median, invalid dates and quantities, duplicate/missing references, backup validation, acquisition-cent conservation, cost changes between prep runs, backup size, CSV formula escaping, real SQLite persistence across connections, user isolation, stale revisions, competing writes, HTTP identity/origin/content-type/body checks and size limits.

The repository tests execute the actual generated SQL against Node SQLite. Browser tests use local Cloudflare D1. These are distinct from the hosted database.

TypeScript checking and the deployable Worker/client build pass. Upstream bundler sourcemap and chunk warnings are not suppressed; no application compile failure remains. The production build excludes the starter's loopback development identity simulator.

## Local browser acceptance

Observed against the connected local D1 API, using only fictional sample/QA data:

1. Open the anonymous landing page; enter through the explicitly development-only local sign-in simulator.
2. Verify an empty workspace, then explicitly load the labeled sample kitchen.
3. Inspect desktop at 1440px and mobile at 390px; document width stays within the viewport. The final theme uses horizontal navy navigation and cobalt controls.
4. Create `QA rice` in grams, minimum 500.
5. Receive 1000 g, total cost INR 100, use-by 10 November 2026, reference `Browser acceptance receipt`.
6. Create `QA rice bowl`: 100 g per portion, price INR 60, daily target 5.
7. Prepare 5 portions; record 4 sold and 1 wasted. Remaining portions become zero; recorded waste is INR 10.
8. Reconcile the sample dishes and separately record the expired 400 ml raw oat-milk batch as waste.
9. Close the balanced day. Reload and observe `Service reconciled` and locked portion controls.
10. Download a complete JSON backup, select it in the file chooser, inspect the counts, and restore the identical dataset with confirmation. Revision advances; the kitchen remains readable.

An independent reviewer reproduced the initial waste-cost and backup-limit bugs. Regression tests were observed failing before fixes; the fixes were reviewed again with no remaining important findings. New cost pools also fix rounding loss when one acquisition cent is distributed over multiple disposals. Earlier v1 records without cost-pool fields load through explicit proportional-estimate compatibility parsing.

## Delivery checks

- Fresh final automated run: **23/23 tests**, TypeScript and Worker/client build passed after dependency upgrades.
- Full `npm audit`, including development tooling: **0 known vulnerabilities**. Pinned upgrades include React/RSC 19.3.1, Vinext 1.4.4, Vite 8.3.6, Next 16.4.5, Zod 4.6.7 and current compatible Cloudflare tooling. Transitive overrides cover sharp, esbuild, minimatch and fflate; the full suite and build passed with these versions.
- Search of generated production output found **no** `local_seedy` or `seedy@sites.test` development identity strings.
- Post-upgrade browser check on 7 November: the earlier kitchen survived process restart and schema compatibility parsing. Selecting 6 November loaded 27 prepared / 26 sold / 1 waste and the locked closed-day controls. Date filtering now requires the explicit View action and validates dates before changing the workspace.
- A second connected browser workflow received 100 g of rice, prepared 3 bowls, sold 2, recorded 1 waste at INR 10, and closed 7 November. Ingredient stock carried forward from the earlier service. Export CSV produced a downloadable file.
- Private hosting and GitHub CI results will be appended after the native deployment and CI runs finish. An expected URL alone is not deployment evidence.

## Not established

- No real café has piloted this release. Adoption, saved time, waste avoided and willingness to pay remain hypotheses.
- No formal accessibility audit, penetration test, load test, disaster recovery drill or operational SLA has been completed.
- Printing invokes the browser print system; physical printer output is not verified.
- The local sign-in simulator proves a development flow, not hosted identity security. Hosted authentication is owned by Sites dispatch.
- Cost figures cover entered ingredients only; they exclude labour, utilities, taxes, packaging and accounting adjustments unless explicitly represented as ingredients.
- User-entered use-by dates and storage conditions are not independently verified.
