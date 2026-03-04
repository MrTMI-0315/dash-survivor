const ENEMY_ARCHETYPE_CONFIGS = {
  chaser: {
    speed: 110,
    hp: 14,
    damage: 10,
    xpValue: 10,
    radius: 14,
    scale: 1.0,
    tint: 0xff6d6d
  },
  tank: {
    speed: 52,
    hp: 70,
    damage: 14,
    xpValue: 20,
    radius: 18,
    scale: 1.28,
    tint: 0xffb05b
  },
  swarm: {
    speed: 84,
    hp: 8,
    damage: 5,
    xpValue: 4,
    radius: 10,
    scale: 0.8,
    tint: 0xff8a9c
  }
};

function getArchetypeConfig(type) {
  return ENEMY_ARCHETYPE_CONFIGS[type] ?? ENEMY_ARCHETYPE_CONFIGS.chaser;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, "enemy");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.type = config.type ?? "chaser";
    const archetype = getArchetypeConfig(this.type);

    this.speed = config.speed ?? archetype.speed;
    this.baseSpeed = this.speed;
    this.damage = config.damage ?? archetype.damage;
    this.hp = config.hp ?? archetype.hp;
    this.xpValue = config.xpValue ?? archetype.xpValue;
    this.knockbackVx = 0;
    this.knockbackVy = 0;

    this.setScale(config.scale ?? archetype.scale);
    this.setCircle(config.radius ?? archetype.radius, 0, 0);
    this.setCollideWorldBounds(true);
    this.setTint(config.tint ?? archetype.tint);
  }

  chase(target, deltaMs = 0) {
    if (!this.active || !target.active) {
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      this.body.setVelocity(this.knockbackVx, this.knockbackVy);
      return;
    }

    const chaseVx = (dx / distance) * this.speed;
    const chaseVy = (dy / distance) * this.speed;

    const dt = Math.max(1, deltaMs);
    // Exponential decay: knockback quickly fades out to preserve snappy combat feel.
    const decay = Math.pow(0.08, dt / 160);
    this.knockbackVx *= decay;
    this.knockbackVy *= decay;

    if (Math.abs(this.knockbackVx) < 6) {
      this.knockbackVx = 0;
    }
    if (Math.abs(this.knockbackVy) < 6) {
      this.knockbackVy = 0;
    }

    this.body.setVelocity(chaseVx + this.knockbackVx, chaseVy + this.knockbackVy);
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);

    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.clearTint();
      }
    });
  }

  applyKnockbackFrom(sourceX, sourceY, force) {
    const dx = this.x - sourceX;
    const dy = this.y - sourceY;
    const distance = Math.hypot(dx, dy);
    const nx = distance > 0.0001 ? dx / distance : 1;
    const ny = distance > 0.0001 ? dy / distance : 0;

    this.knockbackVx += nx * force;
    this.knockbackVy += ny * force;

    const maxKnockbackSpeed = 520;
    const kbSpeed = Math.hypot(this.knockbackVx, this.knockbackVy);
    if (kbSpeed > maxKnockbackSpeed) {
      const scale = maxKnockbackSpeed / kbSpeed;
      this.knockbackVx *= scale;
      this.knockbackVy *= scale;
    }
  }

  isDead() {
    return this.hp <= 0;
  }
}

export { ENEMY_ARCHETYPE_CONFIGS };
