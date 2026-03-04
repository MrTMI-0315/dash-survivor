export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, "enemy");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.speed = config.speed ?? 80;
    this.baseSpeed = this.speed;
    this.damage = config.damage ?? 10;
    this.hp = config.hp ?? 20;
    this.xpValue = config.xpValue ?? 10;
    this.knockbackRemainingMs = 0;

    this.setCircle(14, 0, 0);
    this.setCollideWorldBounds(true);
  }

  chase(target, deltaMs = 0) {
    if (!this.active || !target.active) {
      return;
    }

    if (this.knockbackRemainingMs > 0) {
      this.knockbackRemainingMs = Math.max(0, this.knockbackRemainingMs - deltaMs);
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      this.body.setVelocity(0, 0);
      return;
    }

    this.body.setVelocity((dx / distance) * this.speed, (dy / distance) * this.speed);
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

  applyKnockbackFrom(sourceX, sourceY, force, durationMs) {
    const dx = this.x - sourceX;
    const dy = this.y - sourceY;
    const distance = Math.hypot(dx, dy);
    const nx = distance > 0.0001 ? dx / distance : 1;
    const ny = distance > 0.0001 ? dy / distance : 0;

    this.body.setVelocity(nx * force, ny * force);
    this.knockbackRemainingMs = Math.max(this.knockbackRemainingMs, durationMs);
  }

  isDead() {
    return this.hp <= 0;
  }
}
