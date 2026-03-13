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
| Player HP | Implemented | Minimal top-left HP value (`current/max HP`) | `updateHud()` |
| XP bar | Implemented | Horizontal XP bar + `EXP current/next` text | `updateHud()` |
| Level indicator | Partial | Level is used in progression/modal but not pinned as persistent HUD text | `openLevelUpChoices()`, `gainXp()` |
| Dash cooldown indicator | Implemented | Player-near circular cooldown ring (ready pulse + charge arc) | `updateDashCooldownRing()`, `Player.getDashRatio()` |
| Weapon slots | Implemented | Top-center slot row with equipped weapon initials | `updateHud()`, `player.weapons` |
| Gold counter | Partial | Dedicated in-run `GOLD` widget added; meta bank is still menu/summary context | `updateHud()`, `calculateRunCoinReward()` |
| Run timer | Implemented | `PLAYTIME mm:ss` shown in top-left stats line | `updateHud()`, `formatRunTime()` |
| Boss warning indicator | Implemented | Top-center alert text + camera shake | `showHudAlert()`, `spawnBossEnemy()` |
| Boss HP bar | Not Implemented | No boss-specific HP overlay widget | N/A |
| Damage numbers | Implemented | Floating damage numbers with pooled text objects | `spawnDamageNumber()`, `Enemy.takeDamage()` |
| Enemy HP bars | Implemented | In-world HP bars for damaged enemies + elite/boss emphasis | `updateEnemyHealthBars()` |
| Pickup indicators (XP/gold) | Partial | XP orb + elite upgrade orb visual pickup implemented; gold pickup widget 없음 | `spawnXpOrb()`, `handleXpOrbPickup()` |
| Debug overlay | Implemented | `F2` toggled director/debug metrics panel, separate from player HUD | `updateDebugDirectorOverlay()`, `toggleDebugOverlay()` |
| Low HP danger vignette | Implemented | Screen-edge red vignette scales with HP danger state | `updateLowHealthVignette()` |

## Implementation Targets

### HUD Layout Targets (Current + Delta)
- Top-left:
  - `HP`, `PLAYTIME`, `EXP current/next` (implemented)
  - Keep as primary combat snapshot (implemented)
- Top-center:
  - Weapon slot row (implemented)
- Top-right:
  - Dedicated `Gold` counter (implemented)
  - Optional secondary run context only (planned)
- Bottom-right:
  - System controls / pause affordance (planned)
- Around player:
  - Dash cooldown ring with ready pulse (implemented)
- Bottom-left:
  - Control hint overlay (implemented as lightweight DOM helper)
- Center overlays:
  - Level-up selection (implemented)
  - Start weapon selection (implemented)
  - Boss/miniboss warning text (implemented)
  - Run-end summary scene (implemented)

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
- [x] Debug metrics are separated to toggled overlay (`F2`) and not mixed into core HUD.
- [x] Level-up modal pauses gameplay and resumes cleanly.
- [x] Boss/miniboss warning events are visible and time-bound.
- [x] Mobile touch controls for move/dash are visible and functional.
- [x] Run timer (`PLAYTIME`) is shown in persistent HUD.
- [ ] Add dedicated gold counter separate from `META` summary.
- [x] Add dedicated in-run gold widget (meta bank remains outside core HUD).
- [ ] Add boss HP overlay bar.
- [x] Add weapon slot row.
- [x] Add floating damage numbers.
- [x] Add enemy HP bars with elite/boss readability emphasis.
- [x] Add low-HP danger vignette.

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
