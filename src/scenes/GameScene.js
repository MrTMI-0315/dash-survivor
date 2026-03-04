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
  }
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.spawnIntervalMs = 1100;
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
      restart: Phaser.Input.Keyboard.KeyCodes.R
    });

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
    this.physics.add.overlap(this.player, this.xpOrbs, this.handleXpOrbPickup, null, this);

    this.time.addEvent({
      delay: this.spawnIntervalMs,
      loop: true,
      callback: this.spawnEnemy,
      callbackScope: this
    });

    for (let i = 0; i < 4; i += 1) {
      this.spawnEnemy();
    }

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

    this.updateHud();
  }

  update(time) {
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

  spawnEnemy() {
    if (this.isGameOver || this.isLeveling) {
      return;
    }

    const side = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = Phaser.Math.Between(0, WORLD_WIDTH);
      y = 10;
    } else if (side === 1) {
      x = WORLD_WIDTH - 10;
      y = Phaser.Math.Between(0, WORLD_HEIGHT);
    } else if (side === 2) {
      x = Phaser.Math.Between(0, WORLD_WIDTH);
      y = WORLD_HEIGHT - 10;
    } else {
      x = 10;
      y = Phaser.Math.Between(0, WORLD_HEIGHT);
    }

    const enemy = new Enemy(this, x, y, {
      hp: 20,
      speed: 80,
      damage: 10,
      xpValue: 10
    });

    this.enemies.add(enemy);
  }

  handlePlayerEnemyCollision(player, enemy) {
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

  updateHud() {
    const activeEnemies = this.enemies.getChildren().filter((enemy) => enemy.active).length;
    this.hudText.setText(
      `LV ${this.level}   HP ${this.player.hp}/${this.player.maxHp}   XP ${this.currentXp}/${this.xpToNext}   Enemies ${activeEnemies}`
    );
  }
}
