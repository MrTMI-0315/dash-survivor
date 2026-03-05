# MAP_SPEC.md — DashSurvivor Agentic Map Spec

## Context
- DashSurvivor map is a finite top-down arena rendered as a ship-deck-like combat field.
- Current map runtime uses a bounded world with procedural static obstacles and edge-based enemy ingress.
- Design intent is movement-first combat: kiting, dash escapes, and pressure management under rising density.
- Target run pacing is 7–10 minutes (design target), while current run end is player-death driven.
- Source of truth: `src/config/progression.js`, `src/scenes/GameScene.js`, `src/entities/Player.js`, `src/entities/Enemy.js`.

## Systems

### World / Camera Contract (Code-Synced)
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| World bounds | Implemented | Finite world `2400 x 1350` | `WORLD_WIDTH`, `WORLD_HEIGHT` |
| Boundary collision | Implemented | Player/enemy cannot leave world bounds | `setCollideWorldBounds(true)` |
| Camera mode | Implemented | Camera follows player (not fixed full-deck view) | `cameras.main.startFollow()` |
| Arena rendering | Implemented | Procedural floor + grid lines | `drawArena()` |

### Terrain / Obstacle System
| System | Status | Current Implementation | Notes |
|---|---|---|---|
| Obstacle type | Implemented | Procedural `terrain_rock`, `terrain_pillar` | Ship-themed placeholder geometry |
| Obstacle placement | Implemented | Random 5–10 static obstacles at run start | Spacing + player-safe-distance guards |
| Collision behavior | Implemented | Static collider blocks player and enemies | `physics.add.collider(player/enemies, obstacles)` |
| Navigation mesh | Not Implemented | No navmesh/pathfinding graph | Movement is velocity + physics collision |

### Spawn Space / Entry System
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Edge spawn lanes | Implemented | Randomized top/right/bottom/left camera-edge candidates | `getSpawnPosition()` |
| Off-screen spawn | Implemented | Spawn points forced outside current camera view | `isOutsideView` check |
| Player safe radius | Implemented | Spawn distance from player must exceed `SAFE_RADIUS=300` | `isValidSpawnPoint()` |
| Boss entry location | Partial | Boss/miniboss spawn from generic edge candidates | Not yet constrained to bow/stern |
| Boss warning | Implemented | HUD alert + camera shake | `showHudAlert()`, `spawnBossEnemy()` |

## Implementation Targets
- Map runtime must preserve these contracts:
  - bounded world collision (no player escape outside map)
  - obstacle-driven routing with minimum free lanes
  - enemy entry from edges/outside view only
  - spawn safety relative to player position

### Primary Runtime Objects
- `Arena floor` (procedural graphics)
- `Rail-equivalent boundary` (world bounds collision)
- `Obstacle set` (`terrain_rock`, `terrain_pillar` static bodies)
- `Spawn anchors` (computed camera-edge points)

### Implementation Checklist
- [x] Player/enemy world-boundary collision active.
- [x] Obstacles are static physics objects.
- [x] Obstacles avoid player start area.
- [x] Enemy spawn checks enforce off-screen + safe radius.
- [x] Boss/miniboss spawn event emits warning feedback.
- [ ] Ship-zone authored layout (mast/cargo/cannon lanes) not yet authored.
- [ ] Bow/stern-exclusive boss entry is not yet enforced.

## Validation Checklist
- [ ] Player cannot exit world bounds during normal move/dash.
- [ ] Enemies never spawn inside current camera view.
- [ ] Spawn points remain outside `SAFE_RADIUS` from player.
- [ ] Obstacles do not fully seal movement paths.
- [ ] Boss and miniboss spawn without overlapping invalid positions.

## Debug / Failure Points
- Spawn inside view or too close to player:
  - Verify `getSpawnPosition()` fallback candidates and `isValidSpawnPoint()`.
- Obstacle choke overblocking movement:
  - Verify `TERRAIN_OBSTACLE_MIN_GAP` and obstacle count range.
- Camera confusion in large world:
  - Verify follow smoothing and UI readability while moving.
- Boss spawn unfairness in dense packs:
  - Verify boss spawn timing against active enemy density.

## Next Iteration Hooks
- Replace procedural layout with authored ship zones (mast/cargo/cannon/rails).
- Add explicit spawn markers per lane (bow, stern, port, starboard).
- Add constrained boss walk-in sequence (bow/stern only).
- Add optional dynamic hazards (wave push, destructible props) after baseline stability.
