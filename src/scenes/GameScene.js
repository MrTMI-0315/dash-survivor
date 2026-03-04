import { Player } from "../entities/Player.js";
import { Enemy } from "../entities/Enemy.js";

const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1350;
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
  }
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.safeRadius = 300;
    this.spawnCheckIntervalMs = 250;
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.targetEnemies = 0;

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

    this.createTextures();
    this.drawArena();

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
      restart: Phaser.Input.Keyboard.KeyCodes.R
    });

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
    this.physics.add.overlap(this.player, this.xpOrbs, this.handleXpOrbPickup, null, this);

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
      .text(640, 360, "GAME OVER\nPress R to restart", {
        fontFamily: "Arial",
        fontSize: "44px",
        color: "#ffdad7",
        align: "center",
        stroke: "#1a1010",
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12)
      .setVisible(false);

    this.maintainEnemyDensity();
    this.updateHud();
  }

  update(time, delta) {
    if (this.isGameOver) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
        this.scene.restart();
      }
      return;
    }

    if (this.isLeveling) {
      this.player.body.setVelocity(0, 0);
      this.updateHud();
      return;
    }

    this.runTimeMs += delta;
    this.spawnAccumulatorMs += delta;
    if (this.spawnAccumulatorMs >= this.spawnCheckIntervalMs) {
      this.spawnAccumulatorMs = 0;
      this.maintainEnemyDensity();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash)) {
      this.player.tryDash();
    }

    this.player.updateDash(delta);
    this.player.moveFromInput(this.keys);
    this.performAutoAttack(time);

    this.enemies.getChildren().forEach((enemy) => {
      enemy.chase(this.player);
    });

    this.updateHud();
  }

  createTextures() {
    this.generateCircleTexture("player", 16, 0x53d8fb, 0x1f7fa5);
    this.generateCircleTexture("enemy", 14, 0xff6d6d, 0xad3434);
    this.generateCircleTexture("xp_orb", 6, 0x66f5b2, 0x1f8d63);
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

  maintainEnemyDensity() {
    if (this.isGameOver || this.isLeveling) {
      return;
    }

    const seconds = this.runTimeMs / 1000;
    this.targetEnemies = Math.round(this.getTargetEnemyCount(seconds));

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

    const spawnPosition = this.getSpawnPosition();
    const enemy = new Enemy(this, spawnPosition.x, spawnPosition.y, {
      hp: 20,
      speed: 80,
      damage: 10,
      xpValue: 10
    });
    enemy.setData("lastDashHitId", -1);

    this.enemies.add(enemy);
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

  handlePlayerEnemyCollision(player, enemy) {
    if (player.isDashing()) {
      const lastDashHitId = enemy.getData("lastDashHitId") ?? -1;
      if (lastDashHitId === player.currentDashId) {
        return;
      }

      enemy.setData("lastDashHitId", player.currentDashId);
      enemy.takeDamage(player.dashDamage);

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

    if (!player.isDead()) {
      return;
    }

    this.isGameOver = true;
    this.physics.pause();
    this.player.body.setVelocity(0, 0);
    this.gameOverText.setVisible(true);
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
    this.totalXp += amount;
    this.currentXp += amount;

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

  getAliveEnemyCount() {
    return this.enemies.getChildren().filter((enemy) => enemy.active).length;
  }

  updateHud() {
    const activeEnemies = this.getAliveEnemyCount();
    const dashPercent = Math.floor(this.player.getDashRatio() * 100);
    this.hudText.setText(
      `LV ${this.level}   HP ${this.player.hp}/${this.player.maxHp}   XP ${this.currentXp}/${this.xpToNext}   DASH ${dashPercent}%   Enemies ${activeEnemies}/${this.targetEnemies}`
    );
  }
}
