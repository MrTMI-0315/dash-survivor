import {
  DIRECTOR_BOSS_SPAWN,
  DIRECTOR_DEFAULT_DURATIONS_MS,
  DIRECTOR_DIFFICULTY_SCALING,
  DIRECTOR_ELITE_CHANCE,
  DIRECTOR_ELITE_TIME_SCALING,
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
    this.totalElapsedMs = 0;
    this.bossSpawnIntervalMs = config.bossSpawnIntervalMs ?? DIRECTOR_BOSS_SPAWN.intervalMs;
    this.nextBossSpawnAtMs = this.bossSpawnIntervalMs;
    this.pendingBossSpawnCount = 0;
  }

  update(deltaMs) {
    this.stateElapsedMs += deltaMs;
    this.totalElapsedMs += deltaMs;
    this.updateBossSpawnSchedule();

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

  updateBossSpawnSchedule() {
    while (this.totalElapsedMs >= this.nextBossSpawnAtMs) {
      this.pendingBossSpawnCount += 1;
      this.nextBossSpawnAtMs += this.bossSpawnIntervalMs;
    }
  }

  consumeBossSpawnRequests() {
    const pending = this.pendingBossSpawnCount;
    this.pendingBossSpawnCount = 0;
    return pending;
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

  getElapsedMinutes() {
    return this.totalElapsedMs / 60000;
  }

  getDifficultyMultiplier() {
    return DIRECTOR_DIFFICULTY_SCALING.base + this.getElapsedMinutes() * DIRECTOR_DIFFICULTY_SCALING.perMinute;
  }

  getSpawnRateMultiplier() {
    const difficulty = this.getDifficultyMultiplier();

    if (this.state === DIRECTOR_STATE.BUILD) {
      return lerp(DIRECTOR_SPAWN_RATE.buildStart, DIRECTOR_SPAWN_RATE.buildEnd, this.getStateProgress()) * difficulty;
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return DIRECTOR_SPAWN_RATE.peakBase * difficulty;
    }
    return DIRECTOR_SPAWN_RATE.relief * difficulty;
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
    let baseChance = DIRECTOR_ELITE_CHANCE.relief;
    if (this.state === DIRECTOR_STATE.BUILD) {
      baseChance = DIRECTOR_ELITE_CHANCE.build;
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      baseChance = DIRECTOR_ELITE_CHANCE.peak;
    }

    const scaledChance = baseChance + this.getElapsedMinutes() * DIRECTOR_ELITE_TIME_SCALING.perMinute;
    return Math.min(DIRECTOR_ELITE_TIME_SCALING.maxChance, scaledChance);
  }

  getEnemyHpMultiplier() {
    return this.getDifficultyMultiplier();
  }

  getEnemyDamageMultiplier() {
    return this.getDifficultyMultiplier();
  }
}

export { DIRECTOR_STATE };
