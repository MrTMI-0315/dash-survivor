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
| Camera mode | Implemented | Start-run overview reveals the source-derived ship silhouette, then camera follows player | `startRunCameraIntro()`, `cameras.main.startFollow()` |
| Arena rendering | Implemented | Authored deck tile sprites with procedural overlays and optional ocean tile backdrop | `drawArena()` |

### Redesign V2 Source Coordinate Contract
Runtime map geometry treats `assets/generated/redesign_v2/source/v2_environment_source.png` as the visual source of truth.

| Source Region | Runtime Region | Scale | Code Hook |
|---|---|---|---|
| `1536 x 704` ship-map region | `2400 x 1350` world | `scaleX = 1.5625`, `scaleY = 1.9176` | `REDESIGN_V2_SOURCE_TO_WORLD` |

- The playable deck polygon is hand-authored from the source image's ship silhouette, not from a full rectangle.
- Deck plank rendering is clipped to the playable polygon so ocean remains visible outside curved bow/stern edges.
- Spawn, obstacle, dash clamp, and QA smoke checks must use the ship-deck polygon as the gameplay boundary.
- Any future map extraction pass should update the source coordinate contract before moving props or collision anchors.

### Terrain / Obstacle System
| System | Status | Current Implementation | Notes |
|---|---|---|---|
| Obstacle type | Implemented | Authored ship prop sprites for random crates/barrels/rope/hatches plus legacy static bodies | Ship-themed V2 sprite pass |
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

### Pixel-Grid Art Direction (Planned)
| Item | Target | Notes |
|---|---|---|
| Base art grid | `32x32` | Use as the primary deck / prop / pickup authoring grid |
| Large obstacle modules | `64x64` or `96x96` | Mast, hatch, cannon clusters can occupy multiple 32px cells |
| Boss footprint art | `64x64` to `96x96` | Keep gameplay collision smaller than visual silhouette |
| Sprite scaling | Integer-only | Avoid fractional upscale to preserve crisp pixels |
| Rendering mode | Enabled in runtime | `src/main.js` now uses `pixelArt: true`, `antialias: false`, `roundPixels: true` |

### Free Source Shortlist (Reference Only)
| Source | Use | License / Caution |
|---|---|---|
| [Kenney Pirate Pack](https://kenney.nl/assets/pirate-pack) | Deck props, cannons, crates, nautical set dressing | CC0, safest base for production reuse |
| [OpenGameArt ship/pirate tilesets search](https://opengameart.org/art-search-advanced?keys=pirate+tileset) | Supplemental deck tiles and themed props | Check each asset license individually before import |
| [Phaser pixel art guidance](https://docs.phaser.io/phaser/concepts/gameobjects/render-texture#pixel-art-and-rounding) | Rendering rules for crisp pixel output | Use as runtime rendering reference |

## Implementation Targets
- Map runtime must preserve these contracts:
  - bounded world collision (no player escape outside map)
  - obstacle-driven routing with minimum free lanes
  - enemy entry from edges/outside view only
  - spawn safety relative to player position
  - future pixel art assets must snap to a `32x32` layout grid even though current runtime is not tilemap-based

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
- [x] Runtime render config favors crisp pixel-art presentation.
- [x] Ship-zone authored decor landmarks added for mast/cargo/winch/lantern/banner lanes.
- [ ] Bow/stern-exclusive boss entry is not yet enforced.
- [x] Replace grid-placeholder floor art with authored deck tile variants and modular prop chunks.
- [ ] Verify imported art licenses are compatible (`CC0` preferred, `CC-BY` acceptable with attribution plan).

## Validation Checklist
- [x] Redesign-v2 environment source is the map source of truth: `assets/generated/redesign_v2/source/v2_environment_source.png`.
- [x] Runtime deck geometry uses a ship-shaped playable polygon instead of a full rectangular deck.
- [x] Deck planks are clipped to the playable deck polygon so ocean remains visible around curved bow/stern hull edges.
- [x] Player, enemies, random obstacles, and spawn candidates are constrained to the ship deck polygon.
- [x] Central mast/skull-banner landmark is present near the source-derived center anchor.
- [x] Smoke test checks player remains inside ship deck after a Space dash.
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
- Tune authored ship zones against the redesign-v2 source image after combat screenshot review.
- Add explicit spawn markers per lane (bow, stern, port, starboard).
- Add constrained boss walk-in sequence (bow/stern only).
- Add optional dynamic hazards (wave push, destructible props) after baseline stability.
- Lock final environment palette to `deck brown / sea teal / sickly enemy cool hues` before asset import.
