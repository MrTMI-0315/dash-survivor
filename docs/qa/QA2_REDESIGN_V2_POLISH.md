# QA2 Redesign V2 Polish

## Goal
Lock the first QA feedback loop into code, tests, and documentation before the next asset/gameplay balance pass.

## Source Of Truth
- Environment reference: `assets/generated/redesign_v2/source/v2_environment_source.png`
- Runtime map contract: `docs/gameplay/MAP_SPEC.md`
- UI contract: `docs/ui/UI.md`
- Weapon visual contract: `docs/gameplay/WEAPON_SPEC.md`

## MB Execution Map
| MB | Scope | Completion Signal | Status |
|---|---|---|
| MB0 | Baseline QA record | This document captures QA2 scope and evidence targets. | Done |
| MB1 | Source-image map contract | `REDESIGN_V2_SOURCE_TO_WORLD` and map spec define source-to-world scaling. | Done |
| MB2 | Initial ship readability | Run start uses a brief overview camera before player follow. | Done |
| MB3 | UI ratio repair | Upgrade shop uses responsive panel and row metrics. | Done |
| MB4 | Overlay fit rules | UI spec documents modal fit constraints for future QA. | Done |
| MB5 | Central landmark | Skull banner landmark scale/placement is more visible near the mast. | Done |
| MB6 | Dash regression | Smoke test asserts Space dash consumes gauge and keeps player on deck. | Done |
| MB7 | Projectile/weapon visual boundary | Weapon spec records current visual pairing and deferred re-plan scope. | Done |
| MB8 | Map boundary regression | Smoke test checks source path, source scaling, clamped deck point, and spawn invalidity at player. | Done |
| MB9 | Verification | Build, smoke, and browser screenshots are the required close-out evidence. | Done |

## Closeout Evidence
- Build: `npm run build` passes, raw bundle `1.71MB`, under the `<10MB` target.
- Smoke: `npm run pw:test:smoke` passes on Chromium.
- Browser QA snapshot confirms `v2_environment_source.png` is active, source scale is `1.5625 x 1.9176`, Space dash consumes the gauge, and the player remains inside the ship deck polygon.
- Final gameplay screenshot: `qa2-polish-gameplay.png`.
- Renderer fix: `edge_fog_vignette` now reuses/resizes its CanvasTexture instead of removing a texture that an active overlay image is still rendering.

## Remaining Product Risks
- Weapon behavior remains intentionally deferred because the user flagged it for re-planning.
- Projectile art beyond boss skull bullets still needs a dedicated generation/import pass.
- Boss/miniboss entry is documented as a future bow/stern constraint, but not fully locked by automation yet.
