# Runtime Asset Source of Truth

This project currently uses `assets/` as the runtime asset source of truth.

## Live runtime paths
- Player sprites: `assets/sprites/player/*`
- Enemy sprites: `assets/sprites/enemies/*`
- Weapon sprites/icons: `assets/sprites/weapons/*`
- Ship environment sprites: `assets/sprites/environment/ship/*`
- UI sprites: `assets/sprites/ui/*`
- Audio SFX: `assets/audio/sfx/*`
- Audio music: `assets/audio/music/*`
- Atlas: `assets/atlas/*`
- Vendor/raw source packs: `assets/vendor/*`

## Build behavior
- `scripts/build.mjs` copies `assets/` into `dist/assets/`.
- Runtime loads from `assets/...` keys declared in scene code.

## Notes
- `assets/` is the only runtime asset source-of-truth.
- Keep all production assets under this directory so build output remains deterministic.
- Keep third-party raw/source packs under `assets/vendor/` and promote only runtime-selected files into role-based folders.
