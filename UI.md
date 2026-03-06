# UI.md — DashSurvivor Agentic UI Spec

## Context
- DashSurvivor is a top-down survivor-like action game.
- Design target run length is 7–10 minutes.
- Current code loop is death-based (no hard run-end timer yet).
- UI priority: fast combat readability with minimal screen obstruction.
- Source of truth: `src/scenes/GameScene.js`, `src/entities/Player.js`, `src/Systems/WeaponSystem.js`, `src/Systems/DirectorSystem.js`, `src/Systems/MetaProgressionSystem.js`.

## Systems

### Core UI System Inventory (Code-Synced)
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Player HP | Implemented | `LV/HP/DIR` text + HP value in top-left line | `updateHud()` |
| XP bar | Implemented | Horizontal XP bar + `XP current/next` text | `updateHud()` |
| Level indicator | Implemented | `LV` text + level-up panel | `updateHud()`, `openLevelUpChoices()` |
| Dash cooldown indicator | Implemented | Dash bar + status text (`Charging/Active/Ready`) | `updateHud()`, `Player.getDashRatio()` |
| Weapon slots | Partial | `WPN used/max` text only (no slot icons) | `updateHud()`, `player.weapons` |
| Gold counter | Partial | `META` total shown (meta currency), no dedicated gold-only widget | `updateHud()`, `runMetaCurrency` |
| Run timer | Not Implemented | Runtime exists (`runTimeMs`) but no on-screen timer | `update()` |
| Boss warning indicator | Implemented | Top-center alert text + camera shake | `showHudAlert()`, `spawnBossEnemy()` |
| Boss HP bar | Not Implemented | No boss-specific HP overlay widget | N/A |
| Damage numbers | Not Implemented | Hit flash/particles exist, numeric popup 없음 | `Enemy.takeDamage()` |
| Pickup indicators (XP/gold) | Partial | XP orb + elite upgrade orb visual pickup implemented; gold pickup widget 없음 | `spawnXpOrb()`, `handleXpOrbPickup()` |

## Implementation Targets

### HUD Layout Targets (Current + Delta)
- Top-left:
  - `HP` + `LV` + `DIR` (implemented)
  - Keep as primary combat snapshot (implemented)
- Top-center:
  - `XP` progress bar and level context (implemented via top-left + bar row)
  - Optional move of level text to center (planned)
- Top-right:
  - Dedicated `Gold` counter (planned)
  - `Run timer` (`mm:ss`) (planned)
- Bottom-right:
  - Dash cooldown indicator (implemented as bar + text)
  - Circular dash icon indicator (planned)
- Bottom-left:
  - Weapon slots with icons (planned)
- Center overlays:
  - Level-up selection (implemented)
  - Boss/miniboss warning text (implemented)
  - Run-end summary (implemented: Game Over + meta summary)

### Pixel-UI Direction (Planned)
- HUD chrome should snap to a `16px` sub-grid even if gameplay art uses a `32px` world grid.
- Use 1px or 2px integer borders only; avoid soft gradients that blur against pixel sprites.
- Keep font rendering crisp and high-contrast so HUD survives camera motion and enemy density.
- Prefer simple icon silhouettes derived from the same palette family as the world art.

### Free Reference Direction
- [Kenney UI packs](https://kenney.nl/assets?q=ui) are acceptable starting points for buttons / frames because the licensing is CC0.
- Runtime crispness should follow [Phaser pixel art guidance](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture#pixel-art-and-rounding).

### Implementation Checklist
- [x] HUD text + bars update every frame from live game state.
- [x] Level-up modal pauses gameplay and resumes cleanly.
- [x] Boss/miniboss warning events are visible and time-bound.
- [x] Mobile touch controls for move/dash are visible and functional.
- [ ] Add dedicated run timer widget (`runTimeMs -> mm:ss`).
- [ ] Add dedicated gold counter separate from `META` summary.
- [ ] Add boss HP overlay bar.
- [ ] Add weapon slot icon row.
- [ ] Add floating damage numbers.

## Validation Checklist
- [ ] HP UI changes immediately when player takes collision/poison damage.
- [ ] XP bar and XP text increase on orb pickup and level progression occurs correctly.
- [ ] Dash UI transitions: `Charging -> Ready -> Active -> Charging`.
- [ ] Level-up modal appears at threshold, blocks movement, exits after selection.
- [ ] Boss warning appears on boss spawn and miniboss event.
- [ ] Game Over overlay shows run meta summary and restart input works.
- [ ] Mobile joystick + dash button input works without blocking HUD updates.

## Debug / Failure Points
- HP not syncing:
  - Check `Player.takeDamage()` and `GameScene.updateHud()` path.
- XP desync during rapid pickup:
  - Check `handleXpOrbPickup() -> gainXp()` loop and `xpToNext` rollover.
- Dash indicator not resetting:
  - Check `Player.tryDash()`, `Player.updateDash()`, `Player.getDashRatio()`.
- Boss warning missing:
  - Check `DirectorSystem.consumeBossSpawnRequests()` and `spawnBossEnemy()`.
- Level-up soft-lock:
  - Check `openLevelUpChoices()`, `closeLevelUpChoices()`, `physics.pause/resume`.
- UI flicker/perf drops during heavy combat:
  - Check particle load scaling and `updateHud()` string churn.

## Next Iteration Hooks
- Add elite-specific HUD marker (beyond tint/scale in-world).
- Add dedicated damage-number popup pool.
- Add compact boss HP overlay with variant label (`BOSS` / `MINI BOSS`).
- Add optional minimap only if map size/scroll complexity increases.
