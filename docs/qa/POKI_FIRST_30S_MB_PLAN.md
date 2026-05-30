# Poki-first 30s MB Plan

## Decision
Continue from the current redesign-v2 baseline instead of resetting. Preserve the ship-deck arena, promoted runtime assets, dash, auto-combat, XP/level-up loop, QA hooks, and Poki SDK isolation. Stop broad polish work until the first 30 seconds and core boundaries are easier to test.

## MB0 — Baseline Freeze
Status: Done in checkpoint `1e78470`.

Completion evidence:
- `npm run build` passed with raw bundle `1.71MB`.
- `npm run pw:test:smoke` passed on Chromium.
- Runtime assets, QA2 docs, and source map reference were committed.
- Full generated asset workspace and scratch screenshots/logs were left uncommitted.

## MB1 — Contract Reconciliation
Status: In progress.

Scope:
- Align gameplay/docs with current code.
- Make first 30 seconds the next product acceptance target.
- Reclassify 7-10 minute survival depth as a later loop target.
- Keep live Poki portal validation as a manual/credentialed gap.

Completion:
- Product docs distinguish implemented, next, and deferred behavior.
- Weapon passive/evolution docs match current `LEVEL_UP_UPGRADES`.
- Test spec includes a first-30-second gate.

## MB2 — Core Loop Boundary Refactor
Status: Next.

Scope:
- Extract run orchestration from `GameScene.update()` without changing behavior.
- Keep director, player, weapon, enemy, and run-end order explicit.
- Preserve QA hooks.

Completion:
- Existing smoke test passes.
- `GameScene.update()` is reduced to orchestration-level code.
- No balance/pacing changes are mixed into the refactor.

## MB3 — Spawn / Arena Contract Refactor
Status: Pending.

Scope:
- Extract spawn density, lane picking, miniboss, and boss entry logic.
- Move ship-source scaling and arena constants into config.
- Preserve ship-deck containment and invalid spawn behavior.

Completion:
- Player/enemy containment remains true in QA snapshot.
- Player position remains invalid as an enemy spawn point.
- Spawn logic is no longer primarily scene-local.

## MB4 — Combat Contract Consolidation
Status: Pending.

Scope:
- Decide whether legacy direct auto-attack remains a feature.
- Prefer one damage/knockback contract centered on `WeaponSystem`.
- Define where dash collision, edge knockback, and overboard reward attach.

Completion:
- Combat damage paths are documented and testable.
- Legacy `performAutoAttack()` is removed or explicitly justified.
- Existing weapons still fire and defeat enemies.

## MB5 — Poki First 10 Seconds
Status: Pending.

Scope:
- Show visible ship action immediately after weapon selection.
- Make player, enemies, XP, dash affordance, and goal readable within 5 seconds.
- Tune opening raid and camera intro so the first interaction is not delayed.

Completion:
- A first-time player can infer movement, danger, collectible, and reward in one screenshot.
- First level-up is reachable in roughly 15-25 seconds.

## MB6 — Dash As Main Toy
Status: Pending.

Scope:
- Add or prepare dash collision, knockback, and edge/overboard reward behavior.
- Improve dash ready/used feedback.
- Replace generic spectacle text with dash/reward-specific feedback.

Completion:
- Dash produces visible immediate impact.
- Dash reward can be observed or asserted through QA hooks.

## MB7 — Readability / Reward Language Pass
Status: Pending.

Scope:
- Increase contrast and/or scale for player, enemies, XP, projectiles, and danger.
- Reduce deck noise under combat.
- Replace generic reward labels with simple Poki-readable phrases.
- Review weapon names/labels for pirate theme coherence.

Completion:
- Player, enemy, collectible, and reward are visually separable at 1280x720.
- Early HUD does not cover core action.

## MB8 — Input / Mobile Fit
Status: Pending.

Scope:
- Add arrow-key movement support.
- Verify touch joystick and dash button on mobile viewport.
- Check HUD/modal fit across desktop and mobile.
- Confirm input guards do not conflict with play.

Completion:
- Desktop keyboard, arrow keys, and touch controls move the player.
- Dash is reachable on mobile.

## MB9 — Poki Lifecycle Test Gate
Status: Pending.

Scope:
- Upgrade Poki SDK stub to record calls.
- Assert `init`, `gameLoadingFinished`, `gameplayStart`, and `gameplayStop` call counts.
- Assert level-up, game-over, and restart pause/resume states do not spam lifecycle calls.

Completion:
- SDK lifecycle is locally testable without live Poki.
- Gameplay start/stop pairs match active simulation.

## MB10 — 30s Vertical Slice E2E
Status: Pending.

Scope:
- Add e2e coverage for start -> weapon select -> gameplay -> dash -> enemy kill -> XP -> level-up -> upgrade -> resume.
- Capture desktop and mobile QA screenshots.
- Keep the build-size target green.

Completion:
- `first_run_30s.spec.js` or equivalent passes.
- `npm run build` passes under size target.
- Desktop and mobile evidence are recorded.

## MB11 — Commit / Package Hygiene
Status: Pending.

Scope:
- Keep runtime assets and necessary QA docs.
- Exclude scratch screenshots, console logs, and unused generated sources unless explicitly needed.
- Follow the Lore commit protocol.

Completion:
- Staged diff contains intentional product changes and evidence only.
- Build/smoke/30s gates pass.
- Remaining live Poki portal gaps are listed.
