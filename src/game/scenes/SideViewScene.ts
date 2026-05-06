/**
 * SideViewScene.ts
 *
 * A second Phaser scene rendered in #side-view-container (800×96 px).
 * Shows The Tomato walking continuously through a stylised environment.
 *
 * Phase 3.E additions:
 *   - Enemy slides in from the right on combatStarted
 *   - Enemy stat card (name, rank, HP bar, STR/DEF) rendered on right side
 *   - Player HP bar above player sprite
 *   - HP bars animate on combatTurnResolved
 *   - Damage floaters appear/fade on each turn
 *   - Attacker sprite flashes white for 120 ms
 *   - On player victory: enemy falls, stat card fades, movement resumes
 */

import Phaser from 'phaser';
import { AssetManifest } from '../assets/AssetManifest';
import { EventBus, EventBusMap } from '../../shared/EventBus';

const CANVAS_W  = 800;
const CANVAS_H  = 96;
const PLAYER_X  = CANVAS_W * 0.25;
const PLAYER_Y  = CANVAS_H * 0.55;
const ENEMY_X   = PLAYER_X + 120;
const SCROLL_SPEED = 0.8;

// HP bar geometry
const HP_BAR_W  = 60;
const HP_BAR_H  = 6;

export class SideViewScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.TileSprite;
  private playerSprite!: Phaser.GameObjects.Image;
  private walkTween!: Phaser.Tweens.Tween;
  private shadowTween!: Phaser.Tweens.Tween;
  private isMoving = false;

  // ── Combat UI objects ──────────────────────────────────────────────────────
  private enemyCombatSprite?: Phaser.GameObjects.Image;
  private enemyStatCard?: Phaser.GameObjects.Container;
  private enemyHpFill?: Phaser.GameObjects.Rectangle;
  private enemyMaxHp = 1;

  private playerHpContainer?: Phaser.GameObjects.Container;
  private playerHpFill?: Phaser.GameObjects.Rectangle;
  private playerMaxHp = 100;

  // Bound listener references stored for cleanup
  private onContextChangedBound!:    (ctx: EventBusMap['contextChanged']) => void;
  private onItemPickedUpBound!:      (item: EventBusMap['itemPickedUp']) => void;
  private onMovementChangedBound!:   (moving: EventBusMap['movementChanged']) => void;
  private onCombatStartedBound!:     (data: EventBusMap['combatStarted']) => void;
  private onCombatTurnResolvedBound!:(data: EventBusMap['combatTurnResolved']) => void;
  private onCombatEndedBound!:       (data: EventBusMap['combatEnded']) => void;

  constructor() { super({ key: 'SideViewScene' }); }

  // ─── Preload ───────────────────────────────────────────────────────────────

  preload(): void {
    const { sideView, enemies } = AssetManifest;
    this.load.image(sideView.roomBg.key,    sideView.roomBg.path);
    this.load.image(sideView.corridorBg.key,sideView.corridorBg.path);
    this.load.image(sideView.itemPopIn.key, sideView.itemPopIn.path);
    this.load.image(sideView.playerWalk.key,sideView.playerWalk.path);
    for (const enemy of Object.values(enemies)) {
      this.load.image(enemy.key, enemy.path);
    }
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  create(): void {
    this.background = this.add
      .tileSprite(0, 0, CANVAS_W, CANVAS_H, AssetManifest.sideView.roomBg.key)
      .setOrigin(0, 0).setAlpha(1);

    const ground = this.add.graphics();
    ground.lineStyle(1, 0x444444, 0.6);
    ground.moveTo(0, CANVAS_H - 18).lineTo(CANVAS_W, CANVAS_H - 18);
    ground.strokePath();
    ground.setDepth(1);

    this.playerSprite = this.add
      .image(PLAYER_X, PLAYER_Y, AssetManifest.sideView.playerWalk.key)
      .setOrigin(0.5, 0.5).setDepth(3).setScale(4);

    this.walkTween = this.tweens.add({
      targets: this.playerSprite, y: PLAYER_Y + 4,
      duration: 260, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', paused: true,
    });

    const shadow = this.add.ellipse(PLAYER_X, CANVAS_H - 14, 14, 4, 0x000000, 0.35).setDepth(2);
    this.shadowTween = this.tweens.add({
      targets: shadow, scaleX: 0.6,
      duration: 260, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', paused: true,
    });

    this.add.text(CANVAS_W - 8, 6, 'The Tomato ventures forth.', {
      fontFamily: 'monospace', fontSize: '9px', color: '#666666',
    }).setOrigin(1, 0).setDepth(4);

    // ── EventBus wiring ────────────────────────────────────────────────────
    this.onContextChangedBound    = (ctx)  => this.onContextChanged(ctx);
    this.onItemPickedUpBound      = (item) => this.onItemPickedUp(item);
    this.onMovementChangedBound   = (m)    => this.onMovementChanged(m);
    this.onCombatStartedBound     = (d)    => this.onCombatStarted(d);
    this.onCombatTurnResolvedBound= (d)    => this.onCombatTurnResolved(d);
    this.onCombatEndedBound       = (d)    => this.onCombatEnded(d);

    EventBus.on('contextChanged',    this.onContextChangedBound);
    EventBus.on('itemPickedUp',      this.onItemPickedUpBound);
    EventBus.on('movementChanged',   this.onMovementChangedBound);
    EventBus.on('combatStarted',     this.onCombatStartedBound);
    EventBus.on('combatTurnResolved',this.onCombatTurnResolvedBound);
    EventBus.on('combatEnded',       this.onCombatEndedBound);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.on(Phaser.Scenes.Events.DESTROY,  this.cleanup, this);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(): void {
    if (this.isMoving) this.background.tilePositionX += SCROLL_SPEED;
  }

  // ─── EventBus handlers — movement / context ───────────────────────────────

  private onContextChanged(ctx: 'room' | 'corridor'): void {
    const newKey = ctx === 'corridor'
      ? AssetManifest.sideView.corridorBg.key
      : AssetManifest.sideView.roomBg.key;
    this.tweens.add({
      targets: this.background, alpha: 0, duration: 200, ease: 'Linear',
      onComplete: () => {
        this.background.setTexture(newKey);
        this.tweens.add({ targets: this.background, alpha: 1, duration: 250, ease: 'Linear' });
      },
    });
  }

  private onItemPickedUp(_item: EventBusMap['itemPickedUp']): void {
    const sprite = this.add
      .image(PLAYER_X + 8, PLAYER_Y - 4, AssetManifest.sideView.itemPopIn.key)
      .setOrigin(0.5, 0.5).setDepth(6).setScale(1.2);
    this.tweens.add({
      targets: sprite, y: PLAYER_Y - 36, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 650, ease: 'Quad.easeOut', onComplete: () => sprite.destroy(),
    });
  }

  private onMovementChanged(moving: boolean): void {
    this.isMoving = moving;
    if (moving) {
      this.walkTween.resume();
      this.shadowTween.resume();
    } else {
      this.walkTween.pause();
      this.shadowTween.pause();
      this.playerSprite.setY(PLAYER_Y);
    }
  }

  // ─── EventBus handlers — combat ───────────────────────────────────────────

  private onCombatStarted(data: EventBusMap['combatStarted']): void {
    this.isMoving = false;
    this.walkTween.pause();
    this.shadowTween.pause();
    this.playerSprite.setY(PLAYER_Y);

    this.enemyMaxHp  = data.enemy.hp;
    this.playerMaxHp = data.playerHp > 0 ? data.playerHp : 100;

    // ── Enemy sprite slides in from right ─────────────────────────────────
    const enemyKey = data.enemy.key;
    if (this.textures.exists(enemyKey)) {
      this.enemyCombatSprite?.destroy();
      this.enemyCombatSprite = this.add
        .image(CANVAS_W + 16, PLAYER_Y, enemyKey)
        .setOrigin(0.5, 0.5).setDepth(4).setScale(4);
      this.tweens.add({
        targets: this.enemyCombatSprite,
        x: ENEMY_X, duration: 400, ease: 'Quad.easeOut',
      });
    }

    // ── Enemy stat card ───────────────────────────────────────────────────
    this.enemyStatCard?.destroy();
    const CARD_X = ENEMY_X + 30;
    const CARD_Y = 6;
    const container = this.add.container(CARD_X, CARD_Y).setDepth(8);

    const bg = this.add.rectangle(0, 0, 90, 44, 0x000000, 0.7).setOrigin(0, 0);
    const nameText = this.add.text(4, 4, data.enemy.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffffff',
    });
    const rankText = this.add.text(4, 14, `★ ${data.enemy.rank}`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffdd00',
    });
    // HP bar background
    const hpBg   = this.add.rectangle(4, 25, HP_BAR_W, HP_BAR_H, 0x660000).setOrigin(0, 0);
    // HP bar fill (mutable)
    const hpFill = this.add.rectangle(4, 25, HP_BAR_W, HP_BAR_H, 0xff2222).setOrigin(0, 0);
    const statText = this.add.text(4, 34, `STR ${data.enemy.strength}  DEF ${data.enemy.defence}`, {
      fontFamily: 'monospace', fontSize: '7px', color: '#aaaaaa',
    });

    container.add([bg, nameText, rankText, hpBg, hpFill, statText]);
    this.enemyStatCard = container;
    this.enemyHpFill   = hpFill;

    // ── Player HP bar ─────────────────────────────────────────────────────
    this.playerHpContainer?.destroy();
    const phc = this.add.container(PLAYER_X - HP_BAR_W / 2, PLAYER_Y - 22).setDepth(8);
    const phpBg   = this.add.rectangle(0, 0, HP_BAR_W, HP_BAR_H, 0x004400).setOrigin(0, 0);
    const phpFill = this.add.rectangle(0, 0, HP_BAR_W, HP_BAR_H, 0x22cc44).setOrigin(0, 0);
    const phpLabel= this.add.text(0, -9, '❤ HP', {
      fontFamily: 'monospace', fontSize: '7px', color: '#22cc44',
    });
    phc.add([phpBg, phpFill, phpLabel]);
    this.playerHpContainer = phc;
    this.playerHpFill      = phpFill;
  }

  private onCombatTurnResolved(data: EventBusMap['combatTurnResolved']): void {
    const { entry, state } = data;

    // Determine which sprite to flash and where the floater appears
    const attackerSprite = entry.attacker === 'player' ? this.playerSprite : this.enemyCombatSprite;
    const defenderX      = entry.attacker === 'player' ? ENEMY_X  : PLAYER_X;
    const defenderY      = PLAYER_Y - 14;
    const floaterColor   = entry.attacker === 'player' ? '#ffdd00' : '#ff4444';

    // ── Attacker flash (120 ms white tint) ────────────────────────────────
    if (attackerSprite) {
      attackerSprite.setTint(0xffffff);
      this.time.delayedCall(120, () => attackerSprite?.clearTint());
    }

    // ── HP bar tweens ─────────────────────────────────────────────────────
    if (entry.attacker === 'player' && this.enemyHpFill) {
      const ratio = Math.max(0, state.enemy.currentHp / this.enemyMaxHp);
      this.tweens.add({
        targets: this.enemyHpFill, scaleX: ratio,
        duration: 300, ease: 'Linear',
      });
    }
    if (entry.attacker === 'enemy' && this.playerHpFill) {
      const ratio = Math.max(0, state.playerHp / this.playerMaxHp);
      this.tweens.add({
        targets: this.playerHpFill, scaleX: ratio,
        duration: 300, ease: 'Linear',
      });
    }

    // ── Damage floater ────────────────────────────────────────────────────
    const floater = this.add.text(defenderX, defenderY, `-${entry.damage}`, {
      fontFamily: 'monospace', fontSize: '10px', color: floaterColor,
    }).setOrigin(0.5, 1).setDepth(10).setAlpha(0);

    this.tweens.add({
      targets: floater, y: defenderY - 20, alpha: 1,
      duration: 250, ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: floater, alpha: 0, duration: 450, ease: 'Linear',
          onComplete: () => floater.destroy(),
        });
      },
    });
  }

  private onCombatEnded(data: EventBusMap['combatEnded']): void {
    if (data.outcome === 'player_won') {
      // Enemy falls off bottom
      if (this.enemyCombatSprite) {
        this.tweens.add({
          targets: this.enemyCombatSprite,
          angle: 90, y: CANVAS_H + 32,
          duration: 400, ease: 'Quad.easeIn',
          onComplete: () => {
            this.enemyCombatSprite?.destroy();
            this.enemyCombatSprite = undefined;
          },
        });
      }
      // Stat card fades
      if (this.enemyStatCard) {
        this.tweens.add({
          targets: this.enemyStatCard, alpha: 0, duration: 300, ease: 'Linear',
          onComplete: () => {
            this.enemyStatCard?.destroy();
            this.enemyStatCard = undefined;
          },
        });
      }
    } else {
      // enemy_won stub
      this.enemyCombatSprite?.destroy();
      this.enemyCombatSprite = undefined;
      this.enemyStatCard?.destroy();
      this.enemyStatCard = undefined;
      console.warn('[SideViewScene] enemy_won stub — resuming.');
    }
    // Resume movement
    this.isMoving = true;
    this.walkTween.resume();
    this.shadowTween.resume();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  private cleanup(): void {
    EventBus.off('contextChanged',    this.onContextChangedBound);
    EventBus.off('itemPickedUp',      this.onItemPickedUpBound);
    EventBus.off('movementChanged',   this.onMovementChangedBound);
    EventBus.off('combatStarted',     this.onCombatStartedBound);
    EventBus.off('combatTurnResolved',this.onCombatTurnResolvedBound);
    EventBus.off('combatEnded',       this.onCombatEndedBound);
  }
}
