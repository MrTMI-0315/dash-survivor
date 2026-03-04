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

    this.setCircle(16, 0, 0);
    this.setCollideWorldBounds(true);
  }

  moveFromInput(keys) {
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
    this.body.setVelocity(direction.x * this.speed, direction.y * this.speed);
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
