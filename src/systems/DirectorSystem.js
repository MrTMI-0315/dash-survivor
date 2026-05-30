import {
  DIRECTOR_ADAPTIVE_DIFFICULTY,
  DIRECTOR_BOSS_SPAWN,
  DIRECTOR_DENSITY_REWORK,
  DIRECTOR_DEFAULT_DURATIONS_MS,
  DIRECTOR_DIFFICULTY_SCALING,
  DIRECTOR_ENEMY_DAMAGE_SCALING,
  DIRECTOR_ENEMY_HP_SCALING,
  DIRECTOR_ELITE_CHANCE,
  DIRECTOR_ELITE_TIME_SCALING,
  DIRECTOR_ENEMY_SPEED,
  DIRECTOR_HATCH_BREACH_EVENT,
  DIRECTOR_LADDER_SPAWN_EVENT,
  DIRECTOR_MINI_BOSS_EVENT,
  DIRECTOR_SPAWN_RATE,
  DIRECTOR_STATE,
  DIRECTOR_STATE_SEQUENCE
} from "../config/director.js";
import { SPAWN_LANE_KEYS, SPAWN_LANES } from "../config/progression.js";

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

function randomArrayItem(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export class DirectorSystem {
  constructor(config = {}) {
    this.paused = false;
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
    this.miniBossSpawnIntervalMs = config.miniBossSpawnIntervalMs ?? DIRECTOR_MINI_BOSS_EVENT.intervalMs;
    this.nextMiniBossSpawnAtMs = config.firstMiniBossSpawnAtMs ?? DIRECTOR_MINI_BOSS_EVENT.firstAtMs;
    this.pendingMiniBossSpawnCount = 0;
    this.spawnBurstIntervalMs = config.spawnBurstIntervalMs ?? DIRECTOR_DENSITY_REWORK.burstIntervalMs;
    this.nextSpawnBurstAtMs = this.spawnBurstIntervalMs;
    this.pendingSpawnBurstCount = 0;
    this.ladderSpawnIntervalMs = config.ladderSpawnIntervalMs ?? DIRECTOR_LADDER_SPAWN_EVENT.intervalMs;
    this.nextLadderSpawnAtMs = this.ladderSpawnIntervalMs;
    this.pendingLadderSpawnCount = 0;
    this.hatchBreachAtMs = randomIntInclusive(DIRECTOR_HATCH_BREACH_EVENT.minAtMs, DIRECTOR_HATCH_BREACH_EVENT.maxAtMs);
    this.hasHatchBreachSpawned = false;
    this.pendingHatchBreachSpawnCount = 0;
    this.adaptivePerformance = 0;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  update(deltaMs) {
    if (this.paused) {
      return false;
    }
    this.stateElapsedMs += deltaMs;
    this.totalElapsedMs += deltaMs;
    this.updateBossSpawnSchedule();
    this.updateMiniBossSpawnSchedule();
    this.updateSpawnBurstSchedule();
    this.updateLadderSpawnSchedule();
    this.updateHatchBreachSchedule();

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
    while (this.totalElapsedMs >= this.nextMiniBossSpawnAtMs) {
      this.pendingMiniBossSpawnCount = 1;
      this.nextMiniBossSpawnAtMs += this.miniBossSpawnIntervalMs;
    }
  }

  updateLadderSpawnSchedule() {
    while (this.totalElapsedMs >= this.nextLadderSpawnAtMs) {
      this.pendingLadderSpawnCount += randomIntInclusive(
        DIRECTOR_LADDER_SPAWN_EVENT.minCount,
        DIRECTOR_LADDER_SPAWN_EVENT.maxCount
      );
      this.nextLadderSpawnAtMs += this.ladderSpawnIntervalMs;
    }
  }

  updateHatchBreachSchedule() {
    if (this.hasHatchBreachSpawned) {
      return;
    }
    if (this.totalElapsedMs < this.hatchBreachAtMs) {
      return;
    }

    this.pendingHatchBreachSpawnCount = randomIntInclusive(
      DIRECTOR_HATCH_BREACH_EVENT.minCount,
      DIRECTOR_HATCH_BREACH_EVENT.maxCount
    );
    this.hasHatchBreachSpawned = true;
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

  consumeLadderSpawnRequests() {
    const pending = this.pendingLadderSpawnCount;
    this.pendingLadderSpawnCount = 0;
    return pending;
  }

  consumeHatchBreachSpawnRequests() {
    const pending = this.pendingHatchBreachSpawnCount;
    this.pendingHatchBreachSpawnCount = 0;
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

  getAdaptiveWindowMs() {
    return DIRECTOR_ADAPTIVE_DIFFICULTY.windowMs;
  }

  getAdaptiveTargetOffset(baseTarget, dpsEstimate, killRate) {
    const cfg = DIRECTOR_ADAPTIVE_DIFFICULTY;
    const safeBaseTarget = Math.max(1, Number(baseTarget) || 1);
    const safeDps = Math.max(0, Number(dpsEstimate) || 0);
    const safeKillRate = Math.max(0, Number(killRate) || 0);

    const dpsNorm = (safeDps - cfg.baselineDps) / Math.max(1, cfg.baselineDps);
    const killNorm = (safeKillRate - cfg.baselineKillRate) / Math.max(0.01, cfg.baselineKillRate);
    const rawPerformance = Math.max(-1, Math.min(1, dpsNorm * cfg.dpsWeight + killNorm * cfg.killRateWeight));
    this.adaptivePerformance = lerp(this.adaptivePerformance, rawPerformance, cfg.smoothing);

    const positiveOffset = Math.max(0, this.adaptivePerformance) * (safeBaseTarget * cfg.maxPositiveScale);
    const negativeOffset = Math.min(0, this.adaptivePerformance) * (safeBaseTarget * cfg.maxNegativeScale);
    const offset = Math.round(positiveOffset + negativeOffset);
    return Math.max(cfg.minOffset, Math.min(cfg.maxOffset, offset));
  }

  chooseSpawnLane(preferredLane = null) {
    if (preferredLane && SPAWN_LANE_KEYS.includes(preferredLane)) {
      return preferredLane;
    }
    return randomArrayItem(SPAWN_LANE_KEYS);
  }

  chooseLadderLane(preferredLane = null) {
    const ladderLanes = [SPAWN_LANES.PORT, SPAWN_LANES.STARBOARD];
    if (preferredLane && ladderLanes.includes(preferredLane)) {
      return preferredLane;
    }
    return randomArrayItem(ladderLanes);
  }
}

export { DIRECTOR_STATE };
