# WEAPON_SPEC.md — DashSurvivor Agentic Weapon Spec

## Context
- Weapons are automatic combat systems; player focus is movement, dash timing, and positioning.
- Current weapon implementation is data-driven via `src/config/weapons.js` and runtime logic in `src/systems/WeaponSystem.js`.
- Run pressure is handled by enemy density/director; weapon system supplies sustained DPS and crowd-control tools.
- Source of truth: `src/config/weapons.js`, `src/systems/WeaponSystem.js`, `src/entities/Player.js`, `src/scenes/GameScene.js`.

## Systems

### Weapon Runtime Contract (Code-Synced)
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Auto fire loop | Implemented | Each weapon fires when `time >= nextFireAt` | `WeaponSystem.update()` |
| Cooldown management | Implemented | Per-weapon timer + global cooldown multiplier | `weapon.nextFireAt`, `getEffectiveCooldownMs()` |
| Target selection | Implemented | Nearest active enemy in range | `findNearestEnemy()` |
| Projectile lifecycle | Implemented | Projectile pooling acquire/release + max distance cleanup | `spawnProjectile()`, `updateProjectiles()`, `releaseProjectile()` |
| Damage application | Implemented | Enemy-only damage + knockback + death hook | `applyDamage()` |
| Multi-weapon concurrency | Implemented | Independent weapon states in `player.weapons[]` | `WeaponSystem.update()` |
| Evolution rules | Partial | Rules exist, passive cards are exposed, and runtime supports evolve once requirements are met | `WEAPON_EVOLUTION_RULES`, `LEVEL_UP_UPGRADES`, `checkEvolution()` |

### Weapon Slots / Loadout
| Item | Current Value | Notes |
|---|---|---|
| Start loadout | `dagger` + `fireball` | Added in `GameScene.create()` |
| Max weapon slots | `3` | `Player.maxWeaponSlots` |
| Extra start option | `lightning` | Meta upgrade `starting_weapon` grants at run start |

### Weapon Types (Current Config)
| Weapon | Behavior | Damage | Cooldown | Range | Notes |
|---|---|---:|---:|---:|---|
| `dagger` | Fast projectile | 10 | 420ms | 220 | Base single-target pressure |
| `fireball` | Projectile + explosion | 22 | 1400ms | 380 | Explosion radius 64 |
| `lightning` | Instant chain hit | 20 (base) | 1500ms | 320 | Up to 3 jumps, damage falloff |
| `meteor` (evolved) | Heavy projectile + large explosion | 52 | 1850ms | 430 | Evolution target of fireball |
| `orbit_blades` (evolved) | Rotating close-range blades | 16 | 230ms | 120 | Evolution target of dagger |

### Runtime Art Pass
- V2 weapon icons are promoted for `dagger` (cutlass art), `fireball` (flintlock art), `lightning` (whip art), and `orbit_blades` (boarding axe art).
- `meteor` keeps its existing icon until a dedicated V2 meteor candidate is produced.
- Boss radial bullets now use the promoted 8-direction skull projectile family while preserving a small collision circle.
- QA2 keeps weapon behavior re-planning out of scope, but visual pairing must still be coherent: straight blade attacks should use slash-like visuals, firearm-style weapons should not borrow blade projectiles, and boss-only skull bullets should remain visually distinct from player weapons.

### Scaling / Upgrades
- Global upgrades (implemented):
  - `weapon_damage`: all weapon damage multiplier
  - `attack_speed`: global cooldown reduction
  - `projectile_count`: extra projectile count (cap 8)
- Local weapon scaling (implemented):
  - duplicate weapon acquisition levels that weapon (`levelUpWeapon`)
  - over-slot acquisition falls back to leveling first weapon
- Evolution (partial in live loop):
  - `fireball -> meteor` requires `level >= 5` + passive `ember_core`
  - `dagger -> orbit_blades` requires `level >= 5` + passive `blade_sigil`
  - `ember_core` and `blade_sigil` are exposed as passive level-up cards in `LEVEL_UP_UPGRADES`.
  - Remaining gap: no focused e2e or test-assisted run yet proves both evolutions trigger during a normal first-session path.

## Implementation Targets
- Weapon state fields required per weapon instance:
  - `type`, `baseType`, `level`, `damage`, `cooldownMs`, `range`, `nextFireAt`
  - behavior fields (`projectileBehavior`, `projectileSpeed`, `explosionRadius`, `orbitBladeCount`, etc.)
- WeaponSystem must maintain:
  - strict collision contract (`Projectile/Orbit -> Enemy`)
  - object pool integrity for projectile reuse
  - independent cooldown execution across all active weapons

### Implementation Checklist
- [x] Multiple weapons operate simultaneously.
- [x] Projectile pooling avoids per-shot allocations.
- [x] Cooldowns and targeting are weapon-local.
- [x] Lightning chain and explosion behaviors are functional.
- [x] Global upgrade multipliers apply immediately.
- [x] Expose passive acquisition flow for evolution requirements.
- [ ] Add test-assisted coverage proving `fireball -> meteor` and `dagger -> orbit_blades` can trigger.

## Validation Checklist
- [ ] `dagger/fireball` auto-fire starts immediately at run start.
- [ ] Projectile pool does not exhaust under heavy spawn pressure.
- [ ] `projectile_count` increases fired projectile fan correctly.
- [ ] `attack_speed` reduces effective cooldown without underflow.
- [ ] Lightning chain hits up to 3 targets and applies falloff.
- [ ] Explosion weapons apply AoE damage within radius only.
- [ ] Dead enemies from weapon damage trigger defeat flow once.
- [x] Smoke test covers immediate start-run weapon selection and live dash input after the weapon modal closes.

## Debug / Failure Points
- Cooldown desync:
  - Check `weapon.nextFireAt` updates and pause/resume interactions.
- Projectile collision misses:
  - Check overlap registration and `isValidProjectileEnemyCollision()`.
- Pool starvation:
  - Check `PROJECTILE_POOL_SIZE_BY_TEXTURE` and `acquireProjectile()` null returns.
- Damage API mismatch:
  - Check `Enemy.takeDamage()` presence and `instanceof Enemy` guard.
- Evolution not triggering:
  - Check passive flags on `player.passives` and `checkEvolution()` preconditions.

## Next Iteration Hooks
- Add test-assisted evolution coverage for `ember_core` / `blade_sigil` paths.
- Add new base weapon types (ship theme) without changing `WeaponSystem` core contract.
- Add weapon rarity tiers in config if balancing pass requires drop-weighted upgrades.
