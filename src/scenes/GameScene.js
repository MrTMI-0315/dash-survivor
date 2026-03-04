import { Player } from "../entities/Player.js";
import { Enemy, ENEMY_ARCHETYPE_CONFIGS } from "../entities/Enemy.js";
import { BossEnemy } from "../entities/BossEnemy.js";
import { DirectorSystem, DIRECTOR_STATE } from "../Systems/DirectorSystem.js";
import { WeaponSystem } from "../Systems/WeaponSystem.js";
import { MetaProgressionSystem } from "../Systems/MetaProgressionSystem.js";

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1350;
const BOSS_SPAWN_INTERVAL_MS = 90000;
const DIFFICULTY_STEP_MS = 120000;
const HP_SCALING_PER_STEP = 0.1;
const SPEED_SCALING_PER_STEP = 0.05;
const SPAWN_SCALING_PER_STEP = 0.1;
const ENEMY_TYPE_WEIGHTS = [
  { type: "chaser", weight: 50 },
  { type: "tank", weight: 25 },
  { type: "swarm", weight: 25 }
];
const UPGRADE_POOL = [
  {
    label: "Attack Speed",
    description: "Attack interval -10%",
    apply: (scene) => {
      scene.attackIntervalMs = Math.max(180, Math.floor(scene.attackIntervalMs * 0.9));
    }
  },
  {
    label: "Damage",
    description: "Attack damage +5",
    apply: (scene) => {
      scene.attackDamage += 5;
    }
  },
  {
    label: "Move Speed",
    description: "Move speed +20",
    apply: (scene) => {
      scene.player.speed += 20;
    }
  },
  {
    label: "Attack Range",
    description: "Range +20",
    apply: (scene) => {
      scene.attackRange += 20;
    }
  },
  {
    label: "Dash Recharge",
    description: "Dash charge +20%",
    apply: (scene) => {
      scene.player.dashChargeRate *= 1.2;
    }
  },
  {
    label: "Fireball Weapon",
    description: "Unlock/upgrade Fireball",
    apply: (scene) => {
      scene.weaponSystem.addWeapon("fireball");
    }
  },
  {
    label: "Dagger Weapon",
    description: "Unlock/upgrade Dagger",
    apply: (scene) => {
      scene.weaponSystem.addWeapon("dagger");
    }
  },
  {
    label: "Lightning Weapon",
    description: "Unlock/upgrade Lightning",
    apply: (scene) => {
      scene.weaponSystem.addWeapon("lightning");
    }
  },
  {
    label: "Passive Ember Core",
    description: "Enables Fireball evolution",
    apply: (scene) => {
      const added = scene.player.addPassive("ember_core");
      scene.weaponSystem.onPassiveAcquired();
      if (!added) {
        scene.weaponSystem.addWeapon("fireball");
      }
    }
  },
  {
    label: "Passive Blade Sigil",
    description: "Enables Dagger evolution",
    apply: (scene) => {
      const added = scene.player.addPassive("blade_sigil");
      scene.weaponSystem.onPassiveAcquired();
      if (!added) {
        scene.weaponSystem.addWeapon("dagger");
      }
    }
  }
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.safeRadius = 300;
    this.baseSpawnCheckIntervalMs = 250;
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.targetEnemies = 0;
    this.nextBossSpawnAtMs = BOSS_SPAWN_INTERVAL_MS;
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
    this.nextBossSpawnAtMs = BOSS_SPAWN_INTERVAL_MS;
    this.hudAlertHideEvent = null;
    this.metaData = this.metaSystem.getData();
    this.metaXpMultiplier = 1;
    this.runMetaCurrency = 0;
    this.lastRunMetaCurrency = 0;
    this.metaSettled = false;
    this.director = new DirectorSystem({
      buildMs: 30000,
      peakMs: 15000,
      reliefMs: 8000
    });

    this.createTextures();
    this.drawArena();
    this.createDamageEmitter();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.enemies = this.add.group();
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
    this.updateBossSpawns();

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
    this.weaponSystem.update(time, delta);
    this.performAutoAttack(time);

    const speedMultiplier = this.getEffectiveEnemySpeedMultiplier();
    this.enemies.getChildren().forEach((enemy) => {
      enemy.speed = enemy.baseSpeed * speedMultiplier;
      enemy.chase(this.player, delta, time);
      enemy.tryApplyPoisonAura(this.player, time);
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
    if (seconds < 20) {
      return Phaser.Math.Linear(3, 7, seconds / 20);
    }
    if (seconds < 60) {
      return Phaser.Math.Linear(7, 16, (seconds - 20) / 40);
    }
    if (seconds < 100) {
      return Phaser.Math.Linear(16, 26, (seconds - 60) / 40);
    }
    if (seconds < 150) {
      return Phaser.Math.Linear(26, 18, (seconds - 100) / 50);
    }
    if (seconds < 240) {
      return Phaser.Math.Linear(18, 24, (seconds - 150) / 90);
    }
    return 24;
  }

  getSpawnBurst(seconds, deficit) {
    let burst = 1;
    if (seconds >= 35) {
      burst = 2;
    }
    if (seconds >= 70) {
      burst = 3;
    }
    if (seconds >= 120) {
      burst = 2;
    }
    return Math.min(deficit, burst);
  }

  getDifficultyTier() {
    return Math.floor(this.runTimeMs / DIFFICULTY_STEP_MS);
  }

  getDifficultyMultipliers() {
    const tier = this.getDifficultyTier();
    return {
      tier,
      hpMultiplier: 1 + tier * HP_SCALING_PER_STEP,
      speedMultiplier: 1 + tier * SPEED_SCALING_PER_STEP,
      spawnMultiplier: 1 + tier * SPAWN_SCALING_PER_STEP
    };
  }

  getEffectiveSpawnRateMultiplier() {
    const difficulty = this.getDifficultyMultipliers();
    const directorSpawn = this.director.getSpawnRateMultiplier(difficulty.tier);
    return directorSpawn * difficulty.spawnMultiplier;
  }

  getEffectiveEnemySpeedMultiplier() {
    const difficulty = this.getDifficultyMultipliers();
    const directorSpeed = this.director.getEnemySpeedMultiplier();
    return directorSpeed * difficulty.speedMultiplier;
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
    const difficulty = this.getDifficultyMultipliers();
    const baseHp = ENEMY_ARCHETYPE_CONFIGS[type]?.hp ?? ENEMY_ARCHETYPE_CONFIGS.chaser.hp;
    const scaledHp = Math.max(1, Math.round(baseHp * difficulty.hpMultiplier));
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

      const enemy = new Enemy(this, spawnX, spawnY, { type, hp: scaledHp });
      enemy.setData("lastDashHitId", -1);
      enemy.setData("archetype", type);

      const eliteChance = this.director.getEliteChance();
      const peakBoost = this.director.getState() === DIRECTOR_STATE.PEAK ? 1.55 : 1;
      const adjustedEliteChance = Math.min(0.72, eliteChance * peakBoost);
      const isElite = type !== "swarm" && Math.random() < adjustedEliteChance;
      enemy.setData("isElite", isElite);
      if (isElite) {
        const eliteType = this.pickEliteType();
        enemy.setData("eliteType", eliteType);
        enemy.setElite(eliteType);
      }

      this.enemies.add(enemy);
    }
  }

  updateBossSpawns() {
    while (this.runTimeMs >= this.nextBossSpawnAtMs) {
      this.spawnBossEnemy();
      this.nextBossSpawnAtMs += BOSS_SPAWN_INTERVAL_MS;
    }
  }

  spawnBossEnemy() {
    const spawnPosition = this.getSpawnPosition();
    const boss = new BossEnemy(this, spawnPosition.x, spawnPosition.y);
    const difficulty = this.getDifficultyMultipliers();
    boss.hp = Math.max(1, Math.round(boss.hp * difficulty.hpMultiplier));
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
        this.spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);
        enemy.destroy();
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
      this.spawnXpOrb(nearestEnemy.x, nearestEnemy.y, nearestEnemy.xpValue);
      nearestEnemy.destroy();
    }
  }

  spawnXpOrb(x, y, value) {
    const orb = this.xpOrbs.create(x, y, "xp_orb");
    orb.setCircle(6, 0, 0);
    orb.xpValue = value;
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
    if (level === 1) {
      return 50;
    }
    if (level === 2) {
      return 80;
    }
    if (level === 3) {
      return 120;
    }
    return 120 + (level - 3) * 50;
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

    const choices = Phaser.Utils.Array.Shuffle([...UPGRADE_POOL]).slice(0, 3);
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
        upgrade.apply(this);
        this.closeLevelUpChoices();
      };
      box.on("pointerdown", chooseUpgrade);
      label.setInteractive({ useHandCursor: true }).on("pointerdown", chooseUpgrade);

      optionObjects.push(box, label);
    });

    this.levelUpUi = [panel, title, ...optionObjects];
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
