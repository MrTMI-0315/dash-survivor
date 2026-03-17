export const ENEMY_ARCHETYPE_CONFIGS = {
  chaser: {
    speed: 110,
    hp: 14,
    damage: 10,
    xpValue: 12,
    radius: 14,
    scale: 1.44,
    tint: 0xff6d6d
  },
  tank: {
    speed: 52,
    hp: 70,
    damage: 14,
    xpValue: 24,
    radius: 18,
    scale: 1.18,
    tint: 0xffb05b
  },
  swarm: {
    speed: 84,
    hp: 8,
    damage: 5,
    xpValue: 5,
    radius: 10,
    scale: 1.2,
    tint: 0xff8a9c
  },
  hunter: {
    speed: 176,
    hp: 9,
    damage: 6,
    xpValue: 11,
    radius: 11,
    scale: 1.36,
    tint: 0x6db8ff
  }
};

export const ENEMY_VISUAL_SCALE = Object.freeze({
  eliteMultiplier: 1.24
});

export const ELITE_TYPE_CONFIGS = {
  speed_boost: {
    tint: 0x76e7ff,
    hpMultiplier: 2.1
  },
  dash_attack: {
    tint: 0xff8f70,
    hpMultiplier: 2.35
  },
  poison_aura: {
    tint: 0x8ef58f,
    hpMultiplier: 2.6
  }
};

export const ENEMY_TYPE_WEIGHTS = [
  { type: "chaser", weight: 40 },
  { type: "tank", weight: 22 },
  { type: "swarm", weight: 23 },
  { type: "hunter", weight: 15 }
];

export const HUNTER_UNLOCK_TIME_SEC = 45;
