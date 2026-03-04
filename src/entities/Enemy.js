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

const ELITE_TYPE_CONFIGS = {
  speed_boost: {
    tint: 0x76e7ff,
    hpMultiplier: 2.1
  },
  dash_attack: {
    tint: 0xff8f70,
    hpMultiplier: 2.35
  },
  poison_aura: {
    tint: 0x8ef58f,
    hpMultiplier: 2.6
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
    this.isElite = false;
    this.eliteType = null;
    this.abilityNextAtMs = 0;
    this.abilityUntilMs = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.nextPoisonTickAtMs = 0;

    this.setScale(config.scale ?? archetype.scale);
    this.setCircle(config.radius ?? archetype.radius, 0, 0);
    this.setCollideWorldBounds(true);
    this.setTint(config.tint ?? archetype.tint);
  }

  chase(target, deltaMs = 0, nowMs = 0) {
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

    let speedMultiplier = 1;
    if (this.isElite && this.eliteType === "speed_boost") {
      if (nowMs >= this.abilityNextAtMs) {
        this.abilityUntilMs = nowMs + 900;
        this.abilityNextAtMs = nowMs + 4300;
      }
      if (nowMs < this.abilityUntilMs) {
        speedMultiplier = 1.72;
      }
    }

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

    if (this.isElite && this.eliteType === "dash_attack") {
      if (nowMs >= this.abilityNextAtMs) {
        if (distance <= 460) {
          this.abilityUntilMs = nowMs + 240;
          this.dashVx = (dx / distance) * this.speed * 2.95;
          this.dashVy = (dy / distance) * this.speed * 2.95;
        }
        this.abilityNextAtMs = nowMs + 3200;
      }

      if (nowMs < this.abilityUntilMs) {
        this.body.setVelocity(this.dashVx + this.knockbackVx, this.dashVy + this.knockbackVy);
        return;
      }
    }

    const chaseVx = (dx / distance) * this.speed * speedMultiplier;
    const chaseVy = (dy / distance) * this.speed * speedMultiplier;
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

  setElite(eliteType) {
    const eliteConfig = ELITE_TYPE_CONFIGS[eliteType] ?? ELITE_TYPE_CONFIGS.speed_boost;
    this.isElite = true;
    this.eliteType = eliteType;
    this.abilityNextAtMs = 0;
    this.abilityUntilMs = 0;
    this.nextPoisonTickAtMs = 0;

    this.hp = Math.round(this.hp * eliteConfig.hpMultiplier);
    this.damage = Math.round(this.damage * 1.35);
    this.speed *= 1.1;
    this.baseSpeed = this.speed;
    this.xpValue = Math.round(this.xpValue * 2.2);

    this.setScale(this.scaleX * 1.14, this.scaleY * 1.14);
    this.setTint(eliteConfig.tint);
  }

  tryApplyPoisonAura(target, nowMs) {
    if (!this.isElite || this.eliteType !== "poison_aura") {
      return false;
    }

    const auraRadius = 98;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (distance > auraRadius) {
      return false;
    }

    if (nowMs < this.nextPoisonTickAtMs) {
      return false;
    }
    this.nextPoisonTickAtMs = nowMs + 650;

    const auraDamage = Math.max(4, Math.round(this.damage * 0.45));
    return target.takeDamage(auraDamage, nowMs);
  }

  isDead() {
    return this.hp <= 0;
  }
}

export { ENEMY_ARCHETYPE_CONFIGS, ELITE_TYPE_CONFIGS };
