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
    this.knockbackVx = 0;
    this.knockbackVy = 0;

    this.setCircle(14, 0, 0);
    this.setCollideWorldBounds(true);
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
