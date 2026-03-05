# ENEMY_SPEC.md — DashSurvivor Agentic Enemy Spec

## Context
- Enemies represent sea monsters boarding the arena from edges.
- Design goal: continuous pressure with readable archetype differences and escalating threat.
- Target run pacing is 7–10 minutes, with pressure spikes from elite/boss events.
- Current implementation uses pooled enemies, director-driven pressure, and elite modifiers.
- Source of truth: `src/config/enemies.js`, `src/entities/Enemy.js`, `src/entities/BossEnemy.js`, `src/scenes/GameScene.js`, `src/Systems/DirectorSystem.js`, `src/Systems/ObjectPool.js`.

## Systems

### Enemy Lifecycle (Code-Synced)
| Stage | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Spawn | Implemented | Acquire from pool, reset stats/texture/physics | `ObjectPool.acquire()`, `Enemy.resetForSpawn()` |
| Seek | Implemented | Chasing with encirclement angle offset | `Enemy.chase()` |
| Attack | Partial | Contact damage handled by overlap callback (scene-driven) | `GameScene.handlePlayerEnemyCollision()` |
| Recover | Partial | No enemy-local attack cooldown state machine; damage gating mostly on player side | `Player.damageCooldownMs` |
| Death | Implemented | HP reaches 0, defeat flow handles drops + release/destroy | `Enemy.die()`, `GameScene.handleEnemyDefeat()` |
| Pool return | Implemented | Pooled enemies disable body and return to free list | `ObjectPool.release()`, `Enemy.resetForPool()` |

### Enemy Archetypes
| Type | Status | Stats (Current) | Unlock / Spawn |
|---|---|---|---|
| `chaser` | Implemented | HP 14 / Speed 110 / Damage 10 / XP 12 | Available from run start |
| `tank` | Implemented | HP 70 / Speed 52 / Damage 14 / XP 24 | Available from run start |
| `swarm` | Implemented | HP 8 / Speed 84 / Damage 5 / XP 5 | Available from run start; spawns in group (3–5) |
| `hunter` | Implemented | HP 9 / Speed 176 / Damage 6 / XP 11 | Unlock after `45s` (`HUNTER_UNLOCK_TIME_SEC`) |

### Elite Variants (Modifier-Based)
| Elite Type | Status | Effect |
|---|---|---|
| `speed_boost` | Implemented | Periodic speed burst |
| `dash_attack` | Implemented | Periodic rush burst |
| `poison_aura` | Implemented | Aura tick damage near player |

- Elite spawn chance is director-driven (`BUILD/PEAK/RELIEF`) + time scaling.
- Elite enemies are visually distinct (tint + scale) and drop boosted XP/rewards.

### Boss Units
| Unit | Status | Spawn Timing | Notes |
|---|---|---|---|
| Mini Boss | Implemented | One-time at `~90s` | `BossEnemy` with `mini` variant, `shockwave + rush` pattern |
| Boss | Implemented | Every `180s` | `BossEnemy` default variant, higher HP/damage `shockwave + rush` pattern |

- Boss/miniboss currently spawn via edge-position logic, not fixed bow/stern lock.

## Implementation Targets

### Entity Contract (Current)
- Enemy entity must keep:
  - `hp`, `speed`, `damage`, `xpValue`, `radius/scale`, `tint`
  - pool reset methods (`resetForSpawn`, `resetForPool`)
  - combat methods (`takeDamage`, `applyKnockbackFrom`, `isDead`)

### AI / Control Contract (Current)
- `Enemy` class directly handles chase/ability behavior (no separate `EnemyController` class yet).
- Obstacle handling is physics-collision based (`collider`) and not navmesh pathfinding.
- Scene handles:
  - overlap damage application
  - spawn selection/timing
  - defeat/drop/release flow

### Implementation Checklist
- [x] Enemies spawn outside view and outside safe radius.
- [x] Enemy archetypes selected by weighted table.
- [x] Hunter unlock gate at 45s is enforced.
- [x] Elite chance scales with director state/time.
- [x] Pooled enemies are disabled on release and reset on acquire.
- [x] Defeated pooled enemies return to pool.
- [x] Boss/miniboss spawns are director-triggered.
- [ ] Bow/stern-constrained boss entry (currently any valid edge candidate).
- [ ] Separate enemy-side attack/recover FSM if needed.

## Validation Checklist
- [ ] Enemy never updates while inactive/dead (`active + isDead` guard).
- [ ] Spawned enemy has valid body/velocity reset.
- [ ] Swarm archetype creates grouped entries (3–5).
- [ ] Elite tint/scale/XP boost are visible in run.
- [ ] Mini boss appears once around 90s.
- [ ] Boss appears on periodic schedule.
- [ ] Enemy release path does not leak active colliders.

## Debug / Failure Points
- Enemies spawning in invalid positions:
  - Check `getSpawnPosition()` and `isValidSpawnPoint()`.
- Enemy pool exhaustion under high pressure:
  - Check `ObjectPool.available.length` and spawn null-handling branch.
- Elite frequency spikes too hard:
  - Check `DirectorSystem.getEliteChance()` + max cap.
- Collision feels unfair (contact burst):
  - Check `handlePlayerEnemyCollision()` and player damage cooldown.
- Boss overpowering due scaling:
  - Check boss base stats + `getEnemyHpMultiplier()` / damage multiplier paths.
- Obstacle jam / movement deadlocks:
  - Check obstacle collider density and `Enemy.chase()` vectors.

## Next Iteration Hooks
- Add ranged archetype (projectile-based pressure).
- Add summoner archetype (spawn-support behavior).
- Add explicit enemy-side attack/recover state timers.
- Add ship-themed spawn lanes (bow/port/starboard/stern explicit zones).
