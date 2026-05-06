# Tomato Crawler 🍅

> A 2D procedurally generated dungeon crawler that IS your Pomodoro timer.

🌐 **Live Demo:** _https://\<your-username\>.github.io/TomatoCrawler/_ *(available after first deploy to `main`)*

---

## What is it?

You are **The Tomato**. You explore a dungeon. The dungeon is also your work timer.

- **Press ▶ Start** — The Tomato enters the dungeon and begins exploring autonomously
- **You go do your work** — The Tomato fights Breadknights and collects Olive Oil Flasks while you focus
- **Timer ends → break starts** — The dungeon pauses. You spend Sauce Points, equip loot, prep the next run
- **Repeat** — Deeper floors, harder enemies, better rewards

Your session settings shape the run. More tasks queued = harder dungeon = better loot. Leave early and The Tomato retreats in shame, losing a few items.

---

## Session Structure

| Phase | Duration | What happens |
|---|---|---|
| Focus / Run | 25 min | The Tomato explores the dungeon autonomously |
| Short Break / Upgrade | 5 min | You spend Sauce Points and equip items |
| Long Break | 15 min | *"The Tomato rests. Mysteriously."* — after every 4 runs |

---

## Session → Difficulty

| Setting | Effect |
|---|---|
| Session duration | Sets dungeon depth & floors available |
| Tasks queued | Raises enemy difficulty + reward multiplier |
| Tasks completed | Bonus loot drop at run end |
| Full session | Full Sauce Points + all loot kept + 🍅 +1 |
| Early exit | Retreat. No Sauce Points. Lose 1–3 items. |

---

## Dungeon Legend

### Tiles

| Symbol | Name | Description |
|---|---|---|
| 🟫 | **Wall** | Solid dungeon wall. Impassable. |
| 🟩 | **Floor** | Interior of a room. Safe to walk. |
| 🟪 | **Corridor** | Passage carved between rooms. The Tomato squeezes nervously. |
| 🚪 | **Entrance** | Player spawn marker on each floor. |
| 🪜 | **Stairs** | Descend to the next floor. The Tomato reluctantly obliges. |
| ⬛ | **Undiscovered** | Not yet revealed by fog of war. |

### Characters & Objects

| Symbol | Name | Description |
|---|---|---|
| 🍅 | **The Tomato** | Player character. Current position. Deadpan. Menacing. |
| 🍞 | **Breadknight** | Enemy type. Mockery of a medieval knight. |
| 🥒 | **Saucerer** | Enemy type. Wielder of questionable condiments. |
| 👹 | **Mouldy Goblin** | Enemy type. Clearly past its best-by date. |
| 🧙 | **Condiment Witch** | Enemy type. Foreboding presence. Spices unknown. |
| 💛 | **Loot** | Found items. See Items section for full list. |

### Items

Collect these during your run to boost character stats. Equip and combine during breaks to maximize power.

| Name | Stats Boosted | Description |
|---|---|---|
| **Crouton Shield** | +3 Defence | Slightly stale. Offers mild resistance. |
| **Olive Oil Flask** | +2 Speed | The Tomato moves faster. Suspiciously. |
| **Parchment of Mild Threat** | +2 Strength, +1 Defence | The words are concerning. Mostly. |
| **Stale Breadloaf** | +4 Strength | Dense. Heavy. Effective. |
| **Vinaigrette** | +3 Speed | Applied externally. Do not ask. |

### Fog of War

| Symbol | Name | Description |
|---|---|---|
| ⬛ | **Undiscovered** | Not yet revealed. Mystery awaits. |
| 👁️ | **Visible** | Currently visible to The Tomato. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game Framework | Phaser.js (v3) |
| Build Tool | Vite |
| Language | TypeScript |
| Desktop | Electron |
| Mobile | Capacitor (iOS / Android) |
| Runtime | Node.js |

---

## Release Ladder

| # | Platform | Status |
|---|---|---|
| 1️⃣ | **Web (GitHub Pages)** | 🎯 First target |
| 2️⃣ | Desktop via Electron | Planned |
| 3️⃣ | Mobile via Capacitor | Planned |

---

## Getting Started

```bash
# Install dependencies (includes canvas for placeholder generation)
npm install

# Generate placeholder assets
node scripts/generate-placeholders.js

# Start dev server
npm run dev

# Build for production
npm run build
```

Pushing to `main` automatically builds and deploys to GitHub Pages via GitHub Actions.

---

## Documentation

| File | Purpose |
|---|---|
| [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | Agent instructions, stack overview, mandatory rules |
| [`.github/plans/PLANNING_LOG.md`](.github/plans/PLANNING_LOG.md) | Rolling log of all planning sessions |
| [`.github/decisions/ADR_LOG.md`](.github/decisions/ADR_LOG.md) | Architecture decision records |

---

## Status

🟢 **All design decisions resolved** — ready for implementation.
Placeholder assets active (see [ADR-006](.github/decisions/ADR_LOG.md)). Game identity, Pomodoro cycle, session-driven difficulty, soft penalty, and HUD layer all defined and logged.
