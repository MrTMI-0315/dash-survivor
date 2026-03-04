const DIRECTOR_STATE = {
  BUILD: "BUILD",
  PEAK: "PEAK",
  RELIEF: "RELIEF"
};

const STATE_SEQUENCE = [DIRECTOR_STATE.BUILD, DIRECTOR_STATE.PEAK, DIRECTOR_STATE.RELIEF];

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(from, to, t) {
  return from + (to - from) * clamp01(t);
}

export class DirectorSystem {
  constructor(config = {}) {
    this.durationsMs = {
      [DIRECTOR_STATE.BUILD]: config.buildMs ?? 30000,
      [DIRECTOR_STATE.PEAK]: config.peakMs ?? 15000,
      [DIRECTOR_STATE.RELIEF]: config.reliefMs ?? 8000
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
    const index = STATE_SEQUENCE.indexOf(this.state);
    const nextIndex = (index + 1) % STATE_SEQUENCE.length;
    this.state = STATE_SEQUENCE[nextIndex];
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

  getSpawnRateMultiplier() {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return lerp(0.85, 1.25, this.getStateProgress());
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return 1.8;
    }
    return 0.35;
  }

  getEnemySpeedMultiplier() {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return lerp(1.0, 1.08, this.getStateProgress());
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return 1.16;
    }
    return 1.0;
  }

  getEliteChance() {
    if (this.state === DIRECTOR_STATE.BUILD) {
      return 0.04;
    }
    if (this.state === DIRECTOR_STATE.PEAK) {
      return 0.22;
    }
    return 0.01;
  }
}

export { DIRECTOR_STATE };
