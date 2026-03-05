# SPAWN_DIRECTOR.md — DashSurvivor Agentic Spawn Director Spec

## Context
- Spawn Director is the pacing layer that controls combat pressure over time.
- Current implementation uses a state machine + density target + burst events (not a budget-spending model).
- Design target run pacing is 7–10 minutes; runtime currently ends on player death.
- Source of truth: `src/Systems/DirectorSystem.js`, `src/config/director.js`, `src/config/progression.js`, `src/scenes/GameScene.js`.

## Systems

### Director State Machine (Code-Synced)
| State | Duration | Spawn Pressure | Enemy Speed (Phase Base) | Enemy Speed (Effective, `*1.2`) | Elite Chance Base |
|---|---:|---|---|---:|
| `BUILD` | 30000ms | density gradually increases | ramps `1.00 -> 1.08` | ramps `1.20 -> 1.296` | 0.04 |
| `PEAK` | 15000ms | maximum pressure | `1.16` | `1.392` | 0.22 |
| `RELIEF` | 8000ms | reduced pressure window | `1.00` | `1.20` | 0.01 |

- State order: `BUILD -> PEAK -> RELIEF -> repeat`.
- Director tracks `totalElapsedMs` and schedules boss/miniboss/spawn-burst requests.
- Enemy speed formula (runtime):
  - `effectiveSpeed = baseSpeed * phaseMultiplier * enemySpeedBoost`
  - `enemySpeedBoost = 1.2`

### Runtime Variables (Current)
- `totalElapsedMs`, `state`, `stateElapsedMs`
- `pendingBossSpawnCount`, `pendingMiniBossSpawnCount`, `pendingSpawnBurstCount`
- Multipliers exposed to scene:
  - `getSpawnRateMultiplier()`
  - `getEnemySpeedMultiplier()`
  - `getEnemyHpMultiplier()`
  - `getEnemyDamageMultiplier()`
  - `getEliteChance()`

### Spawn Throughput Model (Current)
- Base check interval: `BASE_SPAWN_CHECK_INTERVAL_MS = 250`.
- Effective interval:
  - `effectiveSpawnIntervalMs = baseSpawnCheckIntervalMs / max(0.2, spawnRateMultiplier)`
- Density target:
  - `targetEnemies = min(160, round(baseTargetFromCurve * spawnRateMultiplier))`
- Pacing loop is cyclical and state-driven:
  - `BUILD`: enemy density increases
  - `PEAK`: maximum spawn pressure
  - `RELIEF`: reduced spawn pressure
  - return to `BUILD` and pressure resumes
- Per-check spawn count uses `SPAWN_BURST_CONFIG` steps (`1 -> 2 -> 3 -> 2`).
- Additional director burst event:
  - every `22000ms`, add random `6..9` extra spawn requests.

### Spawn Safety / Location Rules
- Spawn candidates are selected from camera-edge sides (top/right/bottom/left).
- Candidate must satisfy:
  - outside current camera world view
  - distance from player `> SAFE_RADIUS (300)`
- Fallback selects the best edge candidate by outside-view priority + distance score.
- Enemy count hard cap:
  - no spawn when alive enemies `>= 160`.

### Enemy Pool / Type Selection
- Spawn uses pooled enemies (`ObjectPool.acquire`) only.
- Archetype selected by weighted table, with `hunter` unlock gate at `45s`.
- Swarm archetype spawns grouped (`3..5` instances).
- Elite chance = state base + elapsed-time scaling (`+0.02 per minute`, capped `0.72`).

### Boss / Mini-Boss Scheduling
- Mini-boss: one-time event at `90000ms`.
- Boss: periodic event every `180000ms`.
- Current behavior on spawn:
  - spawn from edge candidate
  - camera shake + HUD alert (`MINI BOSS` / `BOSS INCOMING`)
- Current implementation does **not** pause normal spawning during boss entry.

## Implementation Targets
- `DirectorSystem` responsibilities (current):
  - state transitions
  - time-based pacing multipliers
  - boss/miniboss/spawn-burst event scheduling
- `GameScene` responsibilities (current):
  - spawn ticking via accumulator loop
  - density target enforcement
  - spawn point validation and pooled enemy activation

### Implementation Checklist
- [x] Director cycles BUILD/PEAK/RELIEF automatically.
- [x] Spawn rate responds to director state + time difficulty.
- [x] Enemy HP and damage scale with elapsed time.
- [x] Elite chance scales with state and time.
- [x] Hard cap (`160`) prevents uncontrolled enemy count growth.
- [x] Boss/miniboss events are director-driven.
- [ ] Budget-spend model (`spawnBudget` + enemy cost table) is not implemented.
- [ ] Boss-entry spawn pause/resume logic is not implemented.

## Validation Checklist
- [ ] Early game spawn pressure is manageable (first ~60s).
- [ ] PEAK state produces a clear pressure spike.
- [ ] RELIEF state reduces pressure perceptibly.
- [ ] Alive enemy count never exceeds hard cap.
- [ ] Spawn points remain outside camera view and safe radius.
- [ ] Mini-boss appears once near 90s; boss appears on periodic schedule.

## Debug / Failure Points
- Early flood:
  - check `TARGET_ENEMY_CURVE`, `spawnRateBoost`, and `effectiveSpawnIntervalMs` floor.
- Spawn too close to player:
  - check `isValidSpawnPoint()` and fallback candidate scoring.
- Pool starvation (missed spawns):
  - check `ObjectPool.available.length` and acquire-null branch.
- Elite over-scaling:
  - check `getEliteChance()` cap and elapsed-minute scaling.
- Boss overlap with heavy density:
  - check boss spawn timing versus current alive enemy count.

## Next Iteration Hooks
- Add explicit budget/cost spawning mode (`spawnBudget`, enemy cost table).
- Add soft-cap behavior for spawn reduction (separate from hard-cap block).
- Add temporary spawn pause during boss walk-in event.
- Add map-lane weighted spawns (bow/stern/port/starboard) for authored pacing.
