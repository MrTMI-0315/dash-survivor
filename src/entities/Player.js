const DIRECTION_INDEX_TO_NAME = Object.freeze([
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east"
]);

function getDirectionNameFromVector(x, y, fallback = "south") {
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) {
    return fallback;
  }
  const octant = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  const index = ((octant % 8) + 8) % 8;
  return DIRECTION_INDEX_TO_NAME[index] ?? fallback;
}

function getPlayerDirectionalTextureKey(scene, direction = "south") {
  const key = `char_player_pirate_${direction.replace(/-/g, "_")}`;
  if (scene?.textures?.exists(key)) {
    return key;
  }
  return null;
}

function getPlayerTextureKey(scene, direction = "south") {
  const directionalKey = getPlayerDirectionalTextureKey(scene, direction);
  if (directionalKey) {
    return directionalKey;
  }
  if (scene?.textures?.exists("sprite_player_crew")) {
    return "sprite_player_crew";
  }
  return "player_triangle";
}
const PLAYER_RENDER_DEPTH = 20;
const PLAYER_PIRATE_SCALE = 1.58;
const PLAYER_CREW_SCALE = 2.0;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, getPlayerTextureKey(scene, "south"));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = 100;
    this.hp = this.maxHp;
    this.speed = 200;
    this.damageCooldownMs = 400;
    this.nextDamageAt = 0;
    this.lastMoveDir = new Phaser.Math.Vector2(1, 0);
    this.facingDirection = "south";

    this.dashGaugeMax = 100;
    this.dashGauge = 0;
    this.dashCooldownMs = 4000;
    this.dashChargeRate = this.dashGaugeMax / (this.dashCooldownMs / 1000);
    this.dashDurationMs = 250;
    this.dashRemainingMs = 0;
    this.dashInvulnerabilityMs = 200;
    this.dashInvulnerabilityRemainingMs = 0;
    this.dashSpeedMultiplier = 4;
    this.dashDamage = 20;
    this.currentDashId = 0;
    this.maxWeaponSlots = 3;
    this.weapons = [];
    this.passives = {};
    this.pickupRadius = 140;

    this.setCircle(16, 0, 0);
    this.setCollideWorldBounds(true);
    this.setDepth(PLAYER_RENDER_DEPTH);
    if (this.texture?.key?.startsWith("char_player_pirate_")) {
      this.setScale(PLAYER_PIRATE_SCALE);
    } else if (this.texture?.key === "sprite_player_crew") {
      this.setScale(PLAYER_CREW_SCALE);
    }
  }

  updateFacingFromVector(x, y) {
    const nextDirection = getDirectionNameFromVector(x, y, this.facingDirection);
    this.facingDirection = nextDirection;
    const textureKey = getPlayerTextureKey(this.scene, nextDirection);
    if (textureKey && this.texture?.key !== textureKey) {
      this.setTexture(textureKey);
    }
  }

  moveFromInput(keys, analogInput = null) {
    if (!this.body) {
      return;
    }

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

    if (analogInput) {
      moveX += analogInput.x ?? 0;
      moveY += analogInput.y ?? 0;
    }

    const direction = new Phaser.Math.Vector2(moveX, moveY);
    if (direction.lengthSq() === 0) {
      this.body.setVelocity(0, 0);
      return;
    }

    const magnitude = Math.min(1, direction.length());
    direction.normalize();
    this.lastMoveDir.copy(direction);
    this.updateFacingFromVector(direction.x, direction.y);
    this.body.setVelocity(direction.x * this.speed * magnitude, direction.y * this.speed * magnitude);
  }

  updateDash(delta) {
    if (this.isDashing()) {
      this.dashRemainingMs = Math.max(0, this.dashRemainingMs - delta);
      this.dashInvulnerabilityRemainingMs = Math.max(0, this.dashInvulnerabilityRemainingMs - delta);
      if (!this.isDashing()) {
        this.dashInvulnerabilityRemainingMs = 0;
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
    if (!this.body) {
      return false;
    }

    if (!this.canDash()) {
      return false;
    }

    this.dashGauge = 0;
    this.dashRemainingMs = this.dashDurationMs;
    this.dashInvulnerabilityRemainingMs = this.dashInvulnerabilityMs;
    this.currentDashId += 1;

    const dir = this.lastMoveDir.clone();
    if (dir.lengthSq() === 0) {
      dir.set(1, 0);
    } else {
      dir.normalize();
    }

    const dashSpeed = this.speed * this.dashSpeedMultiplier;
    this.updateFacingFromVector(dir.x, dir.y);
    this.body.setVelocity(dir.x * dashSpeed, dir.y * dashSpeed);
    this.setTint(0xfff2a6);
    if (this.scene.playSfx) {
      this.scene.playSfx("dash");
    }
    return true;
  }

  isDashing() {
    return this.dashRemainingMs > 0;
  }

  isDashInvulnerable() {
    return this.dashInvulnerabilityRemainingMs > 0;
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

  addPassive(passiveKey) {
    if (this.passives[passiveKey]) {
      return false;
    }
    this.passives[passiveKey] = true;
    return true;
  }

  hasPassive(passiveKey) {
    return Boolean(this.passives[passiveKey]);
  }
}
