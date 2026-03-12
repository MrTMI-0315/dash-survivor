import {
  PROJECTILE_POOL_SIZE_BY_TEXTURE,
  PROJECTILE_TEXTURE_BY_WEAPON,
  WEAPON_DEFINITIONS,
  WEAPON_EVOLUTION_RULES
} from "../config/weapons.js";
import { Enemy } from "../entities/Enemy.js";

const PROJECTILE_VISUAL_SCALE = 1.4;
const PROJECTILE_GLOW_ALPHA = 0.6;
const PROJECTILE_TRAIL_LIFETIME_MS = 200;
const PROJECTILE_TINT_BY_WEAPON = Object.freeze({
  dagger: 0xa8e7ff,
  fireball: 0xffb36a,
  meteor: 0xff8757,
  lightning: 0xc6f1ff
});
const PROJECTILE_VISUAL_PROFILE_BY_WEAPON = Object.freeze({
  dagger: Object.freeze({
    scaleX: 1.65,
    scaleY: 0.7,
    glowAlpha: 0.42,
    trailBurst: 1
  }),
  fireball: Object.freeze({
    scaleX: 1.85,
    scaleY: 1.85,
    glowAlpha: 0.75,
    trailBurst: 2
  }),
  meteor: Object.freeze({
    scaleX: 2.1,
    scaleY: 2.1,
    glowAlpha: 0.82,
    trailBurst: 2
  }),
  default: Object.freeze({
    scaleX: PROJECTILE_VISUAL_SCALE,
    scaleY: PROJECTILE_VISUAL_SCALE,
    glowAlpha: PROJECTILE_GLOW_ALPHA,
    trailBurst: 1
  })
});

function getWeaponDefinition(type) {
  return WEAPON_DEFINITIONS[type] ?? null;
}

export class WeaponSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.projectilePoolByTexture = new Map();
    this.globalDamageMultiplier = 1;
    this.globalCooldownMultiplier = 1;
    this.projectileCount = 1;
    this.projectileGlowGraphics = scene.add.graphics().setDepth(7.9);
    this.projectileTrailParticles = null;
    this.projectileTrailEmitter = null;
    this.projectileTrailAccumulatorMs = 0;

    this.projectiles = scene.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    this.orbitBlades = scene.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    this.preallocateProjectilePool();
    this.createProjectileTrailEmitter();

    scene.physics.add.overlap(this.projectiles, scene.enemies, this.handleProjectileHit, this.isValidProjectileEnemyCollision, this);
    scene.physics.add.overlap(this.orbitBlades, scene.enemies, this.handleOrbitBladeHit, null, this);
  }

  createProjectileTrailEmitter() {
    const textureKey = this.scene.textures?.exists("hit_particle")
      ? "hit_particle"
      : this.scene.textures?.exists("__WHITE")
      ? "__WHITE"
      : null;
    if (!textureKey) {
      return;
    }

    this.projectileTrailParticles = this.scene.add.particles(textureKey);
    this.projectileTrailParticles.setDepth(7.8);
    this.projectileTrailEmitter = this.projectileTrailParticles.createEmitter({
      on: false,
      lifespan: PROJECTILE_TRAIL_LIFETIME_MS,
      speed: { min: 6, max: 28 },
      scale: { start: 0.22, end: 0 },
      alpha: { start: 0.45, end: 0 },
      blendMode: "ADD"
    });
  }

  getProjectileVisualColor(type) {
    return PROJECTILE_TINT_BY_WEAPON[type] ?? 0xffffff;
  }

  getProjectileVisualProfile(type) {
    return PROJECTILE_VISUAL_PROFILE_BY_WEAPON[type] ?? PROJECTILE_VISUAL_PROFILE_BY_WEAPON.default;
  }

  normalizeProjectileEnemyPair(a, b) {
    let projectile = a;
    let enemy = b;

    if (a instanceof Enemy && !(b instanceof Enemy)) {
      enemy = a;
      projectile = b;
    }

    return { projectile, enemy };
  }

  warnInvalidProjectileCollision(_object) {
    // Intentionally no-op in release build.
  }

  isValidProjectileEnemyCollision(a, b) {
    const { projectile, enemy } = this.normalizeProjectileEnemyPair(a, b);
    const hasProjectileSignature = Boolean(projectile && typeof projectile.getData === "function" && projectile.getData("poolTexture"));
    const valid =
      enemy instanceof Enemy &&
      hasProjectileSignature &&
      !enemy.getData("isDying") &&
      !enemy.isDead?.();
    if (!valid) {
      this.warnInvalidProjectileCollision(enemy);
    }
    return valid;
  }

  preallocateProjectilePool() {
    Object.entries(PROJECTILE_POOL_SIZE_BY_TEXTURE).forEach(([texture, size]) => {
      const freeList = [];
      for (let i = 0; i < size; i += 1) {
        const projectile = this.projectiles.create(-1000, -1000, texture);
        projectile.setData("poolTexture", texture);
        projectile.setData("inProjectilePool", true);
        projectile.setDepth(8);
        projectile.setAlpha(0.98);
        projectile.speed = 0;
        projectile.maxDistance = 0;
        projectile.travelled = 0;
        projectile.damage = 0;
        projectile.knockbackForce = 0;
        projectile.behavior = "fast";
        projectile.explosionRadius = 0;
        projectile.explosionDamage = 0;
        projectile.body.setCircle(projectile.displayWidth * 0.45, 0, 0);
        projectile.setScale(PROJECTILE_VISUAL_SCALE, PROJECTILE_VISUAL_SCALE);
        projectile.disableBody(true, true);
        freeList.push(projectile);
      }
      this.projectilePoolByTexture.set(texture, freeList);
    });
  }

  acquireProjectile(texture) {
    const freeList = this.projectilePoolByTexture.get(texture);
    if (!freeList || freeList.length === 0) {
      return null;
    }

    const projectile = freeList.pop();
    projectile.setData("inProjectilePool", false);
    return projectile;
  }

  releaseProjectile(projectile) {
    if (!projectile) {
      return;
    }

    if (projectile.getData("inProjectilePool") === true) {
      return;
    }

    const texture = projectile.getData("poolTexture") ?? projectile.texture.key;
    const freeList = this.projectilePoolByTexture.get(texture);
    if (!freeList) {
      projectile.destroy();
      return;
    }

    projectile.speed = 0;
    projectile.maxDistance = 0;
    projectile.travelled = 0;
    projectile.damage = 0;
    projectile.knockbackForce = 0;
    projectile.behavior = "fast";
    projectile.explosionRadius = 0;
    projectile.explosionDamage = 0;
    projectile.setTint(0xffffff);
    projectile.setScale(PROJECTILE_VISUAL_SCALE, PROJECTILE_VISUAL_SCALE);
    projectile.setRotation(0);
    projectile.setData("visualColor", 0xffffff);
    projectile.setData("glowAlpha", PROJECTILE_GLOW_ALPHA);
    projectile.setData("trailBurst", 1);
    projectile.setData("inProjectilePool", true);
    projectile.disableBody(true, true);
    freeList.push(projectile);
  }

  addGlobalDamagePercent(percent) {
    const safePercent = Number(percent) || 0;
    if (safePercent <= 0) {
      return this.globalDamageMultiplier;
    }

    this.globalDamageMultiplier *= 1 + safePercent;
    return this.globalDamageMultiplier;
  }

  addAttackSpeedPercent(percent) {
    const safePercent = Number(percent) || 0;
    if (safePercent <= 0) {
      return this.globalCooldownMultiplier;
    }

    this.globalCooldownMultiplier = Math.max(0.35, this.globalCooldownMultiplier * (1 - safePercent));
    return this.globalCooldownMultiplier;
  }

  addProjectileCount(amount = 1) {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) {
      return this.projectileCount;
    }

    this.projectileCount = Math.min(8, this.projectileCount + safeAmount);
    return this.projectileCount;
  }

  getScaledWeaponDamage(weapon) {
    return Math.max(1, Math.round(weapon.damage * this.globalDamageMultiplier));
  }

  getEffectiveCooldownMs(weapon) {
    return Math.max(90, Math.round(weapon.cooldownMs * this.globalCooldownMultiplier));
  }

  addWeapon(baseType) {
    const definition = getWeaponDefinition(baseType);
    if (!definition) {
      return false;
    }

    const existing = this.findWeaponByBaseType(baseType);
    if (existing) {
      this.levelUpWeapon(existing);
      this.checkEvolution(existing);
      return false;
    }

    if (this.player.weapons.length >= this.player.maxWeaponSlots) {
      const fallback = this.player.weapons[0];
      if (fallback) {
        this.levelUpWeapon(fallback);
        this.checkEvolution(fallback);
      }
      return false;
    }

    const weapon = this.createWeaponState(baseType, baseType);
    this.player.weapons.push(weapon);
    this.checkEvolution(weapon);
    return true;
  }

  onPassiveAcquired() {
    this.player.weapons.forEach((weapon) => {
      this.checkEvolution(weapon);
    });
  }

  createWeaponState(type, baseType) {
    const definition = getWeaponDefinition(type);
    return {
      type,
      baseType,
      level: 1,
      evolved: Boolean(definition.evolved),
      damage: definition.damage,
      cooldownMs: definition.cooldownMs,
      range: definition.range,
      knockbackForce: definition.knockbackForce,
      projectileBehavior: definition.projectileBehavior,
      projectileSpeed: definition.projectileSpeed,
      explosionRadius: definition.explosionRadius ?? 0,
      explosionDamageMultiplier: definition.explosionDamageMultiplier ?? 0,
      orbitBladeCount: definition.orbitBladeCount ?? 0,
      orbitRadius: definition.orbitRadius ?? 0,
      orbitSpeed: definition.orbitSpeed ?? 0,
      orbitAngle: 0,
      orbitSprites: [],
      nextFireAt: 0
    };
  }

  levelUpWeapon(weapon) {
    weapon.level += 1;

    if (weapon.type === "orbit_blades") {
      weapon.damage = Math.round(weapon.damage * 1.15);
      weapon.cooldownMs = Math.max(120, Math.floor(weapon.cooldownMs * 0.94));
      weapon.orbitBladeCount = Math.min(5, 3 + Math.floor((weapon.level - 5) / 2));
      return;
    }

    weapon.damage = Math.round(weapon.damage * 1.16);
    weapon.cooldownMs = Math.max(170, Math.floor(weapon.cooldownMs * 0.92));
    weapon.range = Math.round(weapon.range * 1.03);

    if (weapon.type === "fireball" || weapon.type === "meteor") {
      weapon.explosionRadius = Math.round(Math.max(weapon.explosionRadius, 40) * 1.05);
    }
  }

  checkEvolution(weapon) {
    if (weapon.evolved) {
      return false;
    }

    const rule = WEAPON_EVOLUTION_RULES.find((entry) => entry.weapon === weapon.baseType);
    if (!rule) {
      return false;
    }

    if (weapon.level < rule.level) {
      return false;
    }

    if (!this.player.hasPassive(rule.requiredPassive)) {
      return false;
    }

    this.applyEvolution(weapon, rule.evolution);
    return true;
  }

  applyEvolution(weapon, evolutionType) {
    const evolved = getWeaponDefinition(evolutionType);
    if (!evolved) {
      return;
    }

    weapon.type = evolutionType;
    weapon.evolved = true;
    weapon.projectileBehavior = evolved.projectileBehavior;
    weapon.damage = Math.max(Math.round(weapon.damage * 1.7), evolved.damage);
    weapon.cooldownMs = evolved.cooldownMs;
    weapon.range = Math.max(weapon.range, evolved.range);
    weapon.knockbackForce = evolved.knockbackForce;
    weapon.projectileSpeed = evolved.projectileSpeed;
    weapon.explosionRadius = evolved.explosionRadius ?? 0;
    weapon.explosionDamageMultiplier = evolved.explosionDamageMultiplier ?? 0;
    weapon.orbitBladeCount = evolved.orbitBladeCount ?? 0;
    weapon.orbitRadius = evolved.orbitRadius ?? 0;
    weapon.orbitSpeed = evolved.orbitSpeed ?? 0;
    weapon.nextFireAt = 0;

    if (weapon.type === "orbit_blades") {
      this.rebuildOrbitBlades(weapon);
    }

    if (this.scene.showHudAlert) {
      this.scene.showHudAlert(`${weapon.baseType.toUpperCase()} EVOLVED`, 1800);
    }
    if (this.scene.playWeaponEvolutionFeedback) {
      this.scene.playWeaponEvolutionFeedback(weapon);
    }
  }

  update(time, delta) {
    this.updateProjectiles(delta);
    this.updateOrbitBlades(time, delta);

    this.player.weapons.forEach((weapon) => {
      if (weapon.type === "orbit_blades") {
        this.ensureOrbitBlades(weapon);
        return;
      }

      if (time < weapon.nextFireAt) {
        return;
      }

      const fired = this.fireWeapon(weapon);
      if (fired) {
        weapon.nextFireAt = time + this.getEffectiveCooldownMs(weapon);
      }
    });
  }

  updateProjectiles(delta) {
    this.projectileGlowGraphics?.clear();
    this.projectileTrailAccumulatorMs += delta;
    const shouldEmitTrail = this.projectileTrailAccumulatorMs >= 16;
    if (shouldEmitTrail) {
      this.projectileTrailAccumulatorMs = 0;
    }

    this.projectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) {
        return;
      }

      const glowColor = projectile.getData("visualColor") ?? 0xffffff;
      const glowAlpha = projectile.getData("glowAlpha") ?? PROJECTILE_GLOW_ALPHA;
      const glowRadius = Math.max(3, projectile.displayWidth * 0.42);
      this.projectileGlowGraphics?.lineStyle(2, glowColor, glowAlpha);
      this.projectileGlowGraphics?.strokeCircle(projectile.x, projectile.y, glowRadius);
      if (shouldEmitTrail && this.projectileTrailEmitter) {
        const trailBurst = Math.max(1, Math.min(3, Math.floor(projectile.getData("trailBurst") ?? 1)));
        this.projectileTrailEmitter.setTint(glowColor);
        this.projectileTrailEmitter.emitParticleAt(projectile.x, projectile.y, trailBurst);
      }

      projectile.travelled += (projectile.speed * delta) / 1000;
      if (projectile.travelled >= projectile.maxDistance) {
        this.releaseProjectile(projectile);
      }
    });
  }

  updateOrbitBlades(_time, delta) {
    this.player.weapons.forEach((weapon) => {
      if (weapon.type !== "orbit_blades") {
        return;
      }

      this.ensureOrbitBlades(weapon);

      weapon.orbitAngle += weapon.orbitSpeed * delta;
      const count = weapon.orbitSprites.length;
      for (let i = 0; i < count; i += 1) {
        const blade = weapon.orbitSprites[i];
        if (!blade.active) {
          continue;
        }

        const theta = weapon.orbitAngle + (Math.PI * 2 * i) / count;
        blade.x = this.player.x + Math.cos(theta) * weapon.orbitRadius;
        blade.y = this.player.y + Math.sin(theta) * weapon.orbitRadius;
        blade.setData("damage", this.getScaledWeaponDamage(weapon));
        blade.setData("knockbackForce", weapon.knockbackForce);
      }
    });
  }

  ensureOrbitBlades(weapon) {
    const targetCount = Math.max(1, weapon.orbitBladeCount || 3);
    if (weapon.orbitSprites.length !== targetCount || weapon.orbitSprites.some((blade) => !blade.active)) {
      this.rebuildOrbitBlades(weapon);
    }
  }

  rebuildOrbitBlades(weapon) {
    weapon.orbitSprites.forEach((blade) => blade.destroy());
    weapon.orbitSprites = [];

    const count = Math.max(1, weapon.orbitBladeCount || 3);
    for (let i = 0; i < count; i += 1) {
      const blade = this.orbitBlades.create(this.player.x, this.player.y, "proj_orbit_blade");
      blade.body.setCircle(blade.displayWidth * 0.48, 0, 0);
      blade.setDepth(8);
      blade.setAlpha(0.96);
      blade.setData("weaponBaseType", weapon.baseType);
      blade.setData("orbitHitKey", `orbit_hit_${weapon.baseType}`);
      blade.setData("damage", this.getScaledWeaponDamage(weapon));
      blade.setData("knockbackForce", weapon.knockbackForce);
      weapon.orbitSprites.push(blade);
    }
  }

  rotateDirection(x, y, radians) {
    if (radians === 0) {
      return { x, y };
    }

    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos
    };
  }

  fireProjectileWeapon(weapon, spreadDeg) {
    const target = this.findNearestEnemy(this.player.x, this.player.y, weapon.range);
    if (!target) {
      return false;
    }

    const baseDirection = {
      x: target.x - this.player.x,
      y: target.y - this.player.y
    };
    const scaledDamage = this.getScaledWeaponDamage(weapon);
    const explosionDamage =
      weapon.explosionDamageMultiplier && weapon.explosionDamageMultiplier > 0
        ? Math.round(scaledDamage * weapon.explosionDamageMultiplier)
        : 0;

    const count = Math.max(1, this.projectileCount);
    const center = (count - 1) / 2;
    const spreadRad = Phaser.Math.DegToRad(spreadDeg);

    let fired = false;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - center) * spreadRad;
      const direction = this.rotateDirection(baseDirection.x, baseDirection.y, offset);
      const didFire = this.spawnProjectile(weapon.type, { x: this.player.x, y: this.player.y }, direction, {
        speed: weapon.projectileSpeed,
        maxDistance: weapon.range,
        damage: scaledDamage,
        knockbackForce: weapon.knockbackForce,
        behavior: weapon.projectileBehavior,
        explosionRadius: weapon.explosionRadius,
        explosionDamage
      });
      fired = fired || didFire;
    }

    return fired;
  }

  fireWeapon(weapon) {
    let fired = false;
    if (weapon.type === "dagger") {
      fired = this.fireDagger(weapon);
    } else if (weapon.type === "fireball") {
      fired = this.fireFireball(weapon);
    } else if (weapon.type === "meteor") {
      fired = this.fireMeteor(weapon);
    } else if (weapon.type === "lightning") {
      fired = this.fireLightning(weapon);
    }

    if (fired && this.scene?.playWeaponFireFeedback) {
      this.scene.playWeaponFireFeedback(this.player.x, this.player.y, weapon.type);
    }
    return fired;
  }

  fireDagger(weapon) {
    return this.fireProjectileWeapon(weapon, 10);
  }

  fireFireball(weapon) {
    return this.fireProjectileWeapon(weapon, 8);
  }

  fireMeteor(weapon) {
    return this.fireProjectileWeapon(weapon, 6);
  }

  fireLightning(weapon) {
    const hitEnemies = [];
    const maxJumps = 3;
    const jumpRange = 175;

    let currentTarget = this.findNearestEnemy(this.player.x, this.player.y, weapon.range);
    if (!currentTarget) {
      return false;
    }

    let sourceX = this.player.x;
    let sourceY = this.player.y;

    const gfx = this.scene.add.graphics().setDepth(8.6);

    for (let i = 0; i < maxJumps && currentTarget; i += 1) {
      const segmentFalloff = 1 - i * 0.22;
      const coreAlpha = Phaser.Math.Clamp(0.95 * segmentFalloff, 0.35, 0.95);
      const outerAlpha = Phaser.Math.Clamp(0.62 * segmentFalloff, 0.2, 0.62);
      const lineWidth = Phaser.Math.Linear(4.2, 2.2, i / Math.max(1, maxJumps - 1));

      gfx.lineStyle(lineWidth, 0xc1f6ff, coreAlpha);
      gfx.lineBetween(sourceX, sourceY, currentTarget.x, currentTarget.y);
      gfx.lineStyle(Math.max(1.4, lineWidth * 0.52), 0x74d8ff, outerAlpha);
      gfx.lineBetween(sourceX, sourceY, currentTarget.x, currentTarget.y);
      gfx.fillStyle(0xd8fbff, Phaser.Math.Clamp(0.6 * segmentFalloff, 0.24, 0.6));
      gfx.fillCircle(currentTarget.x, currentTarget.y, Math.max(3, 7 - i));

      const falloff = i === 0 ? 1 : i === 1 ? 0.8 : 0.65;
      const scaledDamage = this.getScaledWeaponDamage(weapon);
      this.applyDamage(currentTarget, Math.round(scaledDamage * falloff), weapon.knockbackForce, sourceX, sourceY);
      hitEnemies.push(currentTarget);

      sourceX = currentTarget.x;
      sourceY = currentTarget.y;
      currentTarget = this.findNearestEnemy(sourceX, sourceY, jumpRange, new Set(hitEnemies));
    }

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 120,
      onComplete: () => gfx.destroy()
    });

    return true;
  }

  spawnProjectile(type, position, direction, config = {}) {
    const texture = PROJECTILE_TEXTURE_BY_WEAPON[type];
    if (!texture) {
      return false;
    }

    const projectile = this.acquireProjectile(texture);
    if (!projectile) {
      return false;
    }

    const dx = direction.x ?? 0;
    const dy = direction.y ?? 0;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0.0001 ? dx / dist : 1;
    const ny = dist > 0.0001 ? dy / dist : 0;

    projectile.speed = config.speed;
    projectile.maxDistance = config.maxDistance;
    projectile.travelled = 0;
    projectile.damage = config.damage;
    projectile.knockbackForce = config.knockbackForce;
    projectile.behavior = config.behavior;
    projectile.explosionRadius = config.explosionRadius ?? 0;
    projectile.explosionDamage = config.explosionDamage ?? 0;
    const visualProfile = this.getProjectileVisualProfile(type);
    const visualColor = this.getProjectileVisualColor(type);
    projectile.setTint(visualColor);
    projectile.setData("visualColor", visualColor);
    projectile.setData("glowAlpha", visualProfile.glowAlpha);
    projectile.setData("trailBurst", visualProfile.trailBurst);
    projectile.setScale(visualProfile.scaleX, visualProfile.scaleY);
    if (type === "dagger") {
      projectile.setRotation(Math.atan2(ny, nx));
    } else {
      projectile.setRotation(0);
    }

    projectile.enableBody(true, position.x, position.y, true, true);
    projectile.body.setVelocity(nx * config.speed, ny * config.speed);
    return true;
  }

  handleProjectileHit(projectile, enemy) {
    const { projectile: hitProjectile, enemy: hitEnemy } = this.normalizeProjectileEnemyPair(projectile, enemy);

    if (!(hitEnemy instanceof Enemy)) {
      this.warnInvalidProjectileCollision(hitEnemy);
      return;
    }

    if (!hitProjectile || !hitEnemy || !hitProjectile.active || !hitEnemy.active) {
      return;
    }

    const hitX = hitProjectile.x;
    const hitY = hitProjectile.y;
    const explosionRadius = hitProjectile.explosionRadius;
    const explosionDamage = hitProjectile.explosionDamage;
    const behavior = hitProjectile.behavior;

    this.applyDamage(hitEnemy, hitProjectile.damage, hitProjectile.knockbackForce, hitX, hitY);

    if (behavior === "explosion" || behavior === "meteor_explosion") {
      this.triggerExplosion(hitX, hitY, explosionRadius, explosionDamage);
    }

    this.releaseProjectile(hitProjectile);
  }

  handleOrbitBladeHit(blade, enemy) {
    if (!blade?.active || !enemy?.active || !(enemy instanceof Enemy)) {
      return;
    }

    const hitKey = blade.getData("orbitHitKey");
    const now = this.scene.time.now;
    const nextHitAt = enemy.getData(hitKey) || 0;
    if (now < nextHitAt) {
      return;
    }
    enemy.setData(hitKey, now + 120);

    const damage = Math.max(6, Math.round((blade.getData("damage") || 10) * 0.48));
    const knockback = Math.max(40, Math.round((blade.getData("knockbackForce") || 90) * 0.62));
    this.applyDamage(enemy, damage, knockback, this.player.x, this.player.y);
  }

  triggerExplosion(x, y, radius, damage) {
    const safeRadius = Number.isFinite(radius) ? radius : 0;
    if (safeRadius <= 0) {
      return;
    }
    const safeDamage = Number.isFinite(damage) ? damage : 0;

    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xffb169, 0.6);
    gfx.fillCircle(x, y, safeRadius);
    gfx.lineStyle(2, 0xffd8a8, 0.82);
    gfx.strokeCircle(x, y, safeRadius * 0.88);
    gfx.lineStyle(1.5, 0xfff0cc, 0.64);
    gfx.strokeCircle(x, y, safeRadius * 0.56);
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 150,
      onComplete: () => gfx.destroy()
    });

    this.scene.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }

      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist > safeRadius) {
        return;
      }

      this.applyDamage(enemy, safeDamage, 120, x, y);
    });
  }

  applyDamage(enemy, damage, knockbackForce, sourceX, sourceY) {
    if (!(enemy instanceof Enemy) || !enemy.active) {
      this.warnInvalidProjectileCollision(enemy);
      return;
    }
    if (enemy.getData("isDying") || enemy.isDead?.()) {
      return;
    }

    const safeDamage = Number.isFinite(damage) ? damage : 0;
    const safeKnockback = Number.isFinite(knockbackForce) ? knockbackForce : 0;
    enemy?.takeDamage(safeDamage);
    enemy?.applyKnockbackFrom(sourceX, sourceY, safeKnockback);

    if (!enemy.isDead()) {
      return;
    }

    if (this.scene.handleEnemyDefeat) {
      this.scene.handleEnemyDefeat(enemy);
      return;
    }

    this.scene.spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);
    enemy?.destroy?.();
  }

  findNearestEnemy(fromX, fromY, range, excluded = null) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.scene.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }
      if (enemy.getData("isDying") || enemy.isDead?.()) {
        return;
      }
      if (excluded && excluded.has(enemy)) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(fromX, fromY, enemy.x, enemy.y);
      if (distance > range || distance >= nearestDistance) {
        return;
      }

      nearestDistance = distance;
      nearest = enemy;
    });

    return nearest;
  }

  findWeaponByBaseType(baseType) {
    return this.player.weapons.find((weapon) => weapon.baseType === baseType) || null;
  }
}

export { WEAPON_DEFINITIONS, WEAPON_EVOLUTION_RULES };
