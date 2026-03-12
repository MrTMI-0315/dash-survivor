# Runtime Asset Source of Truth

This project currently uses `assets/` as the runtime asset source of truth.

## Live runtime paths
- Character sprites: `assets/sprites/characters/*`
- Legacy/mixed sprites: `assets/sprites/kenney/*`
- Audio: `assets/audio/*`
- Atlas: `assets/atlas/*`

## Build behavior
- `scripts/build.mjs` copies `assets/` into `dist/assets/`.
- Runtime loads from `assets/...` keys declared in scene code.

## Notes
- `src/assets/` is a staging/normalized structure for migration planning.
- Until scene preload paths are migrated, add new production assets under `assets/`.
