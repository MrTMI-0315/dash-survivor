import { Enemy } from "./Enemy.js";

const BOSS_VARIANTS = {
  boss: {
    hp: 1800,
    speed: 52,
    damage: 44,
    xpValue: 600,
    radius: 34,
    scale: 3.05,
    tint: 0x6d34ff,
    shockwaveIntervalMs: 2500,
    shockwaveRadius: 190,
    rushIntervalMs: 5000,
    rushDurationMs: 320,
    rushSpeedMultiplier: 2.65,
    radialBurstIntervalMs: 6000,
    radialBurstWarningLeadMs: 1000,
    radialBurstBulletCount: 12,
    radialBurstBulletSpeed: 220
  },
  mini: {
    hp: 112,
    speed: 88,
    damage: 22,
    xpValue: 220,
    radius: 24,
    scale: 2.28,
    tint: 0xffffff,
    shockwaveIntervalMs: 3200,
    shockwaveRadius: 155,
    rushIntervalMs: 5800,
    rushDurationMs: 250,
    rushSpeedMultiplier: 2.35,
    radialBurstIntervalMs: 6000,
    radialBurstWarningLeadMs: 1000,
    radialBurstBulletCount: 12,
    radialBurstBulletSpeed: 205
  }
};
const MINI_BOSS_TEXTURE_KEY = "char_enemy_miniboss_davy_south";

function resolveDavyTextureKey(scene) {
  const candidates = [
    "char_enemy_miniboss_davy_south",
    "char_enemy_miniboss_davy_south_west",
    "char_enemy_miniboss_davy_south_east",
    "char_enemy_miniboss_davy_west",
    "char_enemy_miniboss_davy_east",
    "char_enemy_miniboss_davy_north_west",
    "char_enemy_miniboss_davy_north_east",
    "char_enemy_miniboss_davy_north"
  ];
  return candidates.find((key) => scene?.textures?.exists(key)) ?? null;
}

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
    this.radialBurstIntervalMs = config.radialBurstIntervalMs;
    this.radialBurstWarningLeadMs = config.radialBurstWarningLeadMs;
    this.radialBurstBulletCount = config.radialBurstBulletCount;
    this.radialBurstBulletSpeed = config.radialBurstBulletSpeed;
    this.nextRadialBurstAtMs = 0;
    this.radialBurstWarningShownAtMs = -1;

    this.setData("isBoss", true);
    this.setData("bossVariant", this.variant);

    const davyTextureKey = resolveDavyTextureKey(scene);
    if (davyTextureKey) {
      this.setTexture(davyTextureKey);
      this.setData("bossTextureKey", davyTextureKey);
    } else if (this.variant === "mini" && scene?.textures?.exists(MINI_BOSS_TEXTURE_KEY)) {
      // TODO: remove this branch once all build variants guarantee davy texture preload.
      this.setTexture(MINI_BOSS_TEXTURE_KEY);
      this.setData("bossTextureKey", MINI_BOSS_TEXTURE_KEY);
    }
  }

  updateBossPattern(target, nowMs) {
    if (!this.active || !target || !target.active) {
      return;
    }

    const fixedTextureKey = this.getData("bossTextureKey");
    if (fixedTextureKey && this.texture?.key !== fixedTextureKey && this.scene?.textures?.exists(fixedTextureKey)) {
      this.setTexture(fixedTextureKey);
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

    if (this.nextRadialBurstAtMs <= 0) {
      this.nextRadialBurstAtMs = nowMs + this.radialBurstIntervalMs;
    }

    const warningAtMs = this.nextRadialBurstAtMs - this.radialBurstWarningLeadMs;
    if (nowMs >= warningAtMs && this.radialBurstWarningShownAtMs !== this.nextRadialBurstAtMs) {
      this.radialBurstWarningShownAtMs = this.nextRadialBurstAtMs;
      if (this.scene?.showBossRadialWarning) {
        this.scene.showBossRadialWarning(this, this.radialBurstWarningLeadMs);
      }
    }

    if (nowMs >= this.nextRadialBurstAtMs) {
      this.nextRadialBurstAtMs = nowMs + this.radialBurstIntervalMs;
      this.radialBurstWarningShownAtMs = -1;
      if (this.scene?.spawnBossRadialBurst) {
        this.scene.spawnBossRadialBurst(this, this.radialBurstBulletCount, this.radialBurstBulletSpeed);
      }
    }
  }
}
