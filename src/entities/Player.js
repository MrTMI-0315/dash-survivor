export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.speed = 200;
    this.damageCooldownMs = 400;
    this.nextDamageAt = 0;
    this.lastMoveDir = new Phaser.Math.Vector2(1, 0);

    this.dashGaugeMax = 100;
    this.dashGauge = 0;
    this.dashChargeRate = 20;
    this.dashDurationMs = 250;
    this.dashRemainingMs = 0;
    this.dashSpeedMultiplier = 4;
    this.dashDamage = 20;
    this.currentDashId = 0;

    this.setCircle(16, 0, 0);
    this.setCollideWorldBounds(true);
  }

  moveFromInput(keys) {
    if (this.isDashing()) {
      return;
    }

    let moveX = 0;
    let moveY = 0;

    if (keys.left.isDown) {
      moveX -= 1;
    }
    if (keys.right.isDown) {
      moveX += 1;
    }
    if (keys.up.isDown) {
      moveY -= 1;
    }
    if (keys.down.isDown) {
      moveY += 1;
    }

    const direction = new Phaser.Math.Vector2(moveX, moveY);
    if (direction.lengthSq() === 0) {
      this.body.setVelocity(0, 0);
      return;
    }

    direction.normalize();
    this.lastMoveDir.copy(direction);
    this.body.setVelocity(direction.x * this.speed, direction.y * this.speed);
  }

  updateDash(delta) {
    if (this.isDashing()) {
      this.dashRemainingMs = Math.max(0, this.dashRemainingMs - delta);
      if (!this.isDashing()) {
        this.clearTint();
      }
      return;
    }

    this.dashGauge = Math.min(this.dashGaugeMax, this.dashGauge + (this.dashChargeRate * delta) / 1000);
  }

  canDash() {
    return !this.isDashing() && this.dashGauge >= this.dashGaugeMax;
  }

  tryDash() {
    if (!this.canDash()) {
      return false;
    }

    this.dashGauge = 0;
    this.dashRemainingMs = this.dashDurationMs;
    this.currentDashId += 1;

    const dir = this.lastMoveDir.clone();
    if (dir.lengthSq() === 0) {
      dir.set(1, 0);
    } else {
      dir.normalize();
    }

    const dashSpeed = this.speed * this.dashSpeedMultiplier;
    this.body.setVelocity(dir.x * dashSpeed, dir.y * dashSpeed);
    this.setTint(0xfff2a6);
    return true;
  }

  isDashing() {
    return this.dashRemainingMs > 0;
  }

  getDashRatio() {
    return this.dashGauge / this.dashGaugeMax;
  }

  takeDamage(amount, now) {
    if (now < this.nextDamageAt || this.hp <= 0) {
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.nextDamageAt = now + this.damageCooldownMs;

    this.setTint(0xff9e9e);
    this.scene.time.delayedCall(100, () => {
      if (this.active) {
        this.clearTint();
      }
    });

    return true;
  }

  getHpRatio() {
    return this.hp / this.maxHp;
  }

  isDead() {
    return this.hp <= 0;
  }
}
