# The Wenching Hour — Project Guide for Claude Code

## What This Game Is

A dialogue-focused, choice-based game in the vein of Papers Please, Yes Your Grace, and Reigns. The player is a wench (implied to be a witch) who hears problems from NPCs over several days and chooses how to respond. Responses affect five stats that determine endings. The tone is dark, witty, and grounded in a medieval setting.

---

## File Structure

```
/
├── index.html        # All game logic, rendering, and state management
├── dialogue.json     # All game content: config, NPCs, and the daily schedule
└── images/           # NPC portraits and any other visual assets
```

**There are no separate JS or CSS files — everything lives in index.html for now.** Do not split files without asking and receiving confirmation from the user.

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
    "A": { "text": "Button label", "effects": { ... } },
    "B": { "text": "Button label", "effects": { ... } },
    "C": { "text": "Button label", "effects": { ... } },
    "D": { "text": "Button label", "effects": { ... } }
  }
}
```

- Each NPC always has exactly **4 choices: A, B, C, D**
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
| `suspicion` | 50 | ⚠️ Fully exposed as a witch | Hidden / safe |

**Suspicion is inverted** — 100 is the worst outcome, 0 is the best. Keep this in mind when writing NPC effects and any UI indicators.

Effects in `dialogue.json` use these exact key names: `royalty`, `populace`, `kingdom`, `power`, `suspicion`.

Positive values increase the stat; negative values decrease it. The stat must always be clamped after applying effects.

---

## Current Game State & Planned Features

### Working now
- Linear NPC encounters driven by the schedule
- Four choices per NPC with stat effects
- NPC portraits and accent colours

### Planned (not yet implemented — check with me before building)
- **Individual conversation branching dialogue** — choices leading to follow-up exchanges before the final effect
- **Follow through branching dialogue** - NPC dialogue and dialogue options can change based on previous decisions or current stats
- **Stat-gated options** — choices that are locked, hidden, or altered based on current stat values
- **Conditional NPC text** — `desc` or choice labels that change based on player state
- **Multiple endings** — outcome screens driven by final stat values
- **Randomised scheduling** — optional shuffling of the daily NPC order
- **Improved visuals** — richer UI, animations, transitions

---

## Conventions

- **JSON keys use camelCase for structure, lowercase for stat names** (`royalty`, not `Royalty`)
- **NPC names are Title Case** and are used as both the display name and the schedule key
- **Do not rename stat keys** — they are referenced by string throughout the JS
- **Always validate** that any new NPC added to `npcs` has all five stat keys in every choice's `effects`, even if the value is `0`
- **Portrait images** go in `/images/` and are referenced from the root (e.g. `images/truffle.png`)
- When adding new features to `index.html`, keep game logic functions grouped separately from rendering functions

---

## Tone & Writing Style (for NPC content)

- Medieval setting, dark and witty
- NPC `desc` should be flavourful but brief — one or two punchy sentences
- Choice labels should feel like real decisions, not just "good/neutral/bad" — moral ambiguity is intentional
- The player is never told their stats directly in the dialogue; choices should feel grounded in the world, not gamey
