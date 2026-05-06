/**
 * AssetManifest.ts
 * Single source of truth for ALL asset keys and paths.
 * Never reference asset paths or keys directly in game code — always use this file.
 */

export const AssetManifest = {
  // ─── Tiles ──────────────────────────────────────────────────────────────────
  tiles: {
    undiscovered: { key: 'tile-undiscovered', path: 'assets/placeholders/tile-undiscovered.png' },
    floor:        { key: 'tile-floor',        path: 'assets/placeholders/tile-floor.png' },
    wall:         { key: 'tile-wall',         path: 'assets/placeholders/tile-wall.png' },
    corridor:     { key: 'tile-corridor',     path: 'assets/placeholders/tile-corridor.png' },
    entrance:     { key: 'tile-entrance',     path: 'assets/placeholders/tile-entrance.png' },
  },

  // ─── Characters ─────────────────────────────────────────────────────────────
  player: { key: 'player', path: 'assets/placeholders/player.png' },

  // ─── Enemies ────────────────────────────────────────────────────────────────
  enemies: {
    breadknight:    { key: 'enemy-breadknight',     path: 'assets/placeholders/enemy-breadknight.png' },
    saucerer:       { key: 'enemy-saucerer',        path: 'assets/placeholders/enemy-saucerer.png' },
    mouldyGoblin:   { key: 'enemy-mouldy-goblin',   path: 'assets/placeholders/enemy-mouldy-goblin.png' },
    condimentWitch: { key: 'enemy-condiment-witch', path: 'assets/placeholders/enemy-condiment-witch.png' },
  },

  // ─── Base Gear (permanent, upgradeable, ∞ uses) ─────────────────────────────
  baseGear: {
    bruisedFist:       { key: 'item-bruised-fist',        path: 'assets/placeholders/item-base.png' },
    staleBaguetteClub: { key: 'item-stale-baguette-club', path: 'assets/placeholders/item-base.png' },
  },

  // ─── Found Items (consumable, finite uses, not upgradeable) ─────────────────
  foundItems: {
    oliveOilFlask:         { key: 'item-olive-oil-flask',       path: 'assets/placeholders/item-found.png' },
    croutonShield:         { key: 'item-crouton-shield',        path: 'assets/placeholders/item-found.png' },
    parchmentOfMildThreat: { key: 'item-parchment-mild-threat', path: 'assets/placeholders/item-found.png' },
    staleBreadloaf:        { key: 'item-stale-breadloaf',       path: 'assets/placeholders/item-found.png' },
    vinaigrette:           { key: 'item-vinaigrette',           path: 'assets/placeholders/item-found.png' },
    tomatoJuiceVial:       { key: 'item-tomato-juice-vial',     path: 'assets/placeholders/item-found.png' },
  },

  // ─── Side-View Scene backgrounds & pop-ins ──────────────────────────────────
  sideView: {
    roomBg:    { key: 'sideview-room-bg',    path: 'assets/placeholders/tile-floor.png' },
    corridorBg:{ key: 'sideview-corridor-bg',path: 'assets/placeholders/tile-corridor.png' },
    itemPopIn: { key: 'sideview-item-popin', path: 'assets/placeholders/item-found.png' },
    playerWalk:{ key: 'sideview-player',     path: 'assets/placeholders/player.png' },
  },

  // ─── UI ─────────────────────────────────────────────────────────────────────
  ui: {
    chest:  { key: 'ui-chest',  path: 'assets/placeholders/ui-chest.png' },
    exit:   { key: 'ui-exit',   path: 'assets/placeholders/ui-exit.png' },
    stairs: { key: 'ui-stairs', path: 'assets/placeholders/ui-stairs.png' },
  },
} as const;

// Derived union type of all asset keys — useful for type-safe lookups
export type AssetKey = string;
