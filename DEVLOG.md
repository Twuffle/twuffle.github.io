# Dev Log

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

## Next TODO

### Follow-through branching
NPC `desc` text and choice options can change based on prior player decisions or current stat values — scoped **across the whole game**, not just within a single encounter.

Agreed design direction:
- Needs a persistent record of choices made (probably a map of `npcName → [choiceKeys]` or similar)
- JSON will need a way to express conditions (e.g. "if player chose A for Farmer on a previous visit" or "if suspicion > 70")
- Discuss the condition schema before implementing — there are several valid approaches

Other planned features (lower priority, all in CLAUDE.md):
- Stat-gated options (locked/hidden/altered choices based on stat thresholds)
- Multiple endings (outcome screens driven by final stat values)
- Randomised scheduling
- Improved visuals
