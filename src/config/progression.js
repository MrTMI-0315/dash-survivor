export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1350;
export const ENEMY_POOL_SIZE = 420;
export const SAFE_RADIUS = 300;
export const BASE_SPAWN_CHECK_INTERVAL_MS = 250;

export const TARGET_ENEMY_CURVE = [
  { startSec: 0, endSec: 20, from: 3, to: 7 },
  { startSec: 20, endSec: 60, from: 7, to: 16 },
  { startSec: 60, endSec: 100, from: 16, to: 20.5 },
  { startSec: 100, endSec: 150, from: 26, to: 18 },
  { startSec: 150, endSec: 240, from: 18, to: 24 }
];

export const TARGET_ENEMY_FALLBACK = 24;

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
