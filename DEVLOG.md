# Dev Log

---

## Session 4 — 2026-05-08

### NPC variant system added

NPCs can now define a `variants` array instead of top-level `desc`, `visual`, and `choices`. The engine picks the first variant whose `if` condition passes — or the first entry with no `if`, which acts as a fallback. Any condition type from the condition system (`stat`, `chose`, `visits`, `day`, `and`/`or`/`not`) is valid on a variant.

New function:
- `resolveNpcVariant(npc)` — iterates `variants`, evaluates each `if`, and merges the first matching variant onto the NPC object via `Object.assign`. Returns the NPC unchanged if no `variants` key is present (backwards-compatible).

Modified:
- `nextStep()` — calls `resolveNpcVariant(npc)` and uses the result for `visual`, `desc`, and `choices`.

All existing conditional logic (`if` on choices, variant arrays on `desc`, `chose`/`visits`/`stat` conditions) works inside variants unchanged.

`dialogue.json` — Farmer converted to `variants`:
- Variant 0: `"if": { "visits": 0 }` — matches first visit; plain desc, original four choices including locked growth spell (Power ≥ 30)
- Variant 1: no `if` (fallback) — subsequent visits; conditional `desc` array checking `chose` A, different choice set with a harder locked spell (Power ≥ 50)

---

## Session 3 — 2026—05—06

## Condition system added: Implemented the follow-through branching condition system.

  New state:
- choiceHistory — records root-level choices per NPC: { "Farmer": ["A", "B"], ... }
- currentNpcName — tracks the current NPC name for visit counting

  New functions (lines 291–429):
- capitalize(str) — utility
- computeVisitCount(npcName) — scans schedule up to current step to count prior visits
- evaluateCondition(cond) — evaluates all predicate types (stat, chose, visits, day, and/or/not)
- resolveVariantText(variants) — resolves string-or-array to final text string
- resolveVariantEffects(variants) — resolves flat-or-array effects to final effects object
- describeCondition(cond) — human-readable requirement text (e.g. "Power ≥ 30")

  Modified functions:
- updateChoices(choices, visual, recordChoice) — resolves variant text/effects, hides choices that fail if, shows
  locked choices greyed with requirement text, records root-level choices to history
- nextStep() — sets currentNpcName, resolves variant desc, passes recordChoice: true
- advanceToBranchNode() — resolves variant desc, passes recordChoice: false

  dialogue.json — Test content

- Farmer desc is now a variant array: first meeting shows the original line; second meeting changes based on whether
  player chose A (magic fertiliser) previously
- Farmer choice D is now "Cast a growth spell", locked behind power ≥ 30 with showLocked: true
  
---

## Session 2 — 2026-05-06

### Bug fixes
- Removed dead `updateChoices(npc)` function body that was duplicated inside `nextStep()` — the version inside `nextStep` was the one actually running, overwriting the work already done by the standalone function via `updateContent`
- Fixed null check on `npc` in `nextStep()` — was dereferencing `npc.visual` before the guard, which would crash on an unknown NPC name
- Removed inner `formatStat` definition that was redeclared inside the choice-building loop (was shadowing the global)
- Fixed `formatChoice` to use truthiness checks instead of `!== 0` — the old check would render `undefined` for any stat key missing from an effects object

### Branching dialogue — implemented
Choices in `dialogue.json` can now have an optional `next` field containing a new `desc` and `choices`. Clicking a choice with `next` applies any effects on that choice (if present), then fades to the new NPC line and new options. Choices without `next` end the encounter and advance the schedule as before.

Key details:
- Arbitrary nesting depth — `next.choices` entries can themselves have `next`
- `effects` is optional at any level; missing keys treated as 0
- Branch transitions use the same 300ms fade + `isTransitioning` guard as NPC-to-NPC transitions
- `updateChoices(choices, visual)` now accepts a raw choices object rather than a full NPC — `visual` is passed down so branch nodes can trigger the same fade correctly
- New `advanceToBranchNode(node, visual)` handles the fade and content swap for mid-encounter transitions

Test case added to Farmer choice A in `dialogue.json` — one level deep, two terminal choices.

---