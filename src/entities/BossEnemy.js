import { Enemy } from "./Enemy.js";

export class BossEnemy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, {
      type: "boss",
      hp: 1800,
      speed: 52,
      damage: 44,
      xpValue: 600,
      radius: 34,
      scale: 2.6,
      tint: 0x6d34ff
    });

    this.nextShockwaveAtMs = 0;
    this.nextRushAtMs = 0;
    this.rushUntilMs = 0;
    this.rushDirX = 0;
    this.rushDirY = 0;

    this.setData("isBoss", true);
  }

  updateBossPattern(target, nowMs) {
    if (!this.active || !target || !target.active) {
      return;
    }

    if (nowMs >= this.nextShockwaveAtMs) {
      this.nextShockwaveAtMs = nowMs + 2500;
      const shockwaveRadius = 190;
      const distance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
      if (distance <= shockwaveRadius) {
        const shockwaveDamage = Math.max(10, Math.round(this.damage * 0.55));
        target.takeDamage(shockwaveDamage, nowMs);
      }
    }

    if (nowMs >= this.nextRushAtMs) {
      this.nextRushAtMs = nowMs + 5000;
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0.0001) {
        this.rushDirX = dx / distance;
        this.rushDirY = dy / distance;
        this.rushUntilMs = nowMs + 320;
      }
    }

    if (nowMs < this.rushUntilMs) {
      const rushSpeed = this.speed * 2.65;
      this.body.setVelocity(this.rushDirX * rushSpeed, this.rushDirY * rushSpeed);
    }
  }
}
