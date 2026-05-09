# The Wenching Hour — Project Guide for Claude Code

##Preferences

- Unless asked, provide implementations without lengthy explanations

---

## What This Game Is

A dialogue-focused, choice-based game in the vein of Papers Please, Yes Your Grace, and Reigns. The player is a wench (implied to be a witch) who hears problems from NPCs over several days and chooses how to respond. Responses affect five stats that determine endings. The tone is dark, witty, and grounded in a medieval setting.

---

## How the Game Loads

`index.html` fetches `dialogue.json` asynchronously on startup:

```js
let GAME_DATA = null;
let NPCS = {};
let SCHEDULE = [];

async function loadGameData() {
  const response = await fetch("dialogue.json");
  GAME_DATA = await response.json();
  NPCS = GAME_DATA.npcs;
  SCHEDULE = GAME_DATA.schedule;
  validateConfig();
  startGame();
}
```

All game content is driven by the JSON. Logic lives in the HTML. Keep these concerns separated — content goes in `dialogue.json`, behaviour goes in `index.html`.

---

## dialogue.json Schema

### `config`
Controls the game's overall shape:
```json
"config": {
  "days": 3,
  "npcs_per_day": 5
}
```

### `npcs`
Each NPC is a keyed object. Keys are the NPC's name (used as display name and as the reference in `schedule`):
```json
"Farmer": {
  "desc": "Short flavour text shown to the player.",
  "visual": {
    "portrait": "images/filename.png",
    "color": "#hexcode"
  },
  "choices": {
    "A": {
      "text": "Button label",
      "effects": { "power": -10, "suspicion": 15 },
      "next": {
        "desc": "NPC response line shown after this choice.",
        "choices": {
          "A": { "text": "Button label", "effects": { "royalty": 10, "populace": 20, "kingdom": 20, "power": 0, "suspicion": -5 } },
          "B": { "text": "Button label", "effects": { "royalty": 5, "populace": 10, "kingdom": 15, "power": 0, "suspicion": 5 } }
        }
      }
    },
    "B": { "text": "Button label", "effects": { ... } },
    "C": { "text": "Button label", "effects": { ... } },
    "D": { "text": "Button label", "effects": { ... } }
  }
}
```

### Condition Predicates
```json
// Stat threshold
{ "stat": "suspicion", "op": ">", "value": 70 }

// Prior choice (any visit)
{ "chose": { "npc": "Farmer", "choice": "A" } }

// Prior choice (most recent visit only)
{ "chose": { "npc": "Farmer", "choice": "A", "last": true } }

// Prior visits count (0 = first meeting)
{ "visits": { "op": "==", "value": 0 } }
// Shorthand for equality:
{ "visits": 2 }

// Day number (1-indexed)
{ "day": { "op": ">=", "value": 2 } }
// Shorthand:
{ "day": 3 }

// Combinators
{ "and": [{ ... }, { ... }] }
{ "or":  [{ ... }, { ... }] }
{ "not": { ... } }
```

### How Conditions Attach
Variants contains all aspects of an NPC besides its name. Used to swap between NPC variants such as different choices/visuals/dialogue for day 2.
First match wins, last entry is default (no if):

```json
"variants": [
{
  "if" {conditions here}
  all npc variant content
}
{
repeat for variant 2
}
]

Text fields (desc, next.desc, choice text) become variant arrays — first match wins, last entry is default (no if):

"desc": [
  { "if": { "chose": { "npc": "Farmer", "choice": "A" } }, "text": "You again! I took your advice..." },
  { "if": { "stat": "suspicion", "op": ">", "value": 70 },     "text": "I've heard rumours about you..." },
  { "text": "Evenin' to ye." }
]

Choice gating — inline if on the choice object. Fails → hidden. Add "showLocked": true to grey it out instead:

"choices": {
  "A": { "text": "Help him", "effects": { "royalty": 5, ... } },
  "B": { "text": "Cast a spell", "if": { "stat": "power", "op": ">=", "value": 30 }, "effects": { "power": -10, ... },
  "showLocked": true }
}

Conditional effects — variant array on effects:

"effects": [
  { "if": { "stat": "power", "op": ">", "value": 50 }, "royalty": 20, "suspicion": -10, "populace": 0, "kingdom": 0,
"power": 0 },
  { "royalty": 10, "suspicion": -5, "populace": 0, "kingdom": 0, "power": 0 }
]
```

---
JS State Needed

let choiceHistory = {};  // { "Farmer": ["A", "B"], "Guard": ["C"] }

Appended to on every choice (root and branch). chose predicate checks the array. last: true checks only the last
element.

- Root-level NPC choices are always exactly **4: A, B, C, D**
- Branch node choices (`next.choices`) can use any keys and any count
- `next` on a choice is optional — if present, the choice leads to a follow-up exchange instead of ending the encounter
- `next.desc` is the NPC's response line; `next.choices` are the new options presented to the player
- Branch nodes can nest to arbitrary depth — any choice at any level can have its own `next`
- `effects` is optional on choices that have `next`; apply partial effects mid-conversation or omit entirely
- `desc` is a one-to-two sentence hook describing the NPC's problem
- `portrait` is a path relative to the project root to load an image for the NPC
- `color` is a hex accent colour used in the NPC's UI treatment

### `schedule`
A 2D array — one array per day, each containing NPC name strings. These are used to determine the order and days NPCs show up in:
```json
"schedule": [
["Farmer", "Guard", "Farmer", "Noble", "Guard"],
["Noble", "Farmer", "Guard", "Guard", "Farmer"],
["Guard", "Noble", "Farmer", "Noble", "Farmer"]
]
```
- The schedule is **fixed, not randomised** (randomisation may come later)
- The length of each sub-array must match `config.npcs_per_day`
- NPC names in the schedule must exactly match keys in `npcs`

---

## Stats System

Five stats, all clamped to **0–100**:

| Stat | Starts At | 100 = | 0 = |
|---|---|---|---|
| `royalty` | 50 | Great royal favour | Exiled |
| `populace` | 50 | Beloved by the people | Hated / driven out |
| `kingdom` | 50 | Prosperous kingdom | Collapsed kingdom |
| `power` | 0 | Full magical strength | No power |
| `suspicion` | 50 | Fully exposed as a witch | Hidden / safe |

**Suspicion is inverted** — 100 is the worst outcome, 0 is the best. Keep this in mind when writing NPC effects and any UI indicators.

Effects in `dialogue.json` use these exact key names: `royalty`, `populace`, `kingdom`, `power`, `suspicion`.

Positive values increase the stat; negative values decrease it. The stat must always be clamped after applying effects.

---

## Current Game State & Planned Features

### Working now
- Linear NPC encounters driven by the schedule
- Four choices per NPC with stat effects
- NPC portraits and accent colours
- Individual conversation branching dialogue
- Follow through branching dialogue -  NPC dialogue and dialogue options can change based on conditions
- Stat-gated options - choices that are locked, hidden, or altered based on conditions
- Conditional NPC text - text that changes based on conditions
- dialogue editor in /dialogue-editor consisting of editor.html, editor.css, editor.js - Used for designers to edit and generate dialogue.json files without having to code

### Planned (not yet implemented — check with me before building)
- **Multiple endings** — outcome screens driven by final stat values
- **Randomised scheduling** — optional shuffling of the daily NPC order
- **Improved visuals** — richer UI, animations, transitions

---

## Conventions

- **JSON keys use camelCase for structure, lowercase for stat names** (`royalty`, not `Royalty`)
- **NPC names are Title Case** and are used as both the display name and the schedule key
- **Do not rename stat keys** — they are referenced by string throughout the JS
- **Portrait images** go in `/images/` and are referenced from the root (e.g. `images/truffle.png`)
- When adding new features to `index.html`, keep game logic functions grouped separately from rendering functions

---

## Tone & Writing Style (for NPC content)

- Medieval setting, dark and witty
- NPC `desc` should be flavourful but brief — one or two punchy sentences
