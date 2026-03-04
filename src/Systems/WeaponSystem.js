const WEAPON_DEFINITIONS = {
  fireball: {
    type: "fireball",
    damage: 22,
    cooldownMs: 1400,
    range: 380,
    projectileBehavior: "explosion"
  },
  dagger: {
    type: "dagger",
    damage: 10,
    cooldownMs: 420,
    range: 220,
    projectileBehavior: "fast"
  },
  lightning: {
    type: "lightning",
    damage: 20,
    cooldownMs: 1500,
    range: 320,
    projectileBehavior: "chain"
  }
};

export class WeaponSystem {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;

    this.projectiles = scene.physics.add.group({
      allowGravity: false,
      immovable: true
    });

    scene.physics.add.overlap(this.projectiles, scene.enemies, this.handleProjectileHit, null, this);
  }

  addWeapon(type) {
    const definition = WEAPON_DEFINITIONS[type];
    if (!definition) {
      return false;
    }

    const existing = this.player.weapons.find((weapon) => weapon.type === type);
    if (existing) {
      existing.damage = Math.round(existing.damage * 1.16);
      existing.cooldownMs = Math.max(150, Math.floor(existing.cooldownMs * 0.92));
      return false;
    }

    if (this.player.weapons.length >= this.player.maxWeaponSlots) {
      const fallback = this.player.weapons[0];
      fallback.damage += Math.round(definition.damage * 0.45);
      return false;
    }

    this.player.weapons.push({
      ...definition,
      nextFireAt: 0
    });
    return true;
  }

  update(time, delta) {
    this.updateProjectiles(delta);

    this.player.weapons.forEach((weapon) => {
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

  fireWeapon(weapon) {
    if (weapon.type === "dagger") {
      return this.fireDagger(weapon);
    }
    if (weapon.type === "fireball") {
      return this.fireFireball(weapon);
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
      speed: 560,
      maxDistance: weapon.range,
      damage: weapon.damage,
      knockbackForce: 110,
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
      speed: 245,
      maxDistance: weapon.range,
      damage: weapon.damage,
      knockbackForce: 150,
      behavior: weapon.projectileBehavior,
      explosionRadius: 64,
      explosionDamage: Math.round(weapon.damage * 0.72)
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
      this.applyDamage(currentTarget, Math.round(weapon.damage * falloff), 80, sourceX, sourceY);
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

    if (projectile.behavior === "explosion") {
      this.triggerExplosion(projectile.x, projectile.y, projectile.explosionRadius, projectile.explosionDamage);
    }

    projectile.destroy();
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
}

export { WEAPON_DEFINITIONS };
