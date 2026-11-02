# Commonnest (independent exercise)

Original browser demo for a **fictional one-week plan** with two named owners, movable tasks, meal instances, and a shopping list that sums compatible ingredient units. Not a recovered historical product.

## Problem

Shared shopping should add whole quantities when two meals use the same ingredient in the same unit, without double-counting the same meal instance. Checking an item off should reopen if a new meal changes the total.

## One-minute walkthrough

1. Read the banner: progress stays in this browser only.
2. Change a task owner or due day — the same task id moves once.
3. Add a meal instance or use **Re-add same instance id** to confirm totals stay stable.
4. Check off **Tomatoes**, then add another tomato-based meal and read the reopen note.
5. Try **g vs kg** combine to see the decline message.
6. Reload to confirm persistence; **Reset this demo** restores the seed week.

## Tests

```bash
npm test
npm run verify:demo
```

## Engineering decision

**Shopping lines are derived from meal instances** with check metadata stored separately, so quantity changes can invalidate a check without silently keeping a stale total.

## Limitation

No multi-user sync, unit conversion, or real household data.

## Local preview

```bash
python -m http.server 8802 --directory ..
# http://127.0.0.1:8802/commonnest-independent/demo/
```

Future Pages site path: `/commonnest-showcase/demo/`.
