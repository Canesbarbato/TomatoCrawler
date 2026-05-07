# 🍅 Tomato Crawler

> *A 2D procedurally generated dungeon crawler that IS your Pomodoro timer.*

[![Deploy to GitHub Pages](https://github.com/Canesbarbato/TomatoCrawler/actions/workflows/deploy.yml/badge.svg)](https://github.com/Canesbarbato/TomatoCrawler/actions/workflows/deploy.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Platform: Web](https://img.shields.io/badge/platform-Web%20%7C%20Electron%20%7C%20Capacitor-blue)

---

## What is Tomato Crawler?

**Tomato Crawler** is a Pomodoro productivity timer disguised as a dungeon crawler — or a dungeon crawler disguised as a Pomodoro timer. The lines are blurry. The tomato doesn't care.

You press ▶ **Start**. *The Tomato* — your character, a tomato, no other name — descends into a procedurally generated dungeon and explores it autonomously while you work. The game runs itself. You watch (or don't). When the focus session ends, you spend **Sauce Points**, equip loot, and start again.

No login. No setup. No separate timer app. The game IS the timer.

---

## Features

| Feature | Status |
|---|---|
| Procedural BSP dungeon generation | ✅ |
| Fog-of-war (undiscovered / visible / revealed) | ✅ |
| Autonomous player agent (exploration AI) | ✅ |
| Turn-based combat (Breadknights, Saucerers, etc.) | ✅ |
| Side-view combat scene | ✅ |
| Item pickups & inventory panel | ✅ |
| Character stats & levelling | ✅ |
| Pomodoro HUD (focus / short break / long break) | ✅ |
| Break overlay with Sauce Point spending | ✅ |
| Task panel (tasks queued → difficulty scaling) | ✅ |
| Event log (deadpan combat narration) | ✅ |
| Behaviour sliders (exploration bias) | ✅ |
| Session persistence via `localStorage` | ✅ |
| GitHub Pages auto-deploy (CI/CD) | ✅ |
| Desktop shell (Electron) | 🔒 Planned |
| Mobile shell (Capacitor) | 🔒 Planned |

---

## The Pomodoro Cycle

| Phase | Duration | What happens |
|---|---|---|
| **Focus / Run** | 25 min | The Tomato explores the dungeon autonomously |
| **Short Break / Upgrade** | 5 min | Spend Sauce Points, equip loot, review tasks |
| **Long Break** | 15 min | After every 4 completed runs — "The Tomato rests. Mysteriously." |

### Session → Difficulty Mapping

| Setting | Effect |
|---|---|
| Session duration | Sets dungeon depth and number of floors |
| Tasks queued | Raises enemy difficulty tier + reward multiplier |
| Tasks completed | Bonus loot drop at run end |
| Full session completed | Full Sauce Points, all loot kept, 🍅 counter +1 |
| Early exit (soft penalty) | Character retreats — no Sauce Points, 1–3 items lost |

---

## The World (Mockery Fantasy)

Nothing in Tomato Crawler takes itself seriously.

| Category | Examples |
|---|---|
| **Enemies** | Breadknight, Saucerer, Mouldy Goblin, The Condiment Witch |
| **Dungeon floors** | The Pantry, The Fridge Depths, The Forgotten Tupperware, The Spice Rack |
| **Items / loot** | Olive Oil Flask, Crouton Shield, Parchment of Mild Threat |
| **XP currency** | Sauce Points |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game framework | [Phaser.js](https://phaser.io/) |
| Build tool | [Vite](https://vitejs.dev/) |
| Language | TypeScript |
| Desktop shell | Electron *(planned)* |
| Mobile shell | Capacitor *(planned)* |
| CI/CD | GitHub Actions → GitHub Pages |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
# Clone the repo
git clone git@github.com:Canesbarbato/TomatoCrawler.git
cd TomatoCrawler

# Install dependencies
npm install

# Generate placeholder assets
node scripts/generate-placeholders.js

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`. The build is a fully static site — drop it anywhere.

---

## Project Structure

```
/
├── .github/
│   ├── copilot-instructions.md      ← agent rules & game design reference
│   ├── plans/PLANNING_LOG.md        ← rolling implementation log
│   ├── decisions/ADR_LOG.md         ← architecture decision records
│   └── workflows/deploy.yml         ← GitHub Actions: build + deploy to Pages
├── scripts/
│   └── generate-placeholders.js    ← generates all placeholder PNGs
├── src/
│   ├── game/
│   │   ├── agents/PlayerAgent.ts    ← autonomous exploration AI
│   │   ├── assets/AssetManifest.ts  ← single source of truth for all assets
│   │   ├── dungeon/                 ← BSP generator, tile renderer, types
│   │   ├── enemies/                 ← combat resolver, enemy registry & spawner
│   │   ├── fog/                     ← fog-of-war model & view
│   │   ├── items/                   ← item registry & types
│   │   ├── managers/RunManager.ts   ← run lifecycle management
│   │   ├── scenes/                  ← Phaser scenes (Boot, Game, SideView)
│   │   └── ui/                      ← all HUD and overlay components
│   └── shared/
│       ├── EventBus.ts              ← cross-system event bus
│       ├── PomodoroManager.ts       ← timer logic
│       ├── SessionStore.ts          ← localStorage persistence
│       └── StorageAdapter.ts        ← platform abstraction for storage
├── public/assets/placeholders/      ← 16×16 placeholder PNGs
├── index.html
├── package.json
└── vite.config.ts
```

---

## Asset System

All placeholder assets are `16×16px` PNGs generated by `scripts/generate-placeholders.js`.

| Asset type | Color |
|---|---|
| Undiscovered tile | `#000000` |
| Floor tile | `#888888` |
| Wall tile | `#4a3728` |
| Player (The Tomato) | `#4488ff` |
| Enemy | `#ff4444` |
| Item | `#ffdd00` |

To swap in real art: replace files in `public/assets/` and update paths in `src/game/assets/AssetManifest.ts`. No other code changes required.

---

## Deployment

The game auto-deploys to **GitHub Pages** on every push to `main` via GitHub Actions.

Live URL: `https://canesbarbato.github.io/TomatoCrawler/`

> **Web-first rule:** All features must work fully in a standard browser before being considered complete. Desktop (Electron) and mobile (Capacitor) layers add platform enhancements but are never required for core gameplay.

---

## Contributing

1. Read `.github/plans/PLANNING_LOG.md` before touching any game code
2. Read `.github/decisions/ADR_LOG.md` before making any architecture choices
3. Follow the **mockery fantasy** naming convention for all in-game text
4. All asset keys and paths must go through `src/game/assets/AssetManifest.ts`
5. Game logic must run identically in browser, Electron, and Capacitor

---

## License

MIT — do whatever you want with it. The Tomato has no strong feelings either way.
