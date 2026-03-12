# Asset Layout (Staging)

This folder is the normalized asset layout for future runtime migration.

Current game runtime still loads from `/assets/...` paths.
No runtime path changes were made in this pass.

## Structure
- `characters/player/`: player sprites
- `characters/enemies/`: enemy sprites
- `weapons/`: weapon sprites/projectiles (placeholder)
- `props/`: environment props and UI panel textures used in-world/HUD
- `tiles/`: floor/deck tile textures

## Notes
- Files here are copied from `assets/sprites/kenney/*` to avoid breaking current paths.
- Once runtime paths are migrated, old duplicates can be removed in a dedicated cleanup pass.
