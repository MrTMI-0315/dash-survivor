const WEAPON_DEFINITIONS = {
  fireball: {
    type: "fireball",
    damage: 22,
    cooldownMs: 1400,
    range: 380,
    knockbackForce: 150,
    projectileBehavior: "explosion",
    projectileSpeed: 245,
    explosionRadius: 64,
    explosionDamageMultiplier: 0.72
  },
  dagger: {
    type: "dagger",
    damage: 10,
    cooldownMs: 420,
    range: 220,
    knockbackForce: 110,
    projectileBehavior: "fast",
    projectileSpeed: 560
  },
  lightning: {
    type: "lightning",
    damage: 20,
    cooldownMs: 1500,
    range: 320,
    knockbackForce: 80,
    projectileBehavior: "chain"
  },
  meteor: {
    type: "meteor",
    damage: 52,
    cooldownMs: 1850,
    range: 430,
    knockbackForce: 200,
    projectileBehavior: "meteor_explosion",
    projectileSpeed: 215,
    explosionRadius: 118,
    explosionDamageMultiplier: 1.0,
    evolved: true
  },
  orbit_blades: {
    type: "orbit_blades",
    damage: 16,
    cooldownMs: 230,
    range: 120,
    knockbackForce: 95,
    projectileBehavior: "orbit",
    orbitBladeCount: 3,
    orbitRadius: 84,
    orbitSpeed: 0.0053,
    evolved: true
  }
};

const WEAPON_EVOLUTION_RULES = [
  {
    weapon: "fireball",
    level: 5,
    requiredPassive: "ember_core",
    evolution: "meteor"
  },
  {
    weapon: "dagger",
    level: 5,
    requiredPassive: "blade_sigil",
    evolution: "orbit_blades"
  }
];

function getWeaponDefinition(type) {
  return WEAPON_DEFINITIONS[type] ?? null;
}

export class WeaponSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    this.projectiles = scene.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    this.orbitBlades = scene.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    scene.physics.add.overlap(this.projectiles, scene.enemies, this.handleProjectileHit, null, this);
    scene.physics.add.overlap(this.orbitBlades, scene.enemies, this.handleOrbitBladeHit, null, this);
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
        weapon.nextFireAt = time + weapon.cooldownMs;
      }
    });
  }

  updateProjectiles(delta) {
    this.projectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) {
        return;
      }

      projectile.travelled += (projectile.speed * delta) / 1000;
      if (projectile.travelled >= projectile.maxDistance) {
        projectile.destroy();
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
        blade.setData("damage", weapon.damage);
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
      blade.setData("weaponBaseType", weapon.baseType);
      blade.setData("orbitHitKey", `orbit_hit_${weapon.baseType}`);
      blade.setData("damage", weapon.damage);
      blade.setData("knockbackForce", weapon.knockbackForce);
      weapon.orbitSprites.push(blade);
    }
  }

  fireWeapon(weapon) {
    if (weapon.type === "dagger") {
      return this.fireDagger(weapon);
    }
    if (weapon.type === "fireball") {
      return this.fireFireball(weapon);
    }
    if (weapon.type === "meteor") {
      return this.fireMeteor(weapon);
    }
    if (weapon.type === "lightning") {
      return this.fireLightning(weapon);
    }
    return false;
  }

  fireDagger(weapon) {
    const target = this.findNearestEnemy(this.player.x, this.player.y, weapon.range);
    if (!target) {
      return false;
    }

    this.spawnProjectile({
      texture: "proj_dagger",
      sourceX: this.player.x,
      sourceY: this.player.y,
      targetX: target.x,
      targetY: target.y,
      speed: weapon.projectileSpeed,
      maxDistance: weapon.range,
      damage: weapon.damage,
      knockbackForce: weapon.knockbackForce,
      behavior: weapon.projectileBehavior
    });

    return true;
  }

  fireFireball(weapon) {
    const target = this.findNearestEnemy(this.player.x, this.player.y, weapon.range);
    if (!target) {
      return false;
    }

    this.spawnProjectile({
      texture: "proj_fireball",
      sourceX: this.player.x,
      sourceY: this.player.y,
      targetX: target.x,
      targetY: target.y,
      speed: weapon.projectileSpeed,
      maxDistance: weapon.range,
      damage: weapon.damage,
      knockbackForce: weapon.knockbackForce,
      behavior: weapon.projectileBehavior,
      explosionRadius: weapon.explosionRadius,
      explosionDamage: Math.round(weapon.damage * weapon.explosionDamageMultiplier)
    });

    return true;
  }

  fireMeteor(weapon) {
    const target = this.findNearestEnemy(this.player.x, this.player.y, weapon.range);
    if (!target) {
      return false;
    }

    this.spawnProjectile({
      texture: "proj_meteor",
      sourceX: this.player.x,
      sourceY: this.player.y,
      targetX: target.x,
      targetY: target.y,
      speed: weapon.projectileSpeed,
      maxDistance: weapon.range,
      damage: weapon.damage,
      knockbackForce: weapon.knockbackForce,
      behavior: weapon.projectileBehavior,
      explosionRadius: weapon.explosionRadius,
      explosionDamage: Math.round(weapon.damage * weapon.explosionDamageMultiplier)
    });

    return true;
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

    const gfx = this.scene.add.graphics();
    gfx.lineStyle(3, 0xc1f6ff, 1);

    for (let i = 0; i < maxJumps && currentTarget; i += 1) {
      gfx.lineBetween(sourceX, sourceY, currentTarget.x, currentTarget.y);
      const falloff = i === 0 ? 1 : i === 1 ? 0.8 : 0.65;
      this.applyDamage(currentTarget, Math.round(weapon.damage * falloff), weapon.knockbackForce, sourceX, sourceY);
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

  spawnProjectile(config) {
    const projectile = this.projectiles.create(config.sourceX, config.sourceY, config.texture);

    const dx = config.targetX - config.sourceX;
    const dy = config.targetY - config.sourceY;
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

    projectile.body.setCircle(projectile.displayWidth * 0.45, 0, 0);
    projectile.body.setVelocity(nx * config.speed, ny * config.speed);
  }

  handleProjectileHit(projectile, enemy) {
    if (!projectile.active || !enemy.active) {
      return;
    }

    this.applyDamage(enemy, projectile.damage, projectile.knockbackForce, projectile.x, projectile.y);

    if (projectile.behavior === "explosion" || projectile.behavior === "meteor_explosion") {
      this.triggerExplosion(projectile.x, projectile.y, projectile.explosionRadius, projectile.explosionDamage);
    }

    projectile.destroy();
  }

  handleOrbitBladeHit(blade, enemy) {
    if (!blade.active || !enemy.active) {
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
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xffb169, 0.6);
    gfx.fillCircle(x, y, radius);
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
      if (dist > radius) {
        return;
      }

      this.applyDamage(enemy, damage, 120, x, y);
    });
  }

  applyDamage(enemy, damage, knockbackForce, sourceX, sourceY) {
    enemy.takeDamage(damage);
    enemy.applyKnockbackFrom(sourceX, sourceY, knockbackForce);

    if (!enemy.isDead()) {
      return;
    }

    this.scene.spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);
    enemy.destroy();
  }

  findNearestEnemy(fromX, fromY, range, excluded = null) {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.scene.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
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
