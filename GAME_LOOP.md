# GAME_LOOP.md — DashSurvivor Agentic Game Loop Spec

## Context
- DashSurvivor is a top-down survivor-like action game on a finite arena.
- Current runtime is survival-until-death (no enforced run-end timer).
- Design target can be 7–10 minutes, but this is currently a balance target, not a hard stop condition.
- Core moment-to-moment loop is movement + dash timing + auto-weapon pressure + spawn escalation.
- Source of truth: `src/scenes/GameScene.js`, `src/Systems/DirectorSystem.js`, `src/Systems/WeaponSystem.js`, `src/Systems/ObjectPool.js`, `src/config/*`.

## Systems

### Runtime Loop Systems (Code-Synced)
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Run start | Implemented | Scene create initializes player/enemies/pools/HUD | `GameScene.create()` |
| Enemy spawning | Implemented | Density target + burst spawns + edge spawn guard | `maintainEnemyDensity()`, `spawnEnemyFromEdge()` |
| Director pacing | Implemented | BUILD/PEAK/RELIEF state cycle | `DirectorSystem.update()` |
| Player movement/dash | Implemented | WASD + touch joystick + dash key/button | `Player.moveFromInput()`, `Player.tryDash()` |
| Auto combat | Implemented | Auto attack + weapon system auto fire | `performAutoAttack()`, `WeaponSystem.update()` |
| XP + level-up | Implemented | XP gain, thresholds, pause-and-pick 3 upgrades | `gainXp()`, `openLevelUpChoices()` |
| Meta currency economy | Implemented | Run meta gain from XP amount, spend on game-over screen | `runMetaCurrency`, `MetaProgressionSystem` |
| Elite behavior | Implemented | Elite spawn chance scales by state/time | `DirectorSystem.getEliteChance()` |
| Miniboss event | Implemented | One-time miniboss at ~90s | `DIRECTOR_MINI_BOSS_EVENT.atMs` |
| Boss event | Implemented | Periodic boss spawn every 180s | `DIRECTOR_BOSS_SPAWN.intervalMs` |
| End run | Implemented | Player death -> game over overlay -> restart | `triggerGameOver()`, `restartRun()` |

### Performance / Resource Systems
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Enemy pooling | Implemented | Preallocated enemy pool, acquire/release lifecycle | `ObjectPool` |
| Projectile pooling | Implemented | Preallocated projectile pool by texture | `WeaponSystem` |
| Enemy cap | Implemented | Hard cap on active enemies (`160`) | `PERFORMANCE_MAX_ACTIVE_ENEMIES` |
| Particle load control | Implemented | Particle scale reduced at high enemy count | `getParticleLoadScale()` |

## Implementation Targets

### Current Timeline (Implemented Behavior)
- `0:00` Run starts, base spawns begin.
- `0:00–0:30` Director `BUILD` phase ramps pressure.
- `0:30–0:45` Director `PEAK` phase (higher pressure).
- `0:45–0:53` Director `RELIEF` phase (lower pressure).
- Cycle repeats (`BUILD -> PEAK -> RELIEF`).
- `~0:45` Hunter archetype becomes available (`HUNTER_UNLOCK_TIME_SEC = 45`).
- `~1:30` Miniboss event trigger (`atMs = 90000`).
- `~3:00` First periodic boss spawn, then every 3 minutes.

### Derived Loop Flow
Start Run  
-> Edge spawns + density maintenance  
-> Move/dash/auto-combat  
-> XP pickups and level-up choices  
-> Director scaling (state + elapsed-time multipliers)  
-> Elite pressure increases over time  
-> Miniboss/Boss events  
-> Death -> Game Over meta screen -> Restart

### Architecture Targets (vibe-coding task units)
- [x] `DirectorSystem` controls state pacing and event schedules.
- [x] `GameScene` owns spawn execution and core run state.
- [x] `WeaponSystem` handles auto-fire and projectile lifecycle.
- [x] Upgrade flow integrated in `GameScene` (no standalone `UpgradeSystem` class yet).
- [ ] If needed later, split `GameScene` responsibilities into dedicated `RunDirector` / `SpawnDirector` classes.

## Validation Checklist
- [ ] Run initializes with player, enemy pool, and HUD without null errors.
- [ ] Enemies spawn from valid edge positions and outside safe radius.
- [ ] XP gain triggers level-up panel and resumes gameplay after selection.
- [ ] Director state transitions occur in order and affect spawn pressure.
- [ ] Elite spawn frequency increases as elapsed minutes increase.
- [ ] Miniboss appears once around 90s.
- [ ] Boss appears on periodic schedule (~180s interval).
- [ ] Enemy hard cap (`160`) prevents runaway spawn explosion.
- [ ] Game over flow allows immediate restart without page reload.

## Debug / Failure Points
- Spawn too fast / too slow:
  - Check `getSpawnRateMultiplier()` and `effectiveSpawnIntervalMs` calculation.
- Spawn starvation at high pressure:
  - Check enemy pool availability and `ObjectPool.acquire()` null return rate.
- Level-up freeze lock:
  - Check `openLevelUpChoices()` / `closeLevelUpChoices()` and `physics.pause/resume` pairing.
- Boss/miniboss event not firing:
  - Check `DirectorSystem.consume*SpawnRequests()` usage in `update()`.
- Elite behavior mismatch:
  - Check `getEliteChance()` scaling and `enemy.setElite()` branch in spawn.
- Late-game perf drop:
  - Check active enemy count, pooling release paths, and particle scaling path.

## Next Iteration Hooks
- Add explicit run completion condition (`win` at target time) if design requires timed completion.
- Split `GameScene` into `RunDirector`/`SpawnDirector` only if maintenance cost grows.
- Add event queue UI for upcoming boss/miniboss timings.
- Add deterministic seed mode for spawn/debug replay.
