# Runtime Asset Source of Truth

This project currently uses `assets/` as the runtime asset source of truth.

## Live runtime paths
- Character sprites: `assets/sprites/characters/*`
- Tile sprites: `assets/sprites/tiles/*`
- Prop sprites: `assets/sprites/props/*`
- UI sprites: `assets/ui/*`
- Weapon icons: `assets/weapons/*`
- Audio: `assets/audio/*`
- Atlas: `assets/atlas/*`

## Build behavior
- `scripts/build.mjs` copies `assets/` into `dist/assets/`.
- Runtime loads from `assets/...` keys declared in scene code.

## Notes
- `assets/` is the only runtime asset source-of-truth.
- Keep all production assets under this directory so build output remains deterministic.
