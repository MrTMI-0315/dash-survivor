import { Enemy } from "./Enemy.js";

const BOSS_VARIANTS = {
  boss: {
    hp: 1800,
    speed: 52,
    damage: 44,
    xpValue: 600,
    radius: 34,
    scale: 2.6,
    tint: 0x6d34ff,
    shockwaveIntervalMs: 2500,
    shockwaveRadius: 190,
    rushIntervalMs: 5000,
    rushDurationMs: 320,
    rushSpeedMultiplier: 2.65
  },
  mini: {
    hp: 420,
    speed: 74,
    damage: 22,
    xpValue: 220,
    radius: 24,
    scale: 1.9,
    tint: 0xb36dff,
    shockwaveIntervalMs: 3200,
    shockwaveRadius: 155,
    rushIntervalMs: 5800,
    rushDurationMs: 250,
    rushSpeedMultiplier: 2.35
  }
};

export class BossEnemy extends Enemy {
  constructor(scene, x, y, options = {}) {
    const variant = options.variant === "mini" ? "mini" : "boss";
    const config = BOSS_VARIANTS[variant];

    super(scene, x, y, {
      type: "boss",
      hp: config.hp,
      speed: config.speed,
      damage: config.damage,
      xpValue: config.xpValue,
      radius: config.radius,
      scale: config.scale,
      tint: config.tint
    });

    this.variant = variant;
    this.shockwaveIntervalMs = config.shockwaveIntervalMs;
    this.shockwaveRadius = config.shockwaveRadius;
    this.rushIntervalMs = config.rushIntervalMs;
    this.rushDurationMs = config.rushDurationMs;
    this.rushSpeedMultiplier = config.rushSpeedMultiplier;
    this.nextShockwaveAtMs = 0;
    this.nextRushAtMs = 0;
    this.rushUntilMs = 0;
    this.rushDirX = 0;
    this.rushDirY = 0;

    this.setData("isBoss", true);
    this.setData("bossVariant", this.variant);
  }

  updateBossPattern(target, nowMs) {
    if (!this.active || !target || !target.active) {
      return;
    }

    if (nowMs >= this.nextShockwaveAtMs) {
      this.nextShockwaveAtMs = nowMs + this.shockwaveIntervalMs;
      const shockwaveRadius = this.shockwaveRadius;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (distance <= shockwaveRadius) {
        const shockwaveDamage = Math.max(10, Math.round(this.damage * 0.55));
        target.takeDamage(shockwaveDamage, nowMs);
      }
    }

    if (nowMs >= this.nextRushAtMs) {
      this.nextRushAtMs = nowMs + this.rushIntervalMs;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.0001) {
        this.rushDirX = dx / distance;
        this.rushDirY = dy / distance;
        this.rushUntilMs = nowMs + this.rushDurationMs;
      }
    }

    if (nowMs < this.rushUntilMs) {
      const rushSpeed = this.speed * this.rushSpeedMultiplier;
      this.body.setVelocity(this.rushDirX * rushSpeed, this.rushDirY * rushSpeed);
    }
  }
}
