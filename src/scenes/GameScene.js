import { Player } from "../entities/Player.js";
import { BossEnemy } from "../entities/BossEnemy.js";
import { DirectorSystem, DIRECTOR_STATE } from "../Systems/DirectorSystem.js";
import { WeaponSystem } from "../Systems/WeaponSystem.js";
import { MetaProgressionSystem } from "../Systems/MetaProgressionSystem.js";
import { ObjectPool } from "../Systems/ObjectPool.js";
import { ENEMY_ARCHETYPE_CONFIGS, ENEMY_TYPE_WEIGHTS } from "../config/enemies.js";
import { LEVEL_UP_UPGRADES } from "../config/weapons.js";
import {
  BASE_SPAWN_CHECK_INTERVAL_MS,
  ENEMY_POOL_SIZE,
  SAFE_RADIUS,
  SPAWN_BURST_CONFIG,
  TARGET_ENEMY_CURVE,
  TARGET_ENEMY_FALLBACK,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  XP_REQUIREMENTS
} from "../config/progression.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.safeRadius = SAFE_RADIUS;
    this.baseSpawnCheckIntervalMs = BASE_SPAWN_CHECK_INTERVAL_MS;
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.targetEnemies = 0;
    this.hudAlertHideEvent = null;

    this.attackIntervalMs = 800;
    this.attackRange = 120;
    this.attackDamage = 10;
    this.lastAttackAt = 0;
    this.totalXp = 0;
    this.level = 1;
    this.currentXp = 0;
    this.xpToNext = 50;
    this.pendingLevelUps = 0;
    this.isLeveling = false;
    this.levelUpUi = [];
    this.isGameOver = false;
    this.damageEmitter = null;
    this.metaSystem = new MetaProgressionSystem();
    this.metaData = this.metaSystem.getData();
    this.metaXpMultiplier = 1;
    this.runMetaCurrency = 0;
    this.lastRunMetaCurrency = 0;
    this.metaSettled = false;
    this.enemyPool = null;
  }

  create() {
    this.isGameOver = false;
    this.totalXp = 0;
    this.level = 1;
    this.currentXp = 0;
    this.xpToNext = this.getXpRequirement(this.level);
    this.pendingLevelUps = 0;
    this.isLeveling = false;
    this.levelUpUi = [];
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.targetEnemies = 0;
    this.hudAlertHideEvent = null;
    this.metaData = this.metaSystem.getData();
    this.metaXpMultiplier = 1;
    this.runMetaCurrency = 0;
    this.lastRunMetaCurrency = 0;
    this.metaSettled = false;
    this.director = new DirectorSystem();

    this.createTextures();
    this.drawArena();
    this.createDamageEmitter();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.enemies = this.add.group();
    this.enemyPool = new ObjectPool(this, this.enemies, { initialSize: ENEMY_POOL_SIZE });
    this.xpOrbs = this.physics.add.group();

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      meta1: Phaser.Input.Keyboard.KeyCodes.ONE,
      meta2: Phaser.Input.Keyboard.KeyCodes.TWO,
      meta3: Phaser.Input.Keyboard.KeyCodes.THREE,
      meta4: Phaser.Input.Keyboard.KeyCodes.FOUR
    });

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
    this.physics.add.overlap(this.player, this.xpOrbs, this.handleXpOrbPickup, null, this);
    this.weaponSystem = new WeaponSystem(this, this.player);
    this.weaponSystem.addWeapon("dagger");
    this.weaponSystem.addWeapon("fireball");
    this.applyMetaBonusesForRun();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.hudText = this.add
      .text(16, 14, "", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#f8fbff",
        stroke: "#0f1728",
        strokeThickness: 4
      })
      .setScrollFactor(0)
      .setDepth(10);

    this.gameOverText = this.add
      .text(640, 360, "GAME OVER", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ffdad7",
        align: "center",
        stroke: "#1a1010",
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12)
      .setVisible(false);

    this.hudAlertText = this.add
      .text(640, 74, "", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#ffd76c",
        stroke: "#2e1b08",
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    this.maintainEnemyDensity();
    this.updateHud();
  }

  update(time, delta) {
    if (this.isGameOver) {
      this.handleGameOverInput();
      return;
    }

    if (this.isLeveling) {
      this.player.body.setVelocity(0, 0);
      this.updateHud();
      return;
    }

    const stateChanged = this.director.update(delta);
    if (stateChanged && this.director.getState() === DIRECTOR_STATE.PEAK) {
      this.cameras.main.shake(180, 0.0028);
    }

    this.runTimeMs += delta;
    this.spawnAccumulatorMs += delta;
    this.processDirectorBossSpawns();

    const spawnRateMultiplier = this.getEffectiveSpawnRateMultiplier();
    const effectiveSpawnIntervalMs = this.baseSpawnCheckIntervalMs / Math.max(0.2, spawnRateMultiplier);
    while (this.spawnAccumulatorMs >= effectiveSpawnIntervalMs) {
      this.spawnAccumulatorMs -= effectiveSpawnIntervalMs;
      this.maintainEnemyDensity();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) {
      this.player.tryDash();
    }

    this.player.updateDash(delta);
    this.player.moveFromInput(this.keys);
    this.pullXpOrbsToPlayer();
    this.weaponSystem.update(time, delta);
    this.performAutoAttack(time);

    const speedMultiplier = this.getEffectiveEnemySpeedMultiplier();
    const damageMultiplier = this.director.getEnemyDamageMultiplier();
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }
      enemy.speed = enemy.baseSpeed * speedMultiplier;
      enemy.damage = Math.max(1, Math.round(enemy.baseDamage * damageMultiplier));
      enemy.chase(this.player, delta, time);
      enemy.tryApplyPoisonAura(this.player, time);
      if (enemy.updateBossPattern) {
        enemy.updateBossPattern(this.player, time);
      }
    });

    if (this.player.isDead()) {
      this.triggerGameOver();
      return;
    }

    this.updateHud();
  }

  createTextures() {
    this.generateCircleTexture("player", 16, 0x53d8fb, 0x1f7fa5);
    this.generateCircleTexture("enemy", 14, 0xff6d6d, 0xad3434);
    this.generateCircleTexture("xp_orb", 6, 0x66f5b2, 0x1f8d63);
    this.generateCircleTexture("proj_dagger", 4, 0xeef7ff, 0x7895af);
    this.generateCircleTexture("proj_fireball", 8, 0xff944d, 0xa84d1b);
    this.generateCircleTexture("proj_meteor", 11, 0xff8b44, 0x70220d);
    this.generateCircleTexture("proj_orbit_blade", 7, 0xc6e5ff, 0x5884ad);
    this.generateCircleTexture("hit_particle", 2, 0xffffff, 0xffffff);
  }

  createDamageEmitter() {
    if (this.damageEmitter) {
      this.damageEmitter.destroy();
    }

    this.damageEmitter = this.add.particles(0, 0, "hit_particle", {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 45, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 90, max: 220 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xffd6ad, 0xffb87f],
      blendMode: "ADD"
    });
    this.damageEmitter.setDepth(9);
  }

  spawnDamageParticles(x, y, count = 5) {
    if (!this.damageEmitter) {
      return;
    }
    this.damageEmitter.explode(Math.max(3, Math.min(12, count)), x, y);
  }

  generateCircleTexture(key, radius, fillColor, strokeColor) {
    if (this.textures.exists(key)) {
      return;
    }

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(fillColor, 1);
    gfx.fillCircle(radius, radius, radius);
    gfx.lineStyle(2, strokeColor, 1);
    gfx.strokeCircle(radius, radius, radius);
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();
  }

  drawArena() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x101826, 1);
    graphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    graphics.lineStyle(1, 0x2a3b59, 0.35);
    const grid = 60;
    for (let x = 0; x <= WORLD_WIDTH; x += grid) {
      graphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += grid) {
      graphics.lineBetween(0, y, WORLD_WIDTH, y);
    }
  }

  getTargetEnemyCount(seconds) {
    for (let i = 0; i < TARGET_ENEMY_CURVE.length; i += 1) {
      const segment = TARGET_ENEMY_CURVE[i];
      if (seconds < segment.endSec) {
        const duration = Math.max(1, segment.endSec - segment.startSec);
        const progress = (seconds - segment.startSec) / duration;
        return Phaser.Math.Linear(segment.from, segment.to, progress);
      }
    }
    return TARGET_ENEMY_FALLBACK;
  }

  getSpawnBurst(seconds, deficit) {
    let burst = SPAWN_BURST_CONFIG.defaultBurst;
    for (let i = 0; i < SPAWN_BURST_CONFIG.steps.length; i += 1) {
      if (seconds >= SPAWN_BURST_CONFIG.steps[i].atSec) {
        burst = SPAWN_BURST_CONFIG.steps[i].burst;
      }
    }
    return Math.min(deficit, burst);
  }

  getEffectiveSpawnRateMultiplier() {
    return this.director.getSpawnRateMultiplier();
  }

  getEffectiveEnemySpeedMultiplier() {
    return this.director.getEnemySpeedMultiplier();
  }

  maintainEnemyDensity() {
    if (this.isGameOver || this.isLeveling) {
      return;
    }

    const seconds = this.runTimeMs / 1000;
    const baseTarget = this.getTargetEnemyCount(seconds);
    const spawnRateMultiplier = this.getEffectiveSpawnRateMultiplier();
    this.targetEnemies = Math.round(baseTarget * spawnRateMultiplier);

    const aliveEnemies = this.getAliveEnemyCount();
    if (aliveEnemies >= this.targetEnemies) {
      return;
    }

    const deficit = this.targetEnemies - aliveEnemies;
    const spawnCount = this.getSpawnBurst(seconds, deficit);
    for (let i = 0; i < spawnCount; i += 1) {
      this.spawnEnemyFromEdge();
    }
  }

  spawnEnemyFromEdge() {
    if (this.isGameOver || this.isLeveling) {
      return;
    }

    const type = this.pickEnemyArchetype();
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    const baseHp = ENEMY_ARCHETYPE_CONFIGS[type]?.hp ?? ENEMY_ARCHETYPE_CONFIGS.chaser.hp;
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier));
    const groupCount = type === "swarm" ? Phaser.Math.Between(3, 5) : 1;
    const anchor = this.getSpawnPosition();

    for (let i = 0; i < groupCount; i += 1) {
      const jitter = type === "swarm" ? Phaser.Math.Between(12, 48) : 0;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      let spawnX = Phaser.Math.Clamp(anchor.x + Math.cos(angle) * jitter, 12, WORLD_WIDTH - 12);
      let spawnY = Phaser.Math.Clamp(anchor.y + Math.sin(angle) * jitter, 12, WORLD_HEIGHT - 12);

      if (!this.isValidSpawnPoint(spawnX, spawnY)) {
        const fallback = this.getSpawnPosition();
        spawnX = fallback.x;
        spawnY = fallback.y;
      }

      const enemy = this.enemyPool.acquire(type, { x: spawnX, y: spawnY, hp: scaledHp });
      if (!enemy) {
        continue;
      }
      enemy.setData("lastDashHitId", -1);
      enemy.setData("archetype", type);

      const eliteChance = this.director.getEliteChance();
      const isElite = type !== "swarm" && Math.random() < eliteChance;
      enemy.setData("isElite", isElite);
      enemy.setData("eliteType", null);
      if (isElite) {
        const eliteType = this.pickEliteType();
        enemy.setData("eliteType", eliteType);
        enemy.setElite(eliteType);
      }

    }
  }

  processDirectorBossSpawns() {
    const pendingBossSpawns = this.director.consumeBossSpawnRequests();
    for (let i = 0; i < pendingBossSpawns; i += 1) {
      this.spawnBossEnemy();
    }
  }

  spawnBossEnemy() {
    const spawnPosition = this.getSpawnPosition();
    const boss = new BossEnemy(this, spawnPosition.x, spawnPosition.y);
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    boss.hp = Math.max(1, Math.round(boss.hp * hpMultiplier));
    boss.setData("lastDashHitId", -1);
    boss.setData("archetype", "boss");
    this.enemies.add(boss);

    this.cameras.main.shake(210, 0.0048);
    this.showHudAlert("BOSS INCOMING");
  }

  showHudAlert(message, durationMs = 1600) {
    this.hudAlertText.setText(message);
    this.hudAlertText.setVisible(true);

    if (this.hudAlertHideEvent) {
      this.hudAlertHideEvent.remove(false);
    }
    this.hudAlertHideEvent = this.time.delayedCall(durationMs, () => {
      this.hudAlertText.setVisible(false);
      this.hudAlertHideEvent = null;
    });
  }

  getSpawnPosition() {
    const view = this.cameras.main.worldView;
    const margin = 90;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const side = Phaser.Math.Between(0, 3);
      let x;
      let y;

      if (side === 0) {
        x = Phaser.Math.Between(view.left, view.right);
        y = view.top - margin;
      } else if (side === 1) {
        x = view.right + margin;
        y = Phaser.Math.Between(view.top, view.bottom);
      } else if (side === 2) {
        x = Phaser.Math.Between(view.left, view.right);
        y = view.bottom + margin;
      } else {
        x = view.left - margin;
        y = Phaser.Math.Between(view.top, view.bottom);
      }

      x = Phaser.Math.Clamp(x, 12, WORLD_WIDTH - 12);
      y = Phaser.Math.Clamp(y, 12, WORLD_HEIGHT - 12);

      const isOutsideView = !Phaser.Geom.Rectangle.Contains(view, x, y);
      const isOutsideSafeRadius = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) > this.safeRadius;
      if (isOutsideView && isOutsideSafeRadius) {
        return { x, y };
      }
    }

    const fallbackCandidates = [
      {
        x: Phaser.Math.Clamp(view.left - margin, 12, WORLD_WIDTH - 12),
        y: Phaser.Math.Clamp(Phaser.Math.Between(view.top, view.bottom), 12, WORLD_HEIGHT - 12)
      },
      {
        x: Phaser.Math.Clamp(view.right + margin, 12, WORLD_WIDTH - 12),
        y: Phaser.Math.Clamp(Phaser.Math.Between(view.top, view.bottom), 12, WORLD_HEIGHT - 12)
      },
      {
        x: Phaser.Math.Clamp(Phaser.Math.Between(view.left, view.right), 12, WORLD_WIDTH - 12),
        y: Phaser.Math.Clamp(view.top - margin, 12, WORLD_HEIGHT - 12)
      },
      {
        x: Phaser.Math.Clamp(Phaser.Math.Between(view.left, view.right), 12, WORLD_WIDTH - 12),
        y: Phaser.Math.Clamp(view.bottom + margin, 12, WORLD_HEIGHT - 12)
      }
    ];

    let best = fallbackCandidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    fallbackCandidates.forEach((candidate) => {
      const outsideBonus = Phaser.Geom.Rectangle.Contains(view, candidate.x, candidate.y) ? 0 : 100000;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y);
      const score = outsideBonus + distance;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });

    return best;
  }

  isValidSpawnPoint(x, y) {
    const view = this.cameras.main.worldView;
    const isOutsideView = !Phaser.Geom.Rectangle.Contains(view, x, y);
    const isOutsideSafeRadius = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) > this.safeRadius;
    return isOutsideView && isOutsideSafeRadius;
  }

  pickEnemyArchetype() {
    const totalWeight = ENEMY_TYPE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < ENEMY_TYPE_WEIGHTS.length; i += 1) {
      roll -= ENEMY_TYPE_WEIGHTS[i].weight;
      if (roll <= 0) {
        return ENEMY_TYPE_WEIGHTS[i].type;
      }
    }

    return "chaser";
  }

  pickEliteType() {
    const roll = Math.random();
    if (roll < 0.34) {
      return "speed_boost";
    }
    if (roll < 0.67) {
      return "dash_attack";
    }
    return "poison_aura";
  }

  handlePlayerEnemyCollision(player, enemy) {
    if (player.isDashing()) {
      const lastDashHitId = enemy.getData("lastDashHitId") ?? -1;
      if (lastDashHitId === player.currentDashId) {
        return;
      }

      enemy.setData("lastDashHitId", player.currentDashId);
      enemy.takeDamage(player.dashDamage);
      enemy.applyKnockbackFrom(player.x, player.y, 360);

      if (enemy.isDead()) {
        this.handleEnemyDefeat(enemy);
      }
      return;
    }

    const damaged = player.takeDamage(enemy.damage, this.time.now);
    if (!damaged) {
      return;
    }
    this.cameras.main.shake(85, 0.0019);

    if (!player.isDead()) {
      return;
    }
    this.triggerGameOver();
  }

  performAutoAttack(now) {
    if (now - this.lastAttackAt < this.attackIntervalMs) {
      return;
    }

    let nearestEnemy = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance > this.attackRange || distance >= nearestDistance) {
        return;
      }

      nearestDistance = distance;
      nearestEnemy = enemy;
    });

    if (!nearestEnemy) {
      return;
    }

    this.lastAttackAt = now;
    nearestEnemy.takeDamage(this.attackDamage);
    nearestEnemy.applyKnockbackFrom(this.player.x, this.player.y, 140);

    const flash = this.add.graphics();
    flash.lineStyle(2, 0x89e8ff, 1);
    flash.lineBetween(this.player.x, this.player.y, nearestEnemy.x, nearestEnemy.y);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.destroy()
    });

    if (nearestEnemy.isDead()) {
      this.handleEnemyDefeat(nearestEnemy);
    }
  }

  spawnXpOrb(x, y, value) {
    const orb = this.xpOrbs.create(x, y, "xp_orb");
    orb.setCircle(6, 0, 0);
    orb.xpValue = value;
  }

  handleEnemyDefeat(enemy) {
    if (!enemy || !enemy.active) {
      return;
    }

    this.spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);

    if (enemy.getData("pooledEnemy") === true) {
      this.enemyPool.release(enemy);
      return;
    }

    enemy.destroy();
  }

  handleXpOrbPickup(_, orb) {
    if (!orb.active) {
      return;
    }

    this.gainXp(orb.xpValue ?? 0);
    orb.destroy();
  }

  gainXp(amount) {
    const baseAmount = Math.max(0, Math.round(amount));
    const effectiveAmount = Math.max(0, Math.round(baseAmount * this.metaXpMultiplier));

    if (baseAmount > 0) {
      this.runMetaCurrency += Math.max(1, Math.floor(baseAmount / 10));
    }

    this.totalXp += effectiveAmount;
    this.currentXp += effectiveAmount;

    while (this.currentXp >= this.xpToNext) {
      this.currentXp -= this.xpToNext;
      this.level += 1;
      this.pendingLevelUps += 1;
      this.xpToNext = this.getXpRequirement(this.level);
    }

    if (!this.isLeveling && this.pendingLevelUps > 0) {
      this.openLevelUpChoices();
    }
  }

  getXpRequirement(level) {
    if (XP_REQUIREMENTS.byLevel[level] !== undefined) {
      return XP_REQUIREMENTS.byLevel[level];
    }
    return XP_REQUIREMENTS.postL3Base + (level - 3) * XP_REQUIREMENTS.postL3Step;
  }

  openLevelUpChoices() {
    if (this.pendingLevelUps <= 0) {
      return;
    }

    this.pendingLevelUps -= 1;
    this.isLeveling = true;
    this.physics.pause();
    this.player.body.setVelocity(0, 0);

    const centerX = 640;
    const centerY = 360;
    const panel = this.add
      .rectangle(centerX, centerY, 520, 360, 0x070d18, 0.96)
      .setStrokeStyle(2, 0x4f607d, 1)
      .setScrollFactor(0)
      .setDepth(30);

    const title = this.add
      .text(centerX, centerY - 130, "Level Up - Choose One", {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#f8fbff"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);

    const choices = Phaser.Utils.Array.Shuffle([...LEVEL_UP_UPGRADES]).slice(0, 3);
    const optionObjects = [];

    choices.forEach((upgrade, index) => {
      const y = centerY - 45 + index * 92;
      const box = this.add
        .rectangle(centerX, y, 450, 72, 0x17233a, 1)
        .setStrokeStyle(1, 0x4f607d, 1)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(31);

      const label = this.add
        .text(centerX, y, `${upgrade.label} - ${upgrade.description}`, {
          fontFamily: "Arial",
          fontSize: "21px",
          color: "#e9f4ff"
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(32);

      const chooseUpgrade = () => {
        this.applyLevelUpUpgrade(upgrade);
        this.closeLevelUpChoices();
      };
      box.on("pointerdown", chooseUpgrade);
      label.setInteractive({ useHandCursor: true }).on("pointerdown", chooseUpgrade);

      optionObjects.push(box, label);
    });

    this.levelUpUi = [panel, title, ...optionObjects];
  }

  applyLevelUpUpgrade(upgrade) {
    if (!upgrade) {
      return;
    }

    if (upgrade.id === "weapon_damage") {
      this.weaponSystem.addGlobalDamagePercent(upgrade.value);
      return;
    }
    if (upgrade.id === "attack_speed") {
      this.attackIntervalMs = Math.max(180, Math.floor(this.attackIntervalMs * (1 - upgrade.value)));
      this.weaponSystem.addAttackSpeedPercent(upgrade.value);
      return;
    }
    if (upgrade.id === "projectile_count") {
      this.weaponSystem.addProjectileCount(upgrade.value);
      return;
    }
    if (upgrade.id === "movement_speed") {
      this.player.speed += upgrade.value;
      return;
    }
    if (upgrade.id === "pickup_radius") {
      this.player.pickupRadius += upgrade.value;
    }
  }

  pullXpOrbsToPlayer() {
    const pickupRadius = Math.max(0, this.player.pickupRadius || 0);
    if (pickupRadius <= 0) {
      return;
    }

    this.xpOrbs.getChildren().forEach((orb) => {
      if (!orb.active || !orb.body) {
        return;
      }

      const dx = this.player.x - orb.x;
      const dy = this.player.y - orb.y;
      const distance = Math.hypot(dx, dy);
      if (distance > pickupRadius) {
        orb.body.setVelocity(0, 0);
        return;
      }

      const nx = distance > 0.0001 ? dx / distance : 0;
      const ny = distance > 0.0001 ? dy / distance : 0;
      const pullStrength = Phaser.Math.Linear(220, 480, 1 - Phaser.Math.Clamp(distance / pickupRadius, 0, 1));
      orb.body.setVelocity(nx * pullStrength, ny * pullStrength);
    });
  }

  closeLevelUpChoices() {
    this.levelUpUi.forEach((obj) => obj.destroy());
    this.levelUpUi = [];

    this.isLeveling = false;
    this.physics.resume();

    if (this.pendingLevelUps > 0) {
      this.openLevelUpChoices();
    }
  }

  applyMetaBonusesForRun() {
    const bonuses = this.metaSystem.getRunBonuses();
    this.metaXpMultiplier = bonuses.xpMultiplier;

    this.player.maxHp += bonuses.maxHpFlat;
    this.player.hp = this.player.maxHp;
    this.player.speed += bonuses.speedFlat;

    if (bonuses.startingWeaponBonus > 0) {
      this.weaponSystem.addWeapon("lightning");
    }
  }

  finalizeMetaRun() {
    if (this.metaSettled) {
      return;
    }

    this.metaSettled = true;
    this.lastRunMetaCurrency = this.runMetaCurrency;
    this.metaSystem.addCurrency(this.lastRunMetaCurrency);
    this.metaData = this.metaSystem.getData();
    this.runMetaCurrency = 0;
  }

  triggerGameOver() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.physics.pause();
    this.player.body.setVelocity(0, 0);
    this.finalizeMetaRun();
    this.refreshGameOverText();
    this.gameOverText.setVisible(true);
  }

  handleGameOverInput() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta1)) {
      this.tryPurchaseMetaUpgrade("max_hp");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta2)) {
      this.tryPurchaseMetaUpgrade("move_speed");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta3)) {
      this.tryPurchaseMetaUpgrade("xp_gain");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta4)) {
      this.tryPurchaseMetaUpgrade("starting_weapon");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.scene.restart();
    }
  }

  tryPurchaseMetaUpgrade(upgradeKey) {
    const result = this.metaSystem.purchaseUpgrade(upgradeKey);
    if (!result.success) {
      return;
    }

    this.metaData = this.metaSystem.getData();
    this.refreshGameOverText();
  }

  refreshGameOverText() {
    const options = this.metaSystem.getUpgradeOptions();
    const formatCost = (option) => (option.isMaxed ? "MAX" : `${option.cost}C`);

    this.gameOverText.setText(
      [
        "GAME OVER",
        `META +${this.lastRunMetaCurrency}   BANK ${this.metaData.currency}`,
        `[1] Max HP Lv${options.max_hp.level} (${formatCost(options.max_hp)})`,
        `[2] Move Speed Lv${options.move_speed.level} (${formatCost(options.move_speed)})`,
        `[3] XP Gain Lv${options.xp_gain.level} (${formatCost(options.xp_gain)})`,
        `[4] Start Lightning Lv${options.starting_weapon.level} (${formatCost(options.starting_weapon)})`,
        "Press R to restart"
      ].join("\n")
    );
  }

  getAliveEnemyCount() {
    return this.enemies.getChildren().filter((enemy) => enemy.active).length;
  }

  updateHud() {
    const activeEnemies = this.getAliveEnemyCount();
    const dashPercent = Math.floor(this.player.getDashRatio() * 100);
    const directorState = this.director.getState();
    const weaponCount = this.player.weapons.length;
    const passiveCount = Object.keys(this.player.passives).length;
    const metaLiveTotal = this.metaData.currency + this.runMetaCurrency;
    this.hudText.setText(
      `DIR ${directorState}   LV ${this.level}   HP ${this.player.hp}/${this.player.maxHp}   XP ${this.currentXp}/${this.xpToNext}   DASH ${dashPercent}%   META ${metaLiveTotal}   WPN ${weaponCount}/${this.player.maxWeaponSlots}   PAS ${passiveCount}   Enemies ${activeEnemies}/${this.targetEnemies}`
    );
  }
}
