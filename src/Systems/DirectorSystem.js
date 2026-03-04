import {
  DIRECTOR_BOSS_SPAWN,
  DIRECTOR_DENSITY_REWORK,
  DIRECTOR_DEFAULT_DURATIONS_MS,
  DIRECTOR_DIFFICULTY_SCALING,
  DIRECTOR_ENEMY_DAMAGE_SCALING,
  DIRECTOR_ENEMY_HP_SCALING,
  DIRECTOR_ELITE_CHANCE,
  DIRECTOR_ELITE_TIME_SCALING,
  DIRECTOR_ENEMY_SPEED,
  DIRECTOR_MINI_BOSS_EVENT,
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

function randomIntInclusive(min, max) {
  const safeMin = Math.ceil(min);
  const safeMax = Math.floor(max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
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
    this.miniBossSpawnAtMs = config.miniBossSpawnAtMs ?? DIRECTOR_MINI_BOSS_EVENT.atMs;
    this.hasMiniBossSpawned = false;
    this.pendingMiniBossSpawnCount = 0;
    this.spawnBurstIntervalMs = config.spawnBurstIntervalMs ?? DIRECTOR_DENSITY_REWORK.burstIntervalMs;
    this.nextSpawnBurstAtMs = this.spawnBurstIntervalMs;
    this.pendingSpawnBurstCount = 0;
  }

  update(deltaMs) {
    this.stateElapsedMs += deltaMs;
    this.totalElapsedMs += deltaMs;
    this.updateBossSpawnSchedule();
    this.updateMiniBossSpawnSchedule();
    this.updateSpawnBurstSchedule();

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

  updateSpawnBurstSchedule() {
    while (this.totalElapsedMs >= this.nextSpawnBurstAtMs) {
      this.pendingSpawnBurstCount += randomIntInclusive(
        DIRECTOR_DENSITY_REWORK.burstMinCount,
        DIRECTOR_DENSITY_REWORK.burstMaxCount
      );
      this.nextSpawnBurstAtMs += this.spawnBurstIntervalMs;
    }
  }

  updateMiniBossSpawnSchedule() {
    if (this.hasMiniBossSpawned) {
      return;
    }

    if (this.totalElapsedMs < this.miniBossSpawnAtMs) {
      return;
    }

    this.pendingMiniBossSpawnCount = 1;
    this.hasMiniBossSpawned = true;
  }

  consumeBossSpawnRequests() {
    const pending = this.pendingBossSpawnCount;
    this.pendingBossSpawnCount = 0;
    return pending;
  }

  consumeSpawnBurstRequests() {
    const pending = this.pendingSpawnBurstCount;
    this.pendingSpawnBurstCount = 0;
    return pending;
  }

  consumeMiniBossSpawnRequests() {
    const pending = this.pendingMiniBossSpawnCount;
    this.pendingMiniBossSpawnCount = 0;
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

  getEnemyHpDifficultyMultiplier() {
    return DIRECTOR_ENEMY_HP_SCALING.base + this.getElapsedMinutes() * DIRECTOR_ENEMY_HP_SCALING.perMinute;
  }

  getEnemyDamageDifficultyMultiplier() {
    return DIRECTOR_ENEMY_DAMAGE_SCALING.base + this.getElapsedMinutes() * DIRECTOR_ENEMY_DAMAGE_SCALING.perMinute;
  }

  getSpawnRateMultiplier() {
    const difficulty = this.getDifficultyMultiplier();

    if (this.state === DIRECTOR_STATE.BUILD) {
      return (
        lerp(DIRECTOR_SPAWN_RATE.buildStart, DIRECTOR_SPAWN_RATE.buildEnd, this.getStateProgress()) *
        difficulty *
        DIRECTOR_DENSITY_REWORK.spawnRateBoost
      );
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return DIRECTOR_SPAWN_RATE.peakBase * difficulty * DIRECTOR_DENSITY_REWORK.spawnRateBoost;
    }
    return DIRECTOR_SPAWN_RATE.relief * difficulty * DIRECTOR_DENSITY_REWORK.spawnRateBoost;
  }

  getEnemySpeedMultiplier() {
    let stateMultiplier = DIRECTOR_ENEMY_SPEED.relief;
    if (this.state === DIRECTOR_STATE.BUILD) {
      stateMultiplier = lerp(DIRECTOR_ENEMY_SPEED.buildStart, DIRECTOR_ENEMY_SPEED.buildEnd, this.getStateProgress());
    } else if (this.state === DIRECTOR_STATE.PEAK) {
      stateMultiplier = DIRECTOR_ENEMY_SPEED.peak;
    }
    return stateMultiplier * DIRECTOR_DENSITY_REWORK.enemySpeedBoost;
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
    return this.getEnemyHpDifficultyMultiplier();
  }

  getEnemyDamageMultiplier() {
    return this.getEnemyDamageDifficultyMultiplier();
  }
}

export { DIRECTOR_STATE };
