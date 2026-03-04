import {
  DIRECTOR_DEFAULT_DURATIONS_MS,
  DIRECTOR_ELITE_CHANCE,
  DIRECTOR_ENEMY_SPEED,
  DIRECTOR_SPAWN_RATE,
  DIRECTOR_STATE,
  DIRECTOR_STATE_SEQUENCE
} from "../config/director.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(from, to, t) {
  return from + (to - from) * clamp01(t);
}

export class DirectorSystem {
  constructor(config = {}) {
    this.durationsMs = {
      [DIRECTOR_STATE.BUILD]: config.buildMs ?? DIRECTOR_DEFAULT_DURATIONS_MS[DIRECTOR_STATE.BUILD],
      [DIRECTOR_STATE.PEAK]: config.peakMs ?? DIRECTOR_DEFAULT_DURATIONS_MS[DIRECTOR_STATE.PEAK],
      [DIRECTOR_STATE.RELIEF]: config.reliefMs ?? DIRECTOR_DEFAULT_DURATIONS_MS[DIRECTOR_STATE.RELIEF]
    };

    this.state = DIRECTOR_STATE.BUILD;
    this.stateElapsedMs = 0;
  }

  update(deltaMs) {
    this.stateElapsedMs += deltaMs;
    const duration = this.getStateDurationMs(this.state);
    if (this.stateElapsedMs < duration) {
      return false;
    }

    this.stateElapsedMs -= duration;
    this.advanceState();
    return true;
  }

  advanceState() {
    const index = DIRECTOR_STATE_SEQUENCE.indexOf(this.state);
    const nextIndex = (index + 1) % DIRECTOR_STATE_SEQUENCE.length;
    this.state = DIRECTOR_STATE_SEQUENCE[nextIndex];
  }

  getState() {
    return this.state;
  }

  getStateDurationMs(state) {
    return this.durationsMs[state] ?? 10000;
  }

  getStateProgress() {
    return this.stateElapsedMs / this.getStateDurationMs(this.state);
  }

  getSpawnRateMultiplier(difficultyTier = 0) {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return lerp(DIRECTOR_SPAWN_RATE.buildStart, DIRECTOR_SPAWN_RATE.buildEnd, this.getStateProgress());
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      const tier = Math.max(0, Math.floor(difficultyTier));
      const peakDifficultyBonus = 1 + Math.min(DIRECTOR_SPAWN_RATE.peakTierBonusCap, tier * DIRECTOR_SPAWN_RATE.peakTierBonusPerTier);
      return DIRECTOR_SPAWN_RATE.peakBase * peakDifficultyBonus;
    }
    return DIRECTOR_SPAWN_RATE.relief;
  }

  getEnemySpeedMultiplier() {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return lerp(DIRECTOR_ENEMY_SPEED.buildStart, DIRECTOR_ENEMY_SPEED.buildEnd, this.getStateProgress());
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return DIRECTOR_ENEMY_SPEED.peak;
    }
    return DIRECTOR_ENEMY_SPEED.relief;
  }

  getEliteChance() {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return DIRECTOR_ELITE_CHANCE.build;
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return DIRECTOR_ELITE_CHANCE.peak;
    }
    return DIRECTOR_ELITE_CHANCE.relief;
  }
}

export { DIRECTOR_STATE };
