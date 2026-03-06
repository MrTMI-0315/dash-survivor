# MAP_DECK.md — DashSurvivor Agentic Map Spec

## Context
- The gameplay map represents a finite pirate-ship deck arena concept.
- Design target: 7–10 minute survival run while sea monsters board from ship edges.
- Current code uses a finite world with camera follow and edge-based spawning.
- Source of truth: `src/scenes/GameScene.js`, `src/config/progression.js`, `src/Systems/DirectorSystem.js`.

## Systems

### World / Camera
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Finite map bounds | Implemented | `WORLD_WIDTH x WORLD_HEIGHT` (`2400 x 1350`) | `physics.world.setBounds()` |
| Camera behavior | Implemented | Follow camera (not fixed full-deck view) | `cameras.main.startFollow()` |
| Fixed full-deck camera | Not Implemented | Planned deck-wide static view | N/A |

### Terrain
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Main open combat space | Implemented | Full arena with grid backdrop | `drawArena()` |
| Mast obstacle | Not Implemented | No dedicated mast object yet | N/A |
| Cargo crates | Not Implemented | No crate archetype yet | N/A |
| Cannons | Not Implemented | No cannon obstacle type yet | N/A |
| Ship rails / boundary walls | Partial | World bounds + obstacle collisions, no deck rail art layer | world bounds + colliders |
| Random obstacles | Implemented | 5–10 `terrain_rock`/`terrain_pillar` spawned at run start | `createTerrainObstacles()` |

### Enemy Spawn
| System | Status | Current Implementation | Code Hook |
|---|---|---|---|
| Edge spawn | Implemented | Spawn just outside current camera view and outside safe radius | `getSpawnPosition()` |
| Left/Right/Bow/Stern zones | Partial | Side selection exists, not ship-themed zone labels | `getSpawnPosition()` side roll |
| Ladder spawn | Not Implemented | Planned | N/A |
| Hatch burst event spawn | Not Implemented | Planned as deck-specific event spawn | N/A |
| Miniboss event | Implemented | One-time miniboss around 90s | `DirectorSystem` + `spawnMiniBossEnemy()` |
| Boss periodic event | Implemented | Periodic boss spawn (interval-based) | `DirectorSystem` + `spawnBossEnemy()` |

### Pixel-Grid Layout Target (Planned)
| Layer | Art Target | Authoring Rule |
|---|---|---|
| Deck floor | `32x32` planks / trim modules | Keep plank direction readable from top-down camera |
| Mast / hatch / stairs | `64x64+` assembled chunks | Major anchors should snap to 32px multiples |
| Cannon line / crate cluster | `32x32` modules grouped in 2x2 or 3x2 blocks | Preserve at least 2 escape routes around each cluster |
| Rails / posts | `16x32` or `32x32` repeating edge kit | Decorative layer must align with collision boundary |
| Sea outside deck | low-detail looping tiles or strips | Keep contrast lower than deck to preserve gameplay readability |

### Free Asset Direction
- Prefer [Kenney Pirate Pack](https://kenney.nl/assets/pirate-pack) for deck props and nautical silhouettes because the license is CC0.
- Use [OpenGameArt pirate tileset results](https://opengameart.org/art-search-advanced?keys=pirate+tileset) only as supplemental sources after checking per-asset license metadata.
- Keep Phaser rendering in pixel-art mode and avoid smooth scaling; the runtime now supports this in [main.js](/Users/mrtmi/Desktop/Mr_TMI/repos/DashSurvivor/src/main.js).

## Implementation Targets

### Map Structure Targets
- Center:
  - Keep open combat lane for kiting (implemented conceptually).
- Mid obstacles:
  - Replace generic random obstacles with deck semantics:
    - Mast (planned)
    - Crate clusters (planned)
- Edge boundaries:
  - Keep strict collision boundaries.
  - Add visual ship rail layer aligned with collision walls (planned).
  - Author rail art in repeating pixel modules instead of freehand shapes.

### Spawn Targets
- Enforce sea-entry feel from deck perimeter.
- Keep off-screen spawn + walk-in behavior (implemented).
- Add ship-themed named spawn sets:
  - Bow
  - Port
  - Starboard
  - Stern
- Boss entry points constrained to bow/stern (planned; currently any edge candidate).

### Movement Design Targets
- Preserve circular kiting routes around center mass.
- Ensure at least two escape routes around obstacle clusters.
- Preserve dash escape lanes through obstacle gaps.

### Implementation Checklist
- [x] Player cannot leave world bounds.
- [x] Enemies spawn outside immediate player safe radius.
- [x] Enemy spawn interval has lower bound guard (`Math.max(0.2, spawnRate)`).
- [x] Enemy/boss/miniboss enter from edge-oriented positions.
- [x] Runtime render path is compatible with crisp pixel art.
- [ ] Replace random obstacle set with ship-deck semantic layout (mast/crates/cannons).
- [ ] Add explicit bow/port/starboard/stern zone definitions in config.
- [ ] Add hatch/ladder event spawns tied to deck geometry.
- [ ] Convert camera to fixed full-deck if target design requires non-scrolling view.
- [ ] Convert arena art to modular `32x32` deck kit before importing large background sheets.

## Validation Checklist
- [ ] Player cannot clip outside deck bounds under dash.
- [ ] Enemy spawn points are never inside player safe radius.
- [ ] Enemy spawn points are never inside blocked obstacle bodies.
- [ ] Enemies can route around placed obstacles without permanent jam.
- [ ] Miniboss event triggers once; boss events trigger by schedule.
- [ ] Mid-run pressure scales without early-game spawn overwhelm.

## Debug / Failure Points
- Enemies spawn inside obstacles:
  - Check `isValidSpawnPoint()` + obstacle overlap constraints.
- Spawn pressure spikes too early:
  - Check `getEffectiveSpawnRateMultiplier()` and burst schedule consumption.
- Player clipping through boundary under dash:
  - Check player body collision radius + world bounds + obstacle collider setup.
- Camera framing not matching deck design intent:
  - Check follow-camera configuration vs fixed-camera target.
- Boss entry feels random instead of thematic:
  - Check `getSpawnPosition()` fallback candidate logic.

## Next Iteration Hooks
- Add deck-specific hazard events:
  - storm wave push
  - rolling barrel lane
- Add destructible crate objects with temporary navigation openings.
- Add cannon-interaction set pieces (cover/funnel/hazard hybrid).
- Add variant deck themes (storm/burning/ghost/frozen) with same nav graph.
- Add a dedicated `PIXEL_ART_LAYOUT.md` only if asset production starts to sprawl beyond the current deck docs.
