# Shelfday

A daily prep, perishable-stock and closing workbench for independent cafés and takeaway kitchens.

**For owner-operated cafés, bakeries and takeaway kitchens.** Connect the first delivery to the last portion: receive batches, plan preparation, record sales and waste, and close a reconciled day.

## The daily loop

1. Add ingredients in whole **grams, millilitres or items**. Enter quantities in the base unit: 1.5 kg = 1500 g.
2. Receive each batch with quantity, total purchase cost, supplier reference and a use-by date **from its label or your procedures**.
3. Create recipes with ingredient quantities per portion, a selling price and an initial daily target.
4. Prepare portions. Shelfday checks all ingredients, then allocates the earliest eligible batches atomically. Physically choose the corresponding batches.
5. Record portion sales and finished-food waste. Record raw ingredient waste against its batch in Stockroom.
6. Close when all prepared portions are sold or recorded as waste. Closed day records are locked; ingredient stock carries forward.

The first kitchen is empty. **Explore a sample kitchen** is opt-in and every sample screen is labeled. Clear the sample before using real records.

## What works

- Earliest-expiry-first batch allocation; expired and future receipts excluded; no stock overdraw.
- Combined restock requirements across recipes, without counting the same ingredient twice.
- Explainable suggested prep: median sales from up to four previous closed matching weekdays; operator target when no history exists. Quantities can be overridden.
- Versioned, user-specific D1 persistence; atomic compare-and-swap writes; idempotent operation IDs and explicit retry when a response is uncertain.
- Remaining-stock and prepared-portion cost pools preserve acquisition cents across partial use. Portion disposals use a moving average of remaining prepared inventory. Figures remain ingredient-cost estimates, not accounting valuations.
- Searchable batches, complete activity log, CSV export with spreadsheet-formula escaping, JSON backup/validated restore, and browser print prep sheet.
- Responsive navy/cobalt operations UI, semantic forms, keyboard-operable native dialogs, visible focus and reduced-motion support.

## Run locally

Requires **Node.js 24** and Git. No paid API, AI key, remote database credential or cloud account is needed for local development.

```powershell
git clone https://github.com/ZephyrusZorro/shelfday.git
cd shelfday
npm run install:ci
npm run build
```

On the **first setup of a fresh local database only**, apply the included schema:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_short_shaman.sql
npm run dev
```

Open the printed local address, normally [127.0.0.1:5173](http://127.0.0.1:5173/), and choose **Open your kitchen**. The starter's loopback-only development sign-in simulator uses the fictional Seedy account. This simulator is excluded from production builds; it is not production authentication. Subsequent starts need only `npm run dev`. Do not reapply the initial SQL to an existing database.

Local records persist in ignored `.wrangler/state/`. Browser reload and server restart do not erase them. Local and hosted databases are separate. Use backup/restore to transfer your own kitchen.

For later schema changes, run `npm run db:generate`, inspect the new SQL, rebuild the binding configuration and apply each new migration once, in order. Never edit an already-applied migration.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

Tests use the actual domain engine and real Node SQLite connections; they do not claim to replace hosted D1 verification. Browser acceptance exercises the connected local D1 service. [Verification record](docs/verification.md) distinguishes local, automated and hosted evidence. GitHub Actions repeats tests, typecheck and build on pushes and pull requests.

## Architecture

| Part | Responsibility |
|---|---|
| `lib/model.ts`, `lib/engine.ts` | Validated state and atomic stock/portion transitions |
| `lib/planning.ts` | Explained prep suggestions and aggregate restock demand |
| `lib/repository.ts` | D1-compatible SQL repository with revision checks |
| `lib/http.ts`, `app/api/kitchen/route.ts` | Bounded JSON API, platform identity and same-origin writes |
| `app/components/` | Today, Stockroom, Recipes, Activity, Settings and operation dialogs |
| `lib/export.ts`, `lib/demo.ts` | Portable backups, CSV and labeled fictional sample |
| `db/schema.ts`, `drizzle/` | Schema-owned database and immutable migrations |

React/TypeScript on Vinext; Cloudflare D1 stores one bounded kitchen document per authenticated user. This keeps a whole stock operation atomic without introducing a distributed transaction system. It is deliberately a small single-kitchen product, not an ERP.

## Hosted access and security boundary

The configured private Site uses platform-owned Sign in with ChatGPT. The API derives identity server-side and ignores caller-selected user IDs. Sites dispatch must protect the Worker; **do not publish this Worker directly on an unprotected workers.dev domain** or treat arbitrary identity headers as authentication.

To deploy a fork, create your own Sites project, set its returned project ID in `.openai/hosting.json`, retain the `DB` binding, and use the Sites source/package/deployment workflow. The manifest's existing ID identifies this deployment; it does not grant access to it. Sites applies hosted migrations. No runtime secret is embedded in this repository. GitHub source is public; kitchen records are not stored in Git.

## Practical limits

- One kitchen per signed-in account. No shared staff workspace, POS sync, automatic notifications, offline writes or multi-location support.
- Recipes and ingredient definitions are created once; editing/archiving catalog items is a future enhancement. Preparation quantities remain adjustable on every entry.
- Prepared-food carryover is not modeled: reconcile leftovers as waste under this product's workflow. Use a different process if you need safe prepared-food carryover tracking.
- Dates come from explicit service-date entries; stock balances are current balances, not a reconstruction of stock at a past date. Device-local dates drive the default service day.
- No prediction or savings guarantee. The matching-weekday median is descriptive history and does not account for stockouts, holidays, weather or special events.
- A kitchen document is capped at 1.5 MB, with bounded catalog/history arrays. Export backups regularly; start a new kitchen before capacity is exhausted. The app rejects changes before committing an oversized document. Backups remain importable under the 1.8 MB request limit.
- v1 backups without explicit cost pools load using proportional estimates for past disposals. New operations preserve integer cost balances; old historical cost estimates are not silently rewritten.
- This is an initial operational release, not a production-readiness certification or food-safety system. Accurate labels, quantities, storage conditions and staff procedures remain essential.

## Why this problem

See [opportunity research](docs/research.md) for 11 candidates, primary evidence and existing alternatives. Inventory systems and free waste-measurement tools already exist. Shelfday's hypothesis is that a focused daily loop can be useful to smaller kitchens without POS integration or a purchasing suite. That hypothesis still needs operator pilots.

Next priorities: (1) pilot with five independent kitchens and measure entry burden, (2) editable/archivable recipes and a safe prepared-food carryover model, (3) shared staff access plus a POS import path if pilot evidence justifies it.

## Milestone history

Work was pushed sequentially: research/design → tested engine → persistent API → redesigned interface → review fixes/security checks → verified delivery. No empty or backdated commits. GitHub determines contribution eligibility; pushes do not create a points system.

MIT for authored application code. Bundled starter files retain their included licenses.
