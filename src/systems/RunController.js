import { DIRECTOR_STATE } from "./DirectorSystem.js";

export class RunController {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.comboResetWindowMs = config.comboResetWindowMs ?? 2000;
  }

  update(time, delta) {
    const scene = this.scene;
    const isRunSummaryOpen = scene.scene.isActive("RunSummaryScene");
    if (isRunSummaryOpen) {
      scene.setDomHudVisible(false);
      if (scene.input?.enabled) {
        scene.input.enabled = false;
      }
      return;
    }
    scene.setDomHudVisible(true);
    if (scene.input && !scene.input.enabled) {
      scene.input.enabled = true;
    }

    scene.updateHelpOverlayPresentation();
    scene.updateSeaWaves(time);
    scene.handlePlaytestHotkeys();
    scene.updateEdgeFogOverlay();

    if (scene.isGameOver) {
      scene.updateBossProjectiles(time);
      scene.updateEnemyHealthBars();
      scene.updateLowHealthVignette();
      scene.updateDashCooldownRing();
      scene.updateOffscreenEnemyIndicators();
      scene.updateDebugDirectorOverlay();
      scene.handleGameOverInput();
      return;
    }

    if (scene.isLeveling) {
      scene.handleLevelUpInput();
      scene.updateBossProjectiles(time);
      scene.player.body?.setVelocity(0, 0);
      scene.updateEnemyHealthBars();
      scene.updateLowHealthVignette();
      scene.updateDashCooldownRing();
      scene.updateOffscreenEnemyIndicators();
      scene.updateDebugDirectorOverlay();
      scene.updateHUD();
      return;
    }

    if (scene.isWeaponSelecting) {
      const hasSelectionUi = Array.isArray(scene.weaponSelectionUi) && scene.weaponSelectionUi.some((obj) => obj?.active !== false);
      if (!hasSelectionUi) {
        scene.forceCloseWeaponSelectionWithFallback();
      }
      if (!scene.isWeaponSelecting) {
        // Fallback may have resumed gameplay in this frame.
      } else {
        scene.handleWeaponSelectionInput();
        scene.updateBossProjectiles(time);
        scene.player.body?.setVelocity(0, 0);
        scene.updateEnemyHealthBars();
        scene.updateLowHealthVignette();
        scene.updateDashCooldownRing();
        scene.updateOffscreenEnemyIndicators();
        scene.updateDebugDirectorOverlay();
        scene.updateHUD();
        return;
      }
    }

    const stateChanged = scene.director.update(delta);
    if (stateChanged && scene.director.getState() === DIRECTOR_STATE.PEAK) {
      scene.cameras.main.shake(180, 0.0028);
    }

    scene.runTimeMs += delta;
    scene.playTime += delta;
    if ((scene.time?.now ?? 0) - scene.lastKillAtMs > this.comboResetWindowMs) {
      scene.killCombo = 0;
    }
    scene.updateBossApproachWarning();
    scene.spawnAccumulatorMs += delta;
    scene.processDirectorBossSpawns();
    scene.processDirectorMiniBossSpawns();
    scene.processDirectorSpawnBursts();
    scene.processDirectorLadderSpawns();
    scene.processDirectorHatchBreaches();

    const spawnRateMultiplier = scene.getEffectiveSpawnRateMultiplier();
    const effectiveSpawnIntervalMs = scene.baseSpawnCheckIntervalMs / Math.max(0.2, spawnRateMultiplier);
    while (scene.spawnAccumulatorMs >= effectiveSpawnIntervalMs) {
      scene.spawnAccumulatorMs -= effectiveSpawnIntervalMs;
      scene.maintainEnemyDensity();
    }

    if (Phaser.Input.Keyboard.JustDown(scene.keys.dash) || scene.consumeKeyboardDash() || scene.consumeTouchDash()) {
      scene.tryPerformPlayerDash();
    }

    scene.player.updateDash(delta);
    scene.updateBossProjectiles(time);
    scene.emitDashTrail(delta);
    scene.player.moveFromInput(scene.keys, scene.getTouchMoveInput());
    scene.constrainActorToShipDeck(scene.player, 18);
    scene.player.updateMotionVisual(time);
    scene.updatePlayerReadabilityAura();
    scene.pullXpOrbsToPlayer();
    scene.weaponSystem.update(time, delta);
    scene.performAutoAttack(time);

    const speedMultiplier = scene.getEffectiveEnemySpeedMultiplier();
    const damageMultiplier = scene.director.getEnemyDamageMultiplier();
    scene.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }
      enemy.speed = enemy.baseSpeed * speedMultiplier;
      enemy.damage = Math.max(1, Math.round(enemy.baseDamage * damageMultiplier));
      enemy.chase(scene.player, delta, time);
      enemy.tryApplyPoisonAura(scene.player, time);
      if (enemy.updateBossPattern) {
        enemy.updateBossPattern(scene.player, time);
      }
      scene.applyEnemyAntiJam(enemy, time);
      scene.constrainActorToShipDeck(enemy, enemy.getData("isBoss") ? 42 : 18);
    });

    if (scene.player.isDead()) {
      scene.triggerGameOver();
      return;
    }

    scene.updateEnemyHealthBars();
    scene.updateLowHealthVignette();
    scene.updateDashCooldownRing();
    scene.updateOffscreenEnemyIndicators();
    scene.updateDebugDirectorOverlay();
    scene.updateHUD();
  }
}
