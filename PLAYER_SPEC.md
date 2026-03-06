# PLAYER_SPEC.md — DashSurvivor Agentic Player Spec

## Context
- Player is the survivor avatar in a top-down ship-deck arena.
- Core feel target is responsive movement + dash timing under sustained enemy pressure.
- Current runtime uses direct physics velocity control, dash gauge charging, overlap-based contact damage, and level-up pause flow.
- Source of truth: `src/entities/Player.js`, `src/scenes/GameScene.js`, `src/Systems/WeaponSystem.js`, `src/Systems/MetaProgressionSystem.js`.

## Systems

### Core Player Runtime Systems (Code-Synced)
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Movement | Implemented | 8-direction normalized velocity | `Player.moveFromInput()` |
| Dash | Implemented | Gauge-based dash with invulnerability window + contact damage interaction | `Player.tryDash()`, `GameScene.handlePlayerEnemyCollision()` |
| Auto combat | Implemented | WeaponSystem auto-fire + scene auto-attack fallback | `WeaponSystem.update()`, `GameScene.performAutoAttack()` |
| Damage / HP | Implemented | Contact damage with 400ms damage gate | `Player.takeDamage()` |
| XP collection | Implemented | Magnet pull within pickup radius | `GameScene.pullXpOrbsToPlayer()` |
| Level-up pause | Implemented | Physics pause -> choose 1 of 3 upgrades -> resume | `openLevelUpChoices()`, `closeLevelUpChoices()` |
| Run end | Implemented | Player death triggers game-over overlay and restart flow | `triggerGameOver()` |

### Player Base Stats (Current)
| Stat | Current Value | Notes |
|---|---:|---|
| Max Health | 100 | Meta upgrades can increase |
| Move Speed | 200 | +meta and level-up movement upgrades |
| Dash Cooldown | 4000ms | Implemented via dash gauge recharge |
| Dash Duration | 250ms | `dashRemainingMs` |
| Dash Speed Multiplier | 4x | Velocity = `speed * 4` |
| Dash Invulnerability | 200ms | `isDashInvulnerable()` check |
| Dash Contact Damage | 20 | Applied once per enemy per dash id |
| Base Pickup Radius | 140 | +40 upgrade and +6 per level magnet bonus |
| Weapon Slots | 3 | Player-owned weapon slot cap |

### Input Contract (Current)
- Keyboard:
  - Movement: `W/A/S/D`
  - Dash: `SPACE`
  - Restart: `R`
- Touch:
  - Virtual joystick for movement
  - Dash button tap for dash
- Arrow key movement is not currently bound.

### Collision / Boundaries
- Player body:
  - circular collision (`setCircle(16, 0, 0)`)
  - world boundary lock (`setCollideWorldBounds(true)`)
- Collides with terrain obstacles via static colliders.
- Enemy damage is overlap-driven (contact), not hard-body push collision.
- Dash respects world/obstacle constraints through existing physics collision.

### Pixel-Grid Player Art Target (Planned)
| Item | Target | Notes |
|---|---|---|
| Base sprite size | `32x32` | Match current top-down readability and movement speed |
| Facing set | 4-dir minimum, 8-dir optional | Do not block current 8-direction movement if art remains 4-dir |
| Dash smear / afterimage | `32x32` additive frame or short trail | Keep effect readable without hiding hitbox center |
| Collision | Smaller than sprite silhouette | Preserve current `setCircle(16)` gameplay feel |
| Palette | warm brass / cloth accent | Player must stay readable against dark deck and cool enemies |

### Free Source Direction
- Prefer building the player from a small custom `32x32` sprite sheet or CC0 pirate-adjacent base pieces from [Kenney Pirate Pack](https://kenney.nl/assets/pirate-pack).
- Use [Phaser pixel art guidance](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture#pixel-art-and-rounding) as the rendering baseline for crisp output.
- Avoid mixing multiple free packs with different outline thickness unless the palette and line weight are normalized first.

## Implementation Targets
- Player entity required fields:
  - `hp`, `maxHp`, `speed`
  - `dashGauge`, `dashCooldownMs`, `dashDurationMs`, `dashInvulnerabilityMs`
  - `pickupRadius`, `weapons`, `maxWeaponSlots`
- Scene-level player orchestration responsibilities:
  - input polling and movement calls
  - dash trigger/update
  - collision damage handling
  - level-up pause lock/unlock

### Implementation Checklist
- [x] Diagonal movement normalization is applied.
- [x] Dash activation checks readiness and applies immediate velocity.
- [x] Dash invulnerability window prevents contact damage during active window.
- [x] Dash contact damage/knockback applies safely with per-dash hit guard.
- [x] Player remains within world bounds.
- [x] XP magnet pull and level-scaling radius are active.
- [x] Level-up state pauses gameplay and resumes cleanly.
- [x] Runtime render config supports crisp pixel-art movement.
- [ ] Arrow-key movement binding is not implemented.
- [ ] Health resistance/regeneration systems are not implemented.
- [ ] Replace placeholder geometry with a `32x32` player sheet and dash-smear frame set.

## Validation Checklist
- [ ] Movement speed remains consistent in all 8 directions.
- [ ] Dash transitions `Charging -> Ready -> Active -> Charging` without lockups.
- [ ] Player does not take overlap damage during dash invulnerability window.
- [ ] Player cannot clip outside map or through static obstacles.
- [ ] XP orbs inside pickup radius move toward player and get collected.
- [ ] Level-up pauses enemy/player simulation and resumes after selection.
- [ ] Player death always triggers game-over UI and restart path.

## Debug / Failure Points
- Movement freeze:
  - verify `isLeveling` / `isGameOver` early returns and `player.body` existence.
- Dash desync:
  - verify `updateDash(delta)` and HUD ratio text alignment.
- Unexpected damage during dash:
  - verify `isDashInvulnerable()` branch in collision handler.
- XP magnet inconsistency:
  - verify `pickupRadius + level bonus` calculation and orb body velocity reset.
- Unfair collision feel:
  - verify player circle size and enemy overlap frequency.

## Next Iteration Hooks
- Add optional arrow-key bindings in keyboard map.
- Add player passives (shield/resistance/regen) with explicit UI feedback.
- Split scene-level player flow into dedicated controllers if complexity grows (`PlayerController`, `DashController`).
- Add dash distance stat as explicit config value (currently derived from speed * duration).
- Add a separate animation sheet spec only when player sprite production starts.
