# Shelfday product design

The user delegates product and implementation decisions and asks for staged GitHub pushes. These are the builder's choices, not user-selected alternatives.

## Intent

Help owner-operated cafés, bakeries and takeaway kitchens complete the same structured routine every trading day: receive ingredients, plan and record preparation, record portions sold or discarded, and close a fully reconciled day. Keep useful records rather than introduce another task list.

## Approaches

1. Browser-only inventory: lowest setup cost, but records are device-bound and backup-dependent.
2. A local SQLite server: durable and private, but cross-device access and public operation require hosting and authentication.
3. **Selected: private Sites app, React/Vinext and D1**, with deterministic, portable domain logic. Durable data, hosted access protection, and a local development database. Cost: a platform account is required for the hosted version, and the local sign-in simulator is development-only.

## Core requirements

- Start empty. Sample kitchen is opt-in and visibly labeled. Clearing data and restoring backups require explicit in-app confirmation.
- Ingredient units are whole grams, millilitres, or items; recipes use the same base unit. Monetary inputs use the selected currency; displayed figures are rounded, not accounting-grade valuations.
- Receipts create dated lots with quantity, total acquisition cost, and an operator-entered use-by date. Expired means use-by earlier than the selected service date. The app never invents safe shelf lives.
- Recipe preparation allocates stock by earliest use-by date, then receipt date and ID. All ingredients are checked before any deduction. Shortages and expired stock never permit negative balances.
- Prepared portions snapshot recipe name, selling price, and actual allocated ingredient cost. Sales and finished-food waste cannot exceed remaining portions.
- Daily close requires every prepared portion to be sold or recorded as waste. Closed days cannot be changed. Raw ingredient waste is a separate explicit lot deduction.
- Suggested prep uses the median of up to four previous closed matching weekdays; otherwise it uses the recipe's operator-set target. Show dates/sample size, allow override, and never claim predictive accuracy.
- A combined shopping list sums remaining planned requirements across all recipes before subtracting usable stock. One ingredient cannot satisfy multiple recipes simultaneously in that calculation.
- JSON backup/validated restore, CSV activity export, print prep sheet, searchable stock, recipe creation, and responsive accessible forms.

## Architecture and security

Pure TypeScript reducer owns business invariants; Zod validates operation and backup inputs. D1 stores a versioned kitchen document per authenticated user. Updates use compare-and-swap on revision, making each operation atomic and rejecting stale writes. Operation IDs make retries idempotent. D1 migration is schema-only. Limit document size and explain recovery before storage is exhausted.

Server APIs require platform identity and same-origin writes. Never accept a user ID from the body. Platform auth headers are trusted only behind Sites dispatch; do not expose the standalone Worker directly. Development identity simulation is labeled and excluded from production. No external AI calls, secrets, POS integrations, payments or notifications.

## Experience

Warm paper background, ink typography, forest-green actions, restrained orange expiry cues. Left navigation: Today, Stockroom, Recipes, Activity, Settings. Main view is an actionable prep board, next to an ingredient attention panel. Status and quantities carry meaning. Keyboard-operable dialogs, explicit labels, visible focus, mobile navigation and useful empty states.

## Scope and limits

One private kitchen per signed-in user; no shared staff workspace, permissions, offline writes, automatic POS ingestion, food-safety certification, multi-location operations, or automatic expiry calculation. Staged GitHub commits represent real research, engine, service, interface, and verification milestones. Preserve timestamps and authorship honestly.

## Acceptance

Complete a new kitchen and a labeled sample kitchen journey: receive → recipe → prep → sale → waste → close → reload → export → restore. Exercise shortage rollback, expired lots, duplicate requests, stale revision, missing identity, cross-origin writes, malformed backups and persistence. Build/typecheck and inspect desktop/mobile in a browser. Distinguish local, hosted and automated verification.
