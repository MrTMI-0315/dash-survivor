export const DIRECTOR_STATE = {
  BUILD: "BUILD",
  PEAK: "PEAK",
  RELIEF: "RELIEF"
};

export const DIRECTOR_STATE_SEQUENCE = [DIRECTOR_STATE.BUILD, DIRECTOR_STATE.PEAK, DIRECTOR_STATE.RELIEF];

export const DIRECTOR_DEFAULT_DURATIONS_MS = {
  [DIRECTOR_STATE.BUILD]: 30000,
  [DIRECTOR_STATE.PEAK]: 15000,
  [DIRECTOR_STATE.RELIEF]: 8000
};

export const DIRECTOR_BOSS_SPAWN = {
  intervalMs: 180000
};

export const DIRECTOR_MINI_BOSS_EVENT = {
  firstAtMs: 60000,
  intervalMs: 60000
};

export const DIRECTOR_HATCH_BREACH_EVENT = {
  minAtMs: 60000,
  maxAtMs: 90000,
  minCount: 6,
  maxCount: 10
};

export const DIRECTOR_LADDER_SPAWN_EVENT = {
  intervalMs: 45000,
  minCount: 3,
  maxCount: 5
};

export const DIRECTOR_SPAWN_RATE = {
  buildStart: 0.85,
  buildEnd: 1.25,
  peakBase: 1.42,
  peakTierBonusPerTier: 0.08,
  peakTierBonusCap: 0.5,
  relief: 0.35
};

export const DIRECTOR_ENEMY_SPEED = {
  buildStart: 1.0,
  buildEnd: 1.08,
  peak: 1.0833333333333333,
  relief: 1.0
};

export const DIRECTOR_ELITE_CHANCE = {
  build: 0.04,
  peak: 0.045,
  relief: 0.01
};

export const DIRECTOR_ELITE_TIME_SCALING = {
  perMinute: 0.022,
  maxChance: 0.72
};

export const DIRECTOR_DIFFICULTY_SCALING = {
  base: 1,
  perMinute: 0.1
};

export const DIRECTOR_ENEMY_HP_SCALING = {
  base: 1,
  perMinute: 0.08
};

export const DIRECTOR_ENEMY_DAMAGE_SCALING = {
  base: 1,
  perMinute: 0.06
};

export const DIRECTOR_DENSITY_REWORK = {
  spawnRateBoost: 1.2,
  enemySpeedBoost: 1.2,
  burstIntervalMs: 22000,
  burstMinCount: 6,
  burstMaxCount: 9
};

export const DIRECTOR_ADAPTIVE_DIFFICULTY = {
  windowMs: 10000,
  baselineDps: 60,
  baselineKillRate: 0.65,
  dpsWeight: 0.55,
  killRateWeight: 0.45,
  smoothing: 0.2,
  maxPositiveScale: 0.18,
  maxNegativeScale: 0.12,
  minOffset: -4,
  maxOffset: 8
};
