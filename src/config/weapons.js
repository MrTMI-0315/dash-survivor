export const WEAPON_DEFINITIONS = {
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

export const WEAPON_EVOLUTION_RULES = [
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

export const PROJECTILE_TEXTURE_BY_WEAPON = {
  dagger: "proj_dagger",
  fireball: "proj_fireball",
  meteor: "proj_meteor"
};

export const PROJECTILE_POOL_SIZE_BY_TEXTURE = {
  proj_dagger: 520,
  proj_fireball: 240,
  proj_meteor: 180
};

export const LEVEL_UP_UPGRADES = [
  {
    id: "weapon_damage",
    label: "Weapon Damage",
    description: "All weapon damage +12%",
    value: 0.12
  },
  {
    id: "attack_speed",
    label: "Attack Speed",
    description: "Faster attacks +10%",
    value: 0.1
  },
  {
    id: "projectile_count",
    label: "Projectile Count",
    description: "Extra projectile +1",
    value: 1
  },
  {
    id: "movement_speed",
    label: "Movement Speed",
    description: "Move speed +20",
    value: 20
  },
  {
    id: "pickup_radius",
    label: "Pickup Radius",
    description: "Orb pickup radius +40",
    value: 40
  }
];
