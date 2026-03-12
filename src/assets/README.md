# Asset Layout (Staging / Migration)

This folder is a normalized staging layout for future migration work.

Current game runtime still loads from `/assets/...` paths.
For active runtime asset paths, see `/assets/README.md`.

## Structure
- `characters/player/`: player sprites
- `characters/enemies/`: enemy sprites
- `weapons/`: weapon sprites/projectiles (placeholder)
- `props/`: environment props and UI panel textures used in-world/HUD
- `tiles/`: floor/deck tile textures

## Notes
- Files here are copies for organization/mapping only.
- Runtime scenes currently load character rotations from `assets/sprites/characters/*`.
- Keep new production assets in `/assets` until a dedicated migration pass updates preload paths and build copy rules.
