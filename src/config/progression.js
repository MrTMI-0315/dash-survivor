export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1350;
export const ENEMY_POOL_SIZE = 420;
export const SAFE_RADIUS = 300;
export const BASE_SPAWN_CHECK_INTERVAL_MS = 250;
export const PLAYTEST_SPAWN_PACING_PRESETS = Object.freeze({
  EASY: Object.freeze({
    spawnIntervalScale: 1.15,
    targetCountScale: 0.85
  }),
  NORMAL: Object.freeze({
    spawnIntervalScale: 1,
    targetCountScale: 1
  }),
  HARD: Object.freeze({
    spawnIntervalScale: 0.85,
    targetCountScale: 1.2
  })
});
export const PLAYTEST_SPAWN_PACING_ORDER = Object.freeze(["EASY", "NORMAL", "HARD"]);
export const PLAYTEST_SPAWN_PACING_DEFAULT = "NORMAL";

export const SPAWN_LANES = Object.freeze({
  BOW: "BOW",
  STERN: "STERN",
  PORT: "PORT",
  STARBOARD: "STARBOARD"
});

export const SPAWN_LANE_KEYS = Object.freeze([
  SPAWN_LANES.BOW,
  SPAWN_LANES.STERN,
  SPAWN_LANES.PORT,
  SPAWN_LANES.STARBOARD
]);

// Lane rules: spawn off-screen around view bounds and sample within themed edge ranges.
export const SPAWN_LANE_RULES = Object.freeze({
  [SPAWN_LANES.BOW]: {
    edge: "top",
    rangeStart: 0.15,
    rangeEnd: 0.85,
    offscreenOffset: 90
  },
  [SPAWN_LANES.STERN]: {
    edge: "bottom",
    rangeStart: 0.15,
    rangeEnd: 0.85,
    offscreenOffset: 90
  },
  [SPAWN_LANES.PORT]: {
    edge: "left",
    rangeStart: 0.12,
    rangeEnd: 0.88,
    offscreenOffset: 90
  },
  [SPAWN_LANES.STARBOARD]: {
    edge: "right",
    rangeStart: 0.12,
    rangeEnd: 0.88,
    offscreenOffset: 90
  }
});

export const TARGET_ENEMY_CURVE = [
  { startSec: 0, endSec: 20, from: 3, to: 7 },
  { startSec: 20, endSec: 60, from: 7, to: 15 },
  { startSec: 60, endSec: 100, from: 15, to: 19 },
  { startSec: 100, endSec: 150, from: 22, to: 17 },
  { startSec: 150, endSec: 240, from: 17, to: 21 }
];

export const TARGET_ENEMY_FALLBACK = 21;

export const SPAWN_BURST_CONFIG = {
  defaultBurst: 1,
  steps: [
    { atSec: 35, burst: 2 },
    { atSec: 70, burst: 3 },
    { atSec: 120, burst: 2 }
  ]
};

export const XP_REQUIREMENTS = {
  byLevel: {
    1: 50,
    2: 80,
    3: 120
  },
  postL3Base: 120,
  postL3Step: 50
};
