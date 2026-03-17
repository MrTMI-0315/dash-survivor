import { ENEMY_ARCHETYPE_CONFIGS, ELITE_TYPE_CONFIGS, ENEMY_VISUAL_SCALE } from "../config/enemies.js";

const ENCIRCLE_ANGLE_MIN_DEG = -30;
const ENCIRCLE_ANGLE_MAX_DEG = 30;
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
const ENEMY_TYPE_TO_FOLDER = Object.freeze({
  chaser: "enemy_chaser",
  swarm: "enemy_swarm",
  tank: "enemy_tank",
  hunter: "enemy_hunter"
});
const HIT_FLASH_DURATION_MS = 100;
const HIT_FLASH_TINT = 0xffaaaa;
const HIT_VISUAL_PUSH_PX = 4;
const HIT_SPARK_PARTICLE_COUNT = 4;
const HIT_KNOCKBACK_STRENGTH = 40;
const ENEMY_RENDER_DEPTH = 10;

function getArchetypeConfig(type) {
  return ENEMY_ARCHETYPE_CONFIGS[type] ?? ENEMY_ARCHETYPE_CONFIGS.chaser;
}

function getDirectionNameFromVector(x, y, fallback = "south") {
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001) {
    return fallback;
  }
  const octant = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  const index = ((octant % 8) + 8) % 8;
  return DIRECTION_INDEX_TO_NAME[index] ?? fallback;
}

function getDirectionalEnemyTextureKey(type, scene, direction = "south") {
  const folder = ENEMY_TYPE_TO_FOLDER[type];
  if (!folder) {
    return null;
  }
  const key = `char_${folder}_${direction.replace(/-/g, "_")}`;
  if (scene?.textures?.exists(key)) {
    return key;
  }
  return null;
}

function getEnemyTextureKey(type, scene, direction = "south") {
  const directionalKey = getDirectionalEnemyTextureKey(type, scene, direction);
  if (directionalKey) {
    return directionalKey;
  }
  if (type === "swarm") {
    return "enemy_swarm";
  }
  if (type === "tank") {
    return "enemy_tank";
  }
  if (type === "hunter") {
    return "enemy_hunter";
  }
  if (type === "boss") {
    return "enemy_boss";
  }
  if (scene?.textures?.exists("sprite_enemy_chaser_free")) {
    return "sprite_enemy_chaser_free";
  }
  return "enemy_chaser";
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, config = {}) {
    super(scene, x, y, getEnemyTextureKey(config.type ?? "chaser", scene));

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.resetForSpawn(config);
  }

  resetForSpawn(config = {}) {
    this.type = config.type ?? "chaser";
    const archetype = getArchetypeConfig(this.type);

    this.speed = config.speed ?? archetype.speed;
    this.baseSpeed = this.speed;
    this.damage = config.damage ?? archetype.damage;
    this.baseDamage = this.damage;
    this.hp = config.hp ?? archetype.hp;
    this.maxHp = this.hp;
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
    this.flashToken = (this.flashToken ?? 0) + 1;
    this.facingDirection = "south";
    this.encircleAngleOffsetRad = Phaser.Math.DegToRad(
      Phaser.Math.Between(ENCIRCLE_ANGLE_MIN_DEG, ENCIRCLE_ANGLE_MAX_DEG)
    );

    this.baseTint = config.tint ?? archetype.tint;
    this.setTexture(getEnemyTextureKey(this.type, this.scene, this.facingDirection));
    this.setScale(config.scale ?? archetype.scale);
    this.setDepth(ENEMY_RENDER_DEPTH);
    this.setCircle(config.radius ?? archetype.radius, 0, 0);
    const spawnX = config.x ?? this.x;
    const spawnY = config.y ?? this.y;
    this.setTint(this.baseTint);
    this.setData("inPool", false);

    if (this.body) {
      this.enableBody(true, spawnX, spawnY, true, true);
      this.body.setVelocity(0, 0);
    } else {
      this.setPosition(spawnX, spawnY);
      this.setActive(true);
      this.setVisible(true);
    }
  }

  resetForPool() {
    this.flashToken += 1;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.dashVx = 0;
    this.dashVy = 0;
    this.abilityNextAtMs = 0;
    this.abilityUntilMs = 0;
    this.nextPoisonTickAtMs = 0;
    this.setData("inPool", true);
    this.disableBody(true, true);
  }

  chase(target, deltaMs = 0, nowMs = 0) {
    if (!this.active || !target.active || this.isDead() || !this.body) {
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      this.body.setVelocity(this.knockbackVx, this.knockbackVy);
      this.updateFacingFromVelocity(this.knockbackVx, this.knockbackVy);
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
        const velocityX = this.dashVx + this.knockbackVx;
        const velocityY = this.dashVy + this.knockbackVy;
        this.body.setVelocity(velocityX, velocityY);
        this.updateFacingFromVelocity(velocityX, velocityY);
        return;
      }
    }

    const playerAngle = Math.atan2(dy, dx);
    const encircleInfluence = Phaser.Math.Clamp(distance / 260, 0.35, 1);
    const approachAngle = playerAngle + this.encircleAngleOffsetRad * encircleInfluence;
    const chaseVx = Math.cos(approachAngle) * this.speed * speedMultiplier;
    const chaseVy = Math.sin(approachAngle) * this.speed * speedMultiplier;
    const velocityX = chaseVx + this.knockbackVx;
    const velocityY = chaseVy + this.knockbackVy;
    this.body.setVelocity(velocityX, velocityY);
    this.updateFacingFromVelocity(velocityX, velocityY);
  }

  updateFacingFromVelocity(vx, vy) {
    if (this.type === "boss") {
      return;
    }
    const nextDirection = getDirectionNameFromVector(vx, vy, this.facingDirection);
    this.facingDirection = nextDirection;
    const textureKey = getEnemyTextureKey(this.type, this.scene, nextDirection);
    if (textureKey && this.texture?.key !== textureKey) {
      this.setTexture(textureKey);
    }
  }

  takeDamage(amount) {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const hpBefore = this.hp;
    const appliedDamage = Math.max(0, Math.min(hpBefore, safeAmount));
    this.hp = Math.max(0, this.hp - safeAmount);
    if (appliedDamage > 0 && this.scene?.recordPlayerDamage) {
      this.scene.recordPlayerDamage(appliedDamage);
    }
    if (this.hp <= 0) {
      this.die();
    }

    this.flashToken += 1;
    const flashToken = this.flashToken;

    this.setTint(HIT_FLASH_TINT);
    if (this.scene.playSfx) {
      this.scene.playSfx("enemy_hit", { elite: this.isElite });
    }
    if (this.scene.spawnHitSparkParticles) {
      this.scene.spawnHitSparkParticles(this.x, this.y, HIT_SPARK_PARTICLE_COUNT);
    } else if (this.scene.spawnDamageParticles) {
      this.scene.spawnDamageParticles(this.x, this.y, HIT_SPARK_PARTICLE_COUNT);
    }
    if (this.scene.spawnDamageText) {
      this.scene.spawnDamageText(this.x, this.y - (this.isElite ? 4 : 0), appliedDamage, this);
    } else if (this.scene.spawnDamageNumber) {
      this.scene.spawnDamageNumber(this.x, this.y - (this.isElite ? 4 : 0), appliedDamage, this);
    }
    const player = this.scene?.player;
    const duringDash = Boolean(player?.isDashing?.());
    if (!duringDash && player?.active && this.body) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      const distance = Math.hypot(dx, dy);
      const nx = distance > 0.0001 ? dx / distance : 1;
      const ny = distance > 0.0001 ? dy / distance : 0;
      this.body.setVelocity(
        this.body.velocity.x + nx * HIT_KNOCKBACK_STRENGTH,
        this.body.velocity.y + ny * HIT_KNOCKBACK_STRENGTH
      );
      this.setPosition(this.x + nx * HIT_VISUAL_PUSH_PX, this.y + ny * HIT_VISUAL_PUSH_PX);
    }
    if (this.scene?.time?.delayedCall) {
      this.scene.time.delayedCall(HIT_FLASH_DURATION_MS, () => {
        if (this.active && this.flashToken === flashToken) {
          this.clearTint();
        }
      });
    }
  }

  die() {
    this.hp = 0;
  }

  reset(x, y, config = {}) {
    if (typeof x === "object" && x !== null) {
      this.resetForSpawn(x);
      return;
    }

    this.resetForSpawn({
      ...(config ?? {}),
      x: x ?? this.x,
      y: y ?? this.y
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
    this.maxHp = this.hp;
    this.damage = Math.round(this.damage * 1.35);
    this.baseDamage = this.damage;
    this.speed *= 1.1;
    this.baseSpeed = this.speed;
    this.xpValue = Math.round(this.xpValue * 2.2);

    this.setScale(this.scaleX * ENEMY_VISUAL_SCALE.eliteMultiplier, this.scaleY * ENEMY_VISUAL_SCALE.eliteMultiplier);
    this.baseTint = eliteConfig.tint;
    this.setTint(this.baseTint);
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
