import { Player } from "../entities/Player.js";
import { BossEnemy } from "../entities/BossEnemy.js";
import { DirectorSystem, DIRECTOR_STATE } from "../Systems/DirectorSystem.js";
import { WeaponSystem } from "../Systems/WeaponSystem.js";
import { MetaProgressionSystem } from "../Systems/MetaProgressionSystem.js";
import { ObjectPool } from "../Systems/ObjectPool.js";
import { ENEMY_ARCHETYPE_CONFIGS, ENEMY_TYPE_WEIGHTS, HUNTER_UNLOCK_TIME_SEC } from "../config/enemies.js";
import { LEVEL_UP_UPGRADES } from "../config/weapons.js";
import { DIRECTOR_BOSS_SPAWN } from "../config/director.js";
import {
  BASE_SPAWN_CHECK_INTERVAL_MS,
  ENEMY_POOL_SIZE,
  PLAYTEST_SPAWN_PACING_DEFAULT,
  PLAYTEST_SPAWN_PACING_ORDER,
  PLAYTEST_SPAWN_PACING_PRESETS,
  SAFE_RADIUS,
  SPAWN_LANES,
  SPAWN_LANE_KEYS,
  SPAWN_LANE_RULES,
  SPAWN_BURST_CONFIG,
  TARGET_ENEMY_CURVE,
  TARGET_ENEMY_FALLBACK,
  TARGET_ENEMY_WAVE_DURATION_SEC,
  TARGET_ENEMY_WAVE_INCREMENT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  XP_REQUIREMENTS
} from "../config/progression.js";

const SHIP_DECK_OBSTACLE_LAYOUT = [
  // Mast: central large anchor that promotes circular kiting.
  { type: "terrain_pillar", role: "mast", x: 1080, y: 675, scale: 1.7 },

  // Crate cluster A (mid-right).
  { type: "terrain_rock", role: "crate", x: 1490, y: 520, scale: 1.02 },
  { type: "terrain_pillar", role: "crate", x: 1570, y: 565, scale: 0.94 },
  { type: "terrain_rock", role: "crate", x: 1410, y: 590, scale: 0.9 },

  // Crate cluster B (lower-right), leaves center lane open.
  { type: "terrain_pillar", role: "crate", x: 1620, y: 900, scale: 1.0 },
  { type: "terrain_rock", role: "crate", x: 1700, y: 960, scale: 0.9 },
  { type: "terrain_rock", role: "crate", x: 1540, y: 980, scale: 0.88 },
  { type: "terrain_rock", role: "crate", x: 1320, y: 980, scale: 0.85 },
  { type: "terrain_pillar", role: "crate", x: 1390, y: 1040, scale: 0.82 },

  // Cannons (port/left rail).
  { type: "terrain_pillar", role: "cannon", x: 270, y: 290, scale: 0.84 },
  { type: "terrain_pillar", role: "cannon", x: 270, y: 675, scale: 0.84 },
  { type: "terrain_pillar", role: "cannon", x: 270, y: 1060, scale: 0.84 },

  // Cannons (starboard/right rail).
  { type: "terrain_pillar", role: "cannon", x: 2130, y: 290, scale: 0.84 },
  { type: "terrain_pillar", role: "cannon", x: 2130, y: 675, scale: 0.84 },
  { type: "terrain_pillar", role: "cannon", x: 2130, y: 1060, scale: 0.84 }
];
const BOSS_ENTRY_LANES = Object.freeze([SPAWN_LANES.BOW, SPAWN_LANES.STERN]);
const HATCH_BREACH_POINT = Object.freeze({ x: 1200, y: 1090 });
const LADDER_SPAWN_POINTS = Object.freeze({
  [SPAWN_LANES.PORT]: Object.freeze([
    Object.freeze({ x: 76, y: 430 }),
    Object.freeze({ x: 76, y: 910 })
  ]),
  [SPAWN_LANES.STARBOARD]: Object.freeze([
    Object.freeze({ x: 2324, y: 430 }),
    Object.freeze({ x: 2324, y: 910 })
  ])
});
const XP_MAGNET_RADIUS_PER_LEVEL = 6;
const DECK_TILE_SIZE = 32;
const DECK_SURFACE_INSET = 34;
const DECK_RAIL_INSET = 12;
const DECK_RAIL_POST_GAP = 120;
const DECK_RAIL_POST_WIDTH = 8;
const DECK_RAIL_POST_LENGTH = 24;
const SEA_WAVE_MIN = 6;
const SEA_WAVE_MAX = 10;
const DECK_PASSAGE_SAMPLE_DISTANCES = Object.freeze([220, 340, 460]);
const DECK_PASSAGE_MIN_OPEN_DIRECTIONS = 2;
const DECK_PASSAGE_REPAIR_MAX_STEPS = 18;
const DECK_PASSAGE_REPAIR_NUDGE = 40;
const ENEMY_JAM_STUCK_WINDOW_MS = 900;
const ENEMY_JAM_MIN_PROGRESS_PX = 4;
const ENEMY_JAM_PUSH_FORCE = 150;
const ELITE_BONUS_XP_ORB_MIN = 2;
const ELITE_BONUS_XP_ORB_MAX = 4;
const ELITE_BONUS_XP_ORB_VALUE_FACTOR = 0.35;
const ELITE_UPGRADE_DROP_CHANCE = 0.28;
const ELITE_BONUS_UPGRADE_IDS = ["weapon_damage", "attack_speed", "movement_speed", "pickup_radius", "projectile_count"];
const MINI_BOSS_GOLD_BUNDLE = 12;
const MINI_BOSS_XP_BURST_COUNT = 8;
const MINI_BOSS_XP_BURST_MIN_FACTOR = 0.3;
const MINI_BOSS_XP_BURST_MAX_FACTOR = 0.45;
const PERFORMANCE_MAX_ACTIVE_ENEMIES = 80;
const EDGE_FOG_TEXTURE_KEY = "edge_fog_vignette";
const EDGE_FOG_INNER_RADIUS_TILES = 12;
const EDGE_FOG_OUTER_RADIUS_TILES = 14;
const PARTICLE_LOAD_SOFT_CAP_ENEMIES = 50;
const PARTICLE_LOAD_HARD_CAP_ENEMIES = PERFORMANCE_MAX_ACTIVE_ENEMIES;
const MIN_PARTICLE_LOAD_SCALE = 0.38;
const TOUCH_JOYSTICK_RADIUS = 68;
const TOUCH_JOYSTICK_TOUCH_RADIUS = 110;
const TOUCH_DASH_BUTTON_RADIUS = 58;
const PARTICLE_TEXTURE_KEY = "hit_particle";
const PARTICLE_FALLBACK_TEXTURE_KEY = "__WHITE";
const PARTICLE_GENERATED_FALLBACK_TEXTURE_KEY = "particle_fallback";
const BOSS_WARNING_LEAD_MS = 5000;
const META_COINS_STORAGE_KEY = "dashsurvivor_coins";
const META_STORAGE_KEY = "dashsurvivor_meta_v1";
const BEST_TIME_STORAGE_KEY = "dashsurvivor_best_time_ms";
const SHOP_UPGRADES_STORAGE_KEY = "dashsurvivor_shop_upgrades_v1";
const WEAPON_UNLOCK_STORAGE_KEY = "dashsurvivor_weapon_unlocks_v1";
const PLAYTEST_SPAWN_PACING_STORAGE_KEY = "dashsurvivor_playtest_spawn_pacing_v1";
const DEBUG_HUD_X = 16;
const DEBUG_HUD_Y = 116;
const OFFSCREEN_INDICATOR_INSET = 18;
const OFFSCREEN_INDICATOR_SIZE = 9;
const OFFSCREEN_INDICATOR_MAX = 12;
const OFFSCREEN_PRIORITY_BONUS_ELITE = 10000;
const OFFSCREEN_PRIORITY_BONUS_BOSS = 20000;
const COMBO_RESET_WINDOW_MS = 2000;
const COMBO_TEXT_SCALE = 1.3;
const COMBO_TEXT_FADE_TIME_MS = 800;
const HUD_PANEL_PADDING = 12;
const HUD_PANEL_X = 16;
const HUD_PANEL_Y = 16;
const HUD_PANEL_WIDTH = 324;
const HUD_PANEL_HEIGHT = 108;
const HUD_EXP_BAR_WIDTH = 200;
const HUD_EXP_BAR_BASE_HEIGHT = 8;
const HUD_EXP_BAR_START_COLOR = 0x3ec5ff;
const HUD_EXP_BAR_END_COLOR = 0x8fffd4;
const HUD_EXP_PULSE_SCALE = 1.3;
const HUD_EXP_PULSE_DURATION_MS = 120;
const HUD_ALERT_POOL_SIZE = 3;
const HUD_ALERT_STYLE = Object.freeze({
  fontFamily: "Arial",
  fontSize: "34px",
  color: "#ffd76c",
  stroke: "#2e1b08",
  strokeThickness: 6
});
const HUD_COMBO_STYLE = Object.freeze({
  fontFamily: "Arial",
  fontSize: "34px",
  color: "#fff0b6",
  stroke: "#2d1f08",
  strokeThickness: 6
});
const GAMEPLAY_CAMERA_ZOOM = 1.5;
const DECK_BRIGHTNESS_MULTIPLIER = 0.9;
const DECK_HIGHLIGHT_OPACITY = 0.6;
const EDGE_FOG_VIGNETTE_OPACITY = 0.35;
const DECK_TILE_VARIANTS = Object.freeze([
  Object.freeze({
    key: "deck_a",
    path: "assets/sprites/kenney/deck_plank_main.png",
    weight: 50,
    tintEven: 0xe8d8c6,
    tintOdd: 0xd8c0a7,
    tileOffsetStep: 19,
    fallbackEven: 0x6c4830,
    fallbackOdd: 0x755138
  }),
  Object.freeze({
    key: "deck_b",
    path: "assets/sprites/kenney/deck_plank_main.png",
    weight: 20,
    tintEven: 0xe2ceb6,
    tintOdd: 0xd4b394,
    tileOffsetStep: 23,
    fallbackEven: 0x67432d,
    fallbackOdd: 0x714d36
  }),
  Object.freeze({
    key: "deck_c",
    path: "assets/sprites/kenney/deck_plank_main.png",
    weight: 20,
    tintEven: 0xd8c4ac,
    tintOdd: 0xc8ac8c,
    tileOffsetStep: 17,
    fallbackEven: 0x623f2a,
    fallbackOdd: 0x6a4731
  }),
  Object.freeze({
    key: "deck_d",
    path: "assets/sprites/kenney/deck_plank_main.png",
    weight: 10,
    tintEven: 0xcfb798,
    tintOdd: 0xc29f7e,
    tileOffsetStep: 29,
    fallbackEven: 0x5e3c28,
    fallbackOdd: 0x66442f
  })
]);
const RANDOM_DECK_OBSTACLE_SPAWN_TABLE = Object.freeze([
  Object.freeze({
    objectType: "crate",
    type: "terrain_rock",
    textureKey: "terrain_crate",
    weight: 40,
    scaleMin: 0.72,
    scaleMax: 0.96,
    anchorRadius: 32
  }),
  Object.freeze({
    objectType: "barrel",
    type: "terrain_rock",
    textureKey: "terrain_rock",
    weight: 24,
    scaleMin: 0.54,
    scaleMax: 0.72,
    anchorRadius: 24,
    tint: 0x855d3f
  }),
  Object.freeze({
    objectType: "ropeBundle",
    type: "terrain_pillar",
    textureKey: "terrain_pillar",
    weight: 20,
    scaleMin: 0.52,
    scaleMax: 0.68,
    anchorRadius: 22,
    tint: 0xb39163
  }),
  Object.freeze({
    objectType: "deckVent",
    type: "terrain_pillar",
    textureKey: "terrain_pillar",
    weight: 16,
    scaleMin: 0.6,
    scaleMax: 0.78,
    anchorRadius: 24,
    tint: 0x6b7689
  })
]);
const RANDOM_DECK_OBSTACLE_DENSITY_MIN_TILES = 12;
const RANDOM_DECK_OBSTACLE_DENSITY_MAX_TILES = 18;
const RANDOM_DECK_OBSTACLE_TILE_GROUP_SIZE = DECK_TILE_SIZE * 3;
const RANDOM_DECK_OBSTACLE_EDGE_SPAWN_BUFFER = DECK_TILE_SIZE * 6;
const RANDOM_DECK_OBSTACLE_EVENT_CLEAR_RADIUS = DECK_TILE_SIZE * 4;
const RANDOM_DECK_OBSTACLE_MAX_ATTEMPTS_MULTIPLIER = 28;
const RANDOM_DECK_OBSTACLE_MIN_PADDING = 16;
const IMPORTED_PIXEL_ASSETS = Object.freeze({
  deckPlankMain: Object.freeze({
    key: "sprite_deck_plank_main",
    path: "assets/sprites/kenney/deck_plank_main.png"
  }),
  deckPlankTrim: Object.freeze({
    key: "sprite_deck_plank_trim",
    path: "assets/sprites/kenney/deck_plank_trim.png"
  }),
  player: Object.freeze({
    key: "sprite_player_crew",
    path: "assets/sprites/kenney/player_crew.png"
  }),
  cannon: Object.freeze({
    key: "sprite_terrain_cannon",
    path: "assets/sprites/kenney/terrain_cannon.png"
  }),
  deckHullLarge: Object.freeze({
    key: "sprite_deck_hull_large",
    path: "assets/sprites/kenney/deck_hull_large.png"
  }),
  deckCannonLoose: Object.freeze({
    key: "sprite_deck_cannon_loose",
    path: "assets/sprites/kenney/deck_cannon_loose.png"
  }),
  deckCannonBall: Object.freeze({
    key: "sprite_deck_cannonball",
    path: "assets/sprites/kenney/deck_cannonball.png"
  }),
  uiPanelBrown: Object.freeze({
    key: "sprite_ui_panel_brown",
    path: "assets/sprites/kenney/ui_panel_brown.png"
  }),
  uiPanelBrownInlay: Object.freeze({
    key: "sprite_ui_panel_brown_inlay",
    path: "assets/sprites/kenney/ui_panel_brown_inlay.png"
  }),
  uiPanelTanInlay: Object.freeze({
    key: "sprite_ui_panel_tan_inlay",
    path: "assets/sprites/kenney/ui_panel_tan_inlay.png"
  }),
  enemyChaserBody: Object.freeze({
    key: "sprite_enemy_chaser_body",
    path: "assets/sprites/kenney/enemy_chaser_body.png"
  }),
  enemyChaserEye: Object.freeze({
    key: "sprite_enemy_chaser_eye",
    path: "assets/sprites/kenney/enemy_chaser_eye.png"
  }),
  enemyChaserMouth: Object.freeze({
    key: "sprite_enemy_chaser_mouth",
    path: "assets/sprites/kenney/enemy_chaser_mouth.png"
  })
});
const BOSS_BULLET_MAX = 220;
const BOSS_BULLET_LIFETIME_MS = 2800;
const SFX_AUDIO_FILES = {
  dash: "assets/audio/dash.wav",
  enemy_hit: "assets/audio/enemy_hit.wav",
  enemy_death: "assets/audio/enemy_die.wav",
  level_up: "assets/audio/level_up.wav",
  boss_warning: "assets/audio/boss_warning.wav"
};
const SFX_KEY_BY_TYPE = {
  dash: "dash",
  enemy_hit: "enemy_hit",
  enemy_death: "enemy_death",
  level_up: "level_up",
  boss_warning: "boss_warning",
  weapon_fire: null
};
const SFX_VOLUME = {
  dash: 0.12,
  enemy_hit: 0.1,
  enemy_death: 0.12,
  level_up: 0.13,
  boss_warning: 0.13,
  weapon_fire: 0.08
};
const SFX_THROTTLE_MS = {
  enemy_hit: 42,
  enemy_death: 55,
  dash: 90,
  level_up: 220,
  boss_warning: 300,
  weapon_fire: 48
};
const CHARACTER_DIRECTION_NAMES = Object.freeze([
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west"
]);
const CHARACTER_ASSET_FOLDERS = Object.freeze([
  "player_pirate",
  "enemy_chaser",
  "enemy_swarm",
  "enemy_tank",
  "enemy_hunter"
]);
const START_WEAPON_OPTIONS = [
  {
    id: "dash_blade",
    label: "Dash Blade",
    weaponType: "dagger",
    unlockCost: 0,
    defaultUnlocked: true
  },
  {
    id: "pulse_dash",
    label: "Pulse Dash",
    weaponType: "fireball",
    unlockCost: 90,
    defaultUnlocked: false
  },
  {
    id: "orbit_blade",
    label: "Orbit Blade",
    weaponType: "orbit_blades",
    unlockCost: 180,
    defaultUnlocked: false
  },
  {
    id: "shockwave",
    label: "Shockwave",
    weaponType: "lightning",
    unlockCost: 140,
    defaultUnlocked: false
  }
];

const PIXEL_PLAYER_PATTERN = [
  "................",
  "......1111......",
  ".....122221.....",
  "....12222221....",
  "....12233221....",
  ".....144441.....",
  ".....455554.....",
  "....45666654....",
  "....45666654....",
  "....45666654....",
  ".....477774.....",
  ".....47..74.....",
  "....88....88....",
  "...88......88...",
  "...8........8...",
  "................"
];

const PIXEL_CHASER_PATTERN = [
  "................",
  "......1111......",
  "....11222211....",
  "...1222222221...",
  "...1223322331...",
  "..122222222221..",
  "..123222222321..",
  "..123222222321..",
  "..123222222321..",
  "..122222222221..",
  "...1222222221...",
  "...1122222211...",
  "....11111111....",
  ".....1....1.....",
  "................",
  "................"
];

function pickWeightedDeckVariant(variants, excludedKey = null) {
  const available = variants.filter((variant) => variant.key !== excludedKey);
  if (available.length === 0) {
    return variants[0];
  }

  const totalWeight = available.reduce((sum, variant) => sum + variant.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < available.length; i += 1) {
    roll -= available[i].weight;
    if (roll <= 0) {
      return available[i];
    }
  }
  return available[available.length - 1];
}

function scaleHexColor(hexColor, multiplier = 1) {
  const color = Number.isFinite(hexColor) ? hexColor : 0x000000;
  const factor = Phaser.Math.Clamp(Number(multiplier) || 1, 0, 2);
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  const nr = Phaser.Math.Clamp(r, 0, 255);
  const ng = Phaser.Math.Clamp(g, 0, 255);
  const nb = Phaser.Math.Clamp(b, 0, 255);
  return (nr << 16) | (ng << 8) | nb;
}

function pickWeightedRandomObstacleSpec(specs) {
  const totalWeight = specs.reduce((sum, spec) => sum + spec.weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < specs.length; i += 1) {
    roll -= specs[i].weight;
    if (roll <= 0) {
      return specs[i];
    }
  }
  return specs[specs.length - 1];
}

const PIXEL_SWARM_PATTERN = [
  "............",
  "....1111....",
  "...122221...",
  "..12233221..",
  "..12333321..",
  "..12333321..",
  "..12233221..",
  "...122221...",
  "....1111....",
  ".....11.....",
  "............",
  "............"
];

const PIXEL_TANK_PATTERN = [
  "................",
  "...1111111111...",
  "..122222222221..",
  "..123333333321..",
  "..123444444321..",
  "..123455554321..",
  "..123455554321..",
  "..123444444321..",
  "..123333333321..",
  "..123333333321..",
  "..122222222221..",
  "...1155555511...",
  "...15......51...",
  "..55........55..",
  "................",
  "................"
];

const PIXEL_HUNTER_PATTERN = [
  "................",
  ".......11.......",
  "......1221......",
  ".....123321.....",
  "....12333321....",
  "...1233333331...",
  "..123333333321..",
  ".12333333333321.",
  "..123333333321..",
  "...1233333331...",
  "....12333321....",
  ".....123321.....",
  "......1221......",
  ".......11.......",
  "................",
  "................"
];

const PIXEL_BOSS_PATTERN = [
  "........................",
  "........11111111........",
  "......112222222211......",
  "....1122233333222211....",
  "...1222333333333333221...",
  "..122333344444444333322..",
  "..123333455555555433332..",
  ".12333445566666554433321.",
  ".12333455667766554433321.",
  ".12333455667766554433321.",
  ".12333445566666554433321.",
  "..123333455555555433332..",
  "..122333344444444333322..",
  "...1222333333333333221...",
  "....1122233333222211....",
  "......112222222211......",
  "........11111111........",
  ".......11......11.......",
  "......11........11......",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................"
];

const PIXEL_CRATE_PATTERN = [
  "................",
  ".11111111111111.",
  ".12222223222221.",
  ".12444423244421.",
  ".12444423244421.",
  ".12444423244421.",
  ".12222223222221.",
  ".13333334333331.",
  ".12222223222221.",
  ".12444423244421.",
  ".12444423244421.",
  ".12444423244421.",
  ".12222223222221.",
  ".11111111111111.",
  "................",
  "................"
];

const PIXEL_CANNON_PATTERN = [
  "................",
  "................",
  "......1111......",
  "....11222211....",
  "...1122222211...",
  "..112222222211..",
  "..133333333331..",
  "..133333333331..",
  "...444.. ..444..",
  "..14441..14441..",
  "..144441144441..",
  "...1444444441...",
  "....11111111....",
  "................",
  "................",
  "................"
];

const PIXEL_MAST_PATTERN = [
  "................",
  ".....111111.....",
  "...1122222211...",
  "..122222222221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122223322221..",
  "..122222222221..",
  "...1122222211...",
  ".....111111.....",
  "................"
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.safeRadius = SAFE_RADIUS;
    this.baseSpawnCheckIntervalMs = BASE_SPAWN_CHECK_INTERVAL_MS;
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.runStartTimeMs = 0;
    this.hudElapsedSeconds = -1;
    this.targetEnemies = 0;

    this.attackIntervalMs = 800;
    this.attackRange = 120;
    this.attackDamage = 10;
    this.lastAttackAt = 0;
    this.totalXp = 0;
    this.level = 1;
    this.currentXp = 0;
    this.xpToNext = 50;
    this.pendingLevelUps = 0;
    this.isLeveling = false;
    this.levelUpUi = [];
    this.isGameOver = false;
    this.damageEmitter = null;
    this.killEmitter = null;
    this.eliteKillEmitter = null;
    this.evolutionEmitter = null;
    this.dashTrailEmitter = null;
    this.dashParticles = null;
    this.dashTrailTickMs = 0;
    this.evolutionSlowMoRestoreHandle = null;
    this.evolutionSlowMoActive = false;
    this.weaponRecoilTween = null;
    this.metaSystem = new MetaProgressionSystem();
    this.metaData = this.metaSystem.getData();
    this.metaXpMultiplier = 1;
    this.runMetaCurrency = 0;
    this.lastRunMetaCurrency = 0;
    this.metaSettled = false;
    this.enemyPool = null;
    this.obstacles = null;
    this.terrainObstacleAnchors = [];
    this.gameOverRestartButton = null;
    this.gameOverRestartLabel = null;
    this.hudBarsGraphics = null;
    this.enemyHealthBarsGraphics = null;
    this.dashCooldownRingGraphics = null;
    this.playerReadabilityGraphics = null;
    this.lowHealthVignetteGraphics = null;
    this.edgeFogOverlay = null;
    this.edgeFogRebuildState = { width: 0, height: 0, zoom: 0 };
    this.hudLevelText = null;
    this.hudStatsText = null;
    this.hudTimerText = null;
    this.hudGoldText = null;
    this.hudDashStatusText = null;
    this.hudSecondaryText = null;
    this.hudCoreLabelText = null;
    this.hudSecondaryLabelText = null;
    this.hudWeaponSlotFrames = [];
    this.hudWeaponSlotLabels = [];
    this.hud = null;
    this.hpText = null;
    this.expText = null;
    this.timeText = null;
    this.killText = null;
    this.expBarBg = null;
    this.expBarFill = null;
    this.debugDirectorText = null;
    this.debugOverlayPanel = null;
    this.debugOverlayEnabled = false;
    this.cameraFollowEnabled = true;
    this.spawnPacingPresetKey = PLAYTEST_SPAWN_PACING_DEFAULT;
    this.spawnPacingPreset = PLAYTEST_SPAWN_PACING_PRESETS[PLAYTEST_SPAWN_PACING_DEFAULT];
    this.offscreenIndicatorGraphics = null;
    this.damageNumberPool = [];
    this.hudAlertPool = [];
    this.offscreenIndicatorPool = [];
    this.killCombo = 0;
    this.lastKillAtMs = Number.NEGATIVE_INFINITY;
    this.maxKillCombo = 0;
    this.totalKills = 0;
    this.killCounterPulseTween = null;
    this.xpDisplayRatio = 0;
    this.expBarScaleY = 1;
    this.expBarPulseTween = null;
    this.weaponRecoilTween = null;
    this.bossApproachWarnedCycleIndex = 0;
    this.levelUpOptionActions = [];
    this.sfxLastPlayedAt = {};
    this.touchControlsEnabled = false;
    this.touchMovePointerId = null;
    this.touchMoveVector = new Phaser.Math.Vector2(0, 0);
    this.touchDashQueued = false;
    this.touchJoystickCenter = new Phaser.Math.Vector2(0, 0);
    this.touchJoystickBase = null;
    this.touchJoystickThumb = null;
    this.touchDashButton = null;
    this.touchDashLabel = null;
    this.onTouchPointerDown = null;
    this.onTouchPointerMove = null;
    this.onTouchPointerUp = null;
    this.helpOverlayCompact = false;
    this.isWeaponSelecting = false;
    this.weaponSelectionUi = [];
    this.weaponSelectionActions = [];
    this.weaponUnlocks = {};
    this.selectedStartWeaponId = null;
    this.bossProjectiles = null;
    this.performanceDamageEvents = [];
    this.performanceKillEvents = [];
    this.performanceDamageTotal = 0;
    this.performanceKillTotal = 0;
    this.seaWaveGraphics = null;
    this.seaWaves = [];
    this.devAntiJamEnabled = false;
  }

  create() {
    this.isGameOver = false;
    this.totalXp = 0;
    this.level = 1;
    this.currentXp = 0;
    this.xpToNext = this.getXpRequirement(this.level);
    this.pendingLevelUps = 0;
    this.isLeveling = false;
    this.levelUpUi = [];
    this.spawnAccumulatorMs = 0;
    this.runTimeMs = 0;
    this.runStartTimeMs = this.time?.now ?? 0;
    this.hudElapsedSeconds = -1;
    this.targetEnemies = 0;
    this.hudAlertPool = [];
    this.killCombo = 0;
    this.lastKillAtMs = Number.NEGATIVE_INFINITY;
    this.maxKillCombo = 0;
    this.totalKills = 0;
    this.killCounterPulseTween = null;
    this.xpDisplayRatio = 0;
    this.expBarScaleY = 1;
    this.expBarPulseTween = null;
    this.bossApproachWarnedCycleIndex = 0;
    this.metaData = this.metaSystem.getData();
    this.syncCoinStorageWithMeta();
    this.metaXpMultiplier = 1;
    this.runMetaCurrency = 0;
    this.lastRunMetaCurrency = 0;
    this.metaSettled = false;
    this.director = new DirectorSystem();
    this.dashTrailTickMs = 0;
    this.sfxLastPlayedAt = {};
    this.clearEvolutionSlowMoTimer();
    this.teardownTouchControls();
    this.touchControlsEnabled = false;
    this.touchMovePointerId = null;
    this.touchMoveVector.set(0, 0);
    this.touchDashQueued = false;
    this.isWeaponSelecting = false;
    this.weaponSelectionUi = [];
    this.weaponSelectionActions = [];
    this.weaponUnlocks = this.loadWeaponUnlocks();
    this.selectedStartWeaponId = null;
    this.debugOverlayEnabled = false;
    this.cameraFollowEnabled = true;
    this.spawnPacingPresetKey = this.loadSpawnPacingPresetKey();
    this.spawnPacingPreset =
      PLAYTEST_SPAWN_PACING_PRESETS[this.spawnPacingPresetKey] ?? PLAYTEST_SPAWN_PACING_PRESETS[PLAYTEST_SPAWN_PACING_DEFAULT];
    this.baseSpawnCheckIntervalMs = Math.max(
      60,
      BASE_SPAWN_CHECK_INTERVAL_MS * (this.spawnPacingPreset?.spawnIntervalScale ?? 1)
    );
    this.performanceDamageEvents = [];
    this.performanceKillEvents = [];
    this.performanceDamageTotal = 0;
    this.performanceKillTotal = 0;
    this.helpOverlayCompact = false;
    this.devAntiJamEnabled = this.resolveDevAntiJamEnabled();

    this.createTextures();
    this.drawArena();

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.player = new Player(this, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    this.player.level = this.level;
    this.enemies = this.add.group();
    this.enemyPool = new ObjectPool(this, this.enemies, { initialSize: ENEMY_POOL_SIZE });
    this.xpOrbs = this.physics.add.group();
    this.obstacles = this.physics.add.staticGroup();
    this.createTerrainObstacles();

    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      debugToggle: Phaser.Input.Keyboard.KeyCodes.F2,
      pacingPreset: Phaser.Input.Keyboard.KeyCodes.F3,
      cameraToggle: Phaser.Input.Keyboard.KeyCodes.F4,
      meta1: Phaser.Input.Keyboard.KeyCodes.ONE,
      meta2: Phaser.Input.Keyboard.KeyCodes.TWO,
      meta3: Phaser.Input.Keyboard.KeyCodes.THREE,
      meta4: Phaser.Input.Keyboard.KeyCodes.FOUR
    });
    const desiredPointers = 3;
    const pointerDeficit = desiredPointers - this.input.manager.pointersTotal;
    if (pointerDeficit > 0) {
      this.input.addPointer(pointerDeficit);
    }

    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
    this.physics.add.overlap(this.player, this.xpOrbs, this.handleXpOrbPickup, null, this);
    this.bossProjectiles = this.physics.add.group({
      allowGravity: false,
      immovable: true,
      maxSize: BOSS_BULLET_MAX
    });
    this.physics.add.overlap(this.player, this.bossProjectiles, this.handleBossProjectileHit, null, this);
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.weaponSystem = new WeaponSystem(this, this.player);
    this.applyMetaBonusesForRun();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setZoom(GAMEPLAY_CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.hudLevelText = this.add
      .text(20, 24, "", {
        fontFamily: "Arial",
        fontSize: "21px",
        color: "#fff0cf",
        stroke: "#28170f",
        strokeThickness: 4
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.hudStatsText = this.add
      .text(20, 58, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#cdb28a",
        stroke: "#28170f",
        strokeThickness: 2
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.hudTimerText = this.add
      .text(20, 74, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#f0dfbe",
        stroke: "#28170f",
        strokeThickness: 3
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.hudGoldText = this.add
      .text(20, 90, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#e6cc86",
        stroke: "#28170f",
        strokeThickness: 3
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.hudXpLabelText = this.add
      .text(20, 44, "EXP", {
        fontFamily: "Arial",
        fontSize: "9px",
        color: "#e7d6b4",
        stroke: "#28170f",
        strokeThickness: 2
      })
      .setScrollFactor(0)
      .setDepth(10);
    this.hudSecondaryText = this.add
      .text(1032, 22, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ddc69e",
        stroke: "#28170f",
        strokeThickness: 3,
        align: "left"
      })
      .setLineSpacing(4)
      .setScrollFactor(0)
      .setDepth(10);
    if (this.textures.exists(IMPORTED_PIXEL_ASSETS.uiPanelBrown.key)) {
      this.hudPanelBack = this.add
        .image(HUD_PANEL_X + HUD_PANEL_WIDTH * 0.5, HUD_PANEL_Y + HUD_PANEL_HEIGHT * 0.5, IMPORTED_PIXEL_ASSETS.uiPanelBrown.key)
        .setOrigin(0.5)
        .setDisplaySize(HUD_PANEL_WIDTH, HUD_PANEL_HEIGHT)
        .setScrollFactor(0)
        .setDepth(8)
        .setTint(0x8e5b33)
        .setAlpha(0.92);
      this.hudSecondaryPanel = this.add
        .image(1142, 44, IMPORTED_PIXEL_ASSETS.uiPanelBrown.key)
        .setOrigin(0.5)
        .setDisplaySize(228, 78)
        .setScrollFactor(0)
        .setDepth(8)
        .setTint(0x7e532f);
    }
    if (this.textures.exists(IMPORTED_PIXEL_ASSETS.uiPanelTanInlay.key)) {
      this.hudXpFrame = this.add
        .image(162, 47, IMPORTED_PIXEL_ASSETS.uiPanelTanInlay.key)
        .setOrigin(0.5)
        .setDisplaySize(284, 10)
        .setScrollFactor(0)
        .setDepth(8.8)
        .setTint(0xd2b07e)
        .setAlpha(0.9);
    }
    if (this.textures.exists(IMPORTED_PIXEL_ASSETS.uiPanelBrownInlay.key)) {
      this.hudHeaderChip = this.add
        .image(76, 18, IMPORTED_PIXEL_ASSETS.uiPanelBrownInlay.key)
        .setOrigin(0.5)
        .setDisplaySize(120, 18)
        .setScrollFactor(0)
        .setDepth(8.9)
        .setTint(0xc19a67);
      this.hudSecondaryChip = this.add
        .image(1104, 18, IMPORTED_PIXEL_ASSETS.uiPanelBrownInlay.key)
        .setOrigin(0.5)
        .setDisplaySize(100, 18)
        .setScrollFactor(0)
        .setDepth(8.9)
        .setTint(0xb48855);
    }
    this.hudCoreLabelText = this.add
      .text(76, 18, "SURVIVAL LOG", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#2e170d"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
    this.hudSecondaryLabelText = this.add
      .text(1104, 18, "CREW KIT", {
        fontFamily: "Arial",
        fontSize: "11px",
        color: "#2e170d"
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
    this.hudBarsGraphics = this.add.graphics().setScrollFactor(0).setDepth(9);
    this.enemyHealthBarsGraphics = this.add.graphics().setDepth(8.6);
    const weaponSlotCount = Math.max(1, this.player?.maxWeaponSlots ?? 3);
    const slotGap = 44;
    const slotStartX = 640 - ((weaponSlotCount - 1) * slotGap) / 2;
    const slotY = 22;
    this.hudWeaponSlotFrames = [];
    this.hudWeaponSlotLabels = [];
    for (let i = 0; i < weaponSlotCount; i += 1) {
      const slotX = Math.round(slotStartX + i * slotGap);
      const frame = this.add
        .rectangle(slotX, slotY, 34, 34, 0x2f1b12, 0.8)
        .setStrokeStyle(2, 0x6d4a31, 0.8)
        .setScrollFactor(0)
        .setDepth(10);
      const label = this.add
        .text(slotX, slotY, "", {
          fontFamily: "Arial",
          fontSize: "15px",
          color: "#f4e5c8",
          stroke: "#2a170f",
          strokeThickness: 3
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(11);
      this.hudWeaponSlotFrames.push(frame);
      this.hudWeaponSlotLabels.push(label);
    }
    this.playerReadabilityGraphics = this.add.graphics().setDepth(5);
    this.lowHealthVignetteGraphics = this.add.graphics().setScrollFactor(0).setDepth(21);
    this.createEdgeFogOverlay();
    this.dashCooldownRingGraphics = this.add.graphics().setDepth(9);
    this.offscreenIndicatorGraphics = this.add.graphics().setScrollFactor(0).setDepth(19);
    this.modalBackdrop = this.add
      .rectangle(640, 360, 1280, 720, 0x05080d, 0.28)
      .setScrollFactor(0)
      .setDepth(24)
      .setVisible(false);
    this.damageNumberPool = [];
    this.offscreenIndicatorPool = [];
    this.debugOverlayPanel = this.add
      .rectangle(1260, 98, 252, 116, 0x19110b, 0.56)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x6d4a31, 0.56)
      .setScrollFactor(0)
      .setDepth(18)
      .setVisible(false);
    this.debugDirectorText = this.add
      .text(1024, 108, "", {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#baa27d",
        stroke: "#22150d",
        strokeThickness: 3
      })
      .setScrollFactor(0)
      .setDepth(19);
    this.debugDirectorText.setVisible(this.debugOverlayEnabled);
    this.createGameplayHUD();
    this.createHudAlertPool();
    this.applyHudModalFocus(false);

    this.gameOverText = this.add
      .text(640, 360, "GAME OVER", {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#ffdad7",
        align: "center",
        stroke: "#1a1010",
        strokeThickness: 6
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(12)
      .setVisible(false);

    this.gameOverRestartButton = this.add
      .rectangle(640, 540, 240, 58, 0x17304f, 0.95)
      .setStrokeStyle(2, 0x66b9ff, 1)
      .setScrollFactor(0)
      .setDepth(13)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.gameOverRestartLabel = this.add
      .text(640, 540, "Restart Run", {
        fontFamily: "Arial",
        fontSize: "26px",
        color: "#eaf6ff",
        stroke: "#0d1628",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(14)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    const onRestartPointer = () => this.restartRun();
    this.gameOverRestartButton.on("pointerdown", onRestartPointer);
    this.gameOverRestartLabel.on("pointerdown", onRestartPointer);

    this.createTouchControls();
    this.registerSceneShutdownCleanup();
    this.openWeaponSelection();
    this.maintainEnemyDensity();
    this.updateHud();
  }

  preload() {
    Object.entries(SFX_AUDIO_FILES).forEach(([key, path]) => {
      if (this.cache?.audio?.exists(key)) {
        return;
      }
      this.load.audio(key, path);
    });
    CHARACTER_ASSET_FOLDERS.forEach((folder) => {
      CHARACTER_DIRECTION_NAMES.forEach((direction) => {
        const dirKey = direction.replace(/-/g, "_");
        const textureKey = `char_${folder}_${dirKey}`;
        if (this.textures?.exists(textureKey)) {
          return;
        }
        this.load.image(textureKey, `assets/sprites/characters/${folder}/rotations/${direction}.png`);
      });
    });
    DECK_TILE_VARIANTS.forEach(({ key, path }) => {
      if (this.textures?.exists(key)) {
        return;
      }
      this.load.image(key, path);
    });
    Object.values(IMPORTED_PIXEL_ASSETS).forEach(({ key, path }) => {
      if (this.textures?.exists(key)) {
        return;
      }
      this.load.image(key, path);
    });
  }

  update(time, delta) {
    const isRunSummaryOpen = this.scene.isActive("RunSummaryScene");
    if (isRunSummaryOpen) {
      if (this.input?.enabled) {
        this.input.enabled = false;
      }
      return;
    }
    if (this.input && !this.input.enabled) {
      this.input.enabled = true;
    }

    this.updateHelpOverlayPresentation();
    this.updateSeaWaves(time);
    this.handlePlaytestHotkeys();
    this.updateEdgeFogOverlay();

    if (this.isGameOver) {
      this.updateBossProjectiles(time);
      this.updateEnemyHealthBars();
      this.updateLowHealthVignette();
      this.updateDashCooldownRing();
      this.updateOffscreenEnemyIndicators();
      this.updateDebugDirectorOverlay();
      this.handleGameOverInput();
      return;
    }

    if (this.isLeveling) {
      this.handleLevelUpInput();
      this.updateBossProjectiles(time);
      this.player.body?.setVelocity(0, 0);
      this.updateEnemyHealthBars();
      this.updateLowHealthVignette();
      this.updateDashCooldownRing();
      this.updateOffscreenEnemyIndicators();
      this.updateDebugDirectorOverlay();
      this.updateHud();
      return;
    }

    if (this.isWeaponSelecting) {
      this.handleWeaponSelectionInput();
      this.updateBossProjectiles(time);
      this.player.body?.setVelocity(0, 0);
      this.updateEnemyHealthBars();
      this.updateLowHealthVignette();
      this.updateDashCooldownRing();
      this.updateOffscreenEnemyIndicators();
      this.updateDebugDirectorOverlay();
      this.updateHud();
      return;
    }

    const stateChanged = this.director.update(delta);
    if (stateChanged && this.director.getState() === DIRECTOR_STATE.PEAK) {
      this.cameras.main.shake(180, 0.0028);
    }

    this.runTimeMs += delta;
    if ((this.time?.now ?? 0) - this.lastKillAtMs > COMBO_RESET_WINDOW_MS) {
      this.killCombo = 0;
    }
    this.updateBossApproachWarning();
    this.spawnAccumulatorMs += delta;
    this.processDirectorBossSpawns();
    this.processDirectorMiniBossSpawns();
    this.processDirectorSpawnBursts();
    this.processDirectorLadderSpawns();
    this.processDirectorHatchBreaches();

    const spawnRateMultiplier = this.getEffectiveSpawnRateMultiplier();
    const effectiveSpawnIntervalMs = this.baseSpawnCheckIntervalMs / Math.max(0.2, spawnRateMultiplier);
    while (this.spawnAccumulatorMs >= effectiveSpawnIntervalMs) {
      this.spawnAccumulatorMs -= effectiveSpawnIntervalMs;
      this.maintainEnemyDensity();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.dash) || this.consumeTouchDash()) {
      this.player.tryDash();
    }

    this.player.updateDash(delta);
    this.updateBossProjectiles(time);
    this.emitDashTrail(delta);
    this.player.moveFromInput(this.keys, this.getTouchMoveInput());
    this.updatePlayerReadabilityAura();
    this.pullXpOrbsToPlayer();
    this.weaponSystem.update(time, delta);
    this.performAutoAttack(time);

    const speedMultiplier = this.getEffectiveEnemySpeedMultiplier();
    const damageMultiplier = this.director.getEnemyDamageMultiplier();
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }
      enemy.speed = enemy.baseSpeed * speedMultiplier;
      enemy.damage = Math.max(1, Math.round(enemy.baseDamage * damageMultiplier));
      enemy.chase(this.player, delta, time);
      enemy.tryApplyPoisonAura(this.player, time);
      if (enemy.updateBossPattern) {
        enemy.updateBossPattern(this.player, time);
      }
      this.applyEnemyAntiJam(enemy, time);
    });

    if (this.player.isDead()) {
      this.triggerGameOver();
      return;
    }

    this.updateEnemyHealthBars();
    this.updateLowHealthVignette();
    this.updateDashCooldownRing();
    this.updateOffscreenEnemyIndicators();
    this.updateDebugDirectorOverlay();
    this.updateHud();
  }

  createTextures() {
    this.generatePixelTexture("player_triangle", 2, PIXEL_PLAYER_PATTERN, {
      "1": 0xf6f2c8,
      "2": 0x183254,
      "3": 0x7fe8ff,
      "4": 0x2d6f9b,
      "5": 0xe7b96b,
      "6": 0x54dafe,
      "7": 0x1f7fa5,
      "8": 0x98eeff
    }, { shadowColor: 0x071120, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("enemy_swarm", 2, PIXEL_SWARM_PATTERN, {
      "1": 0x7c2748,
      "2": 0xff8a9c,
      "3": 0xffd3de
    }, { shadowColor: 0x1f1020, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("enemy_tank", 2, PIXEL_TANK_PATTERN, {
      "1": 0x24344e,
      "2": 0x3f5f8d,
      "3": 0x5c89ff,
      "4": 0xaac4ff,
      "5": 0xcfdcff
    }, { shadowColor: 0x071120, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("enemy_hunter", 2, PIXEL_HUNTER_PATTERN, {
      "1": 0x14404b,
      "2": 0x1b6d84,
      "3": 0x54e1ff
    }, { shadowColor: 0x071120, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("enemy_chaser", 2, PIXEL_CHASER_PATTERN, {
      "1": 0x74242a,
      "2": 0xff6d6d,
      "3": 0xffd2d2
    }, { shadowColor: 0x2a1010, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generateCompositeTexture("sprite_enemy_chaser_free", 28, 28, [
      { sourceKey: IMPORTED_PIXEL_ASSETS.enemyChaserBody.key, x: 2, y: 2, width: 24, height: 24 },
      { sourceKey: IMPORTED_PIXEL_ASSETS.enemyChaserEye.key, x: 9, y: 8, width: 10, height: 9 },
      { sourceKey: IMPORTED_PIXEL_ASSETS.enemyChaserMouth.key, x: 8, y: 17, width: 12, height: 5 }
    ]);
    this.generatePixelTexture("enemy_boss", 2, PIXEL_BOSS_PATTERN, {
      "1": 0x24103f,
      "2": 0x4a1e73,
      "3": 0x6d34ff,
      "4": 0xa57cff,
      "5": 0xd3c1ff,
      "6": 0xff8ba7,
      "7": 0xffd4de
    }, { shadowColor: 0x090512, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("terrain_crate", 2, PIXEL_CRATE_PATTERN, {
      "1": 0x3a2417,
      "2": 0x7e5234,
      "3": 0x5f3d28,
      "4": 0xb6804f
    }, { shadowColor: 0x24160f, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("terrain_cannon", 2, PIXEL_CANNON_PATTERN, {
      "1": 0x2b1c14,
      "2": 0x4b5568,
      "3": 0x7d8798,
      "4": 0x8d643f
    }, { shadowColor: 0x071120, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePixelTexture("terrain_mast", 2, PIXEL_MAST_PATTERN, {
      "1": 0x3d2619,
      "2": 0x71472c,
      "3": 0xa97a4d
    }, { shadowColor: 0x24160f, shadowOffsetX: 1, shadowOffsetY: 1 });
    this.generatePolygonTexture("terrain_rock", 28, [
      { x: 10, y: 12 },
      { x: 20, y: 6 },
      { x: 37, y: 8 },
      { x: 46, y: 19 },
      { x: 45, y: 36 },
      { x: 33, y: 47 },
      { x: 17, y: 48 },
      { x: 8, y: 36 },
      { x: 6, y: 23 }
    ], 0x6f7d90, 0x374356);
    this.generatePolygonTexture("terrain_pillar", 28, [
      { x: 14, y: 7 },
      { x: 42, y: 7 },
      { x: 47, y: 16 },
      { x: 47, y: 40 },
      { x: 42, y: 49 },
      { x: 14, y: 49 },
      { x: 9, y: 40 },
      { x: 9, y: 16 }
    ], 0x8a8f9f, 0x4f5568);
    this.generatePolygonTexture("upgrade_orb", 10, [
      { x: 10, y: 2 },
      { x: 18, y: 10 },
      { x: 10, y: 18 },
      { x: 2, y: 10 }
    ], 0xfff2a0, 0xb8831e);
    this.generateCircleTexture("xp_orb", 6, 0x66f5b2, 0x1f8d63);
    this.generateCircleTexture("proj_dagger", 4, 0xeef7ff, 0x7895af);
    this.generateCircleTexture("proj_fireball", 8, 0xff944d, 0xa84d1b);
    this.generateCircleTexture("proj_meteor", 11, 0xff8b44, 0x70220d);
    this.generateCircleTexture("proj_orbit_blade", 7, 0xc6e5ff, 0x5884ad);
    this.generateCircleTexture("boss_bullet", 5, 0xff8b8b, 0x7b1a1a);
    this.generateCircleTexture("hit_particle", 2, 0xffffff, 0xffffff);
  }

  createDamageEmitter() {
    if (this.damageEmitter) {
      this.damageEmitter.destroy();
    }
    if (this.killEmitter) {
      this.killEmitter.destroy();
    }
    if (this.eliteKillEmitter) {
      this.eliteKillEmitter.destroy();
    }
    if (this.evolutionEmitter) {
      this.evolutionEmitter.destroy();
    }
    if (this.dashTrailEmitter) {
      this.dashTrailEmitter.destroy();
    }

    const particleTextureKey = this.getSafeParticleTextureKey();
    this.damageEmitter = this.add.particles(0, 0, particleTextureKey, {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 45, max: 180 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 90, max: 220 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xffd6ad, 0xffb87f],
      blendMode: "ADD"
    });
    this.damageEmitter.setDepth(9);

    this.killEmitter = this.add.particles(0, 0, particleTextureKey, {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 80, max: 240 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 140, max: 320 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffffff, 0xffd8a8, 0xff9b7a],
      blendMode: "ADD"
    });
    this.killEmitter.setDepth(10);

    this.eliteKillEmitter = this.add.particles(0, 0, particleTextureKey, {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 120, max: 300 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 180, max: 360 },
      scale: { start: 1.35, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xa5f3ff, 0xc8a8ff],
      blendMode: "ADD"
    });
    this.eliteKillEmitter.setDepth(11);

    this.evolutionEmitter = this.add.particles(0, 0, particleTextureKey, {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 140, max: 360 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 160, max: 420 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xfff0a6, 0xa5f1ff, 0xcbb2ff],
      blendMode: "ADD"
    });
    this.evolutionEmitter.setDepth(12);

    this.dashTrailEmitter = this.add.particles(0, 0, particleTextureKey, {
      emitting: false,
      quantity: 0,
      frequency: -1,
      speed: { min: 12, max: 70 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 70, max: 140 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [0xfff3b3, 0xb8f0ff, 0x79d7ff],
      blendMode: "ADD"
    });
    this.dashTrailEmitter.setDepth(8);
    this.dashParticles = this.dashTrailEmitter;
  }

  getSafeParticleTextureKey() {
    if (this.textures.exists(PARTICLE_TEXTURE_KEY)) {
      return PARTICLE_TEXTURE_KEY;
    }
    if (this.textures.exists(PARTICLE_FALLBACK_TEXTURE_KEY)) {
      return PARTICLE_FALLBACK_TEXTURE_KEY;
    }
    this.generateCircleTexture(PARTICLE_GENERATED_FALLBACK_TEXTURE_KEY, 2, 0xffffff, 0xffffff);
    return PARTICLE_GENERATED_FALLBACK_TEXTURE_KEY;
  }

  isEmitterReady(emitter) {
    if (!emitter || !emitter.active || !emitter.texture) {
      return false;
    }
    const textureKey = emitter.texture.key;
    return typeof textureKey === "string" && this.textures.exists(textureKey);
  }

  ensureParticleEmitters() {
    if (
      this.isEmitterReady(this.damageEmitter) &&
      this.isEmitterReady(this.killEmitter) &&
      this.isEmitterReady(this.eliteKillEmitter) &&
      this.isEmitterReady(this.evolutionEmitter) &&
      this.isEmitterReady(this.dashTrailEmitter)
    ) {
      return true;
    }

    this.createDamageEmitter();
    return (
      this.isEmitterReady(this.damageEmitter) &&
      this.isEmitterReady(this.killEmitter) &&
      this.isEmitterReady(this.eliteKillEmitter) &&
      this.isEmitterReady(this.evolutionEmitter) &&
      this.isEmitterReady(this.dashTrailEmitter)
    );
  }

  spawnDamageParticles(x, y, count = 5) {
    if (!this.ensureParticleEmitters()) {
      return;
    }
    const scaledCount = this.getScaledParticleCount(count, 2);
    this.damageEmitter.explode(Math.max(2, Math.min(12, scaledCount)), x, y);
  }

  spawnHitSparkParticles(x, y, count = 3) {
    if (!this.ensureParticleEmitters()) {
      return;
    }
    const sparkCount = Math.max(1, Math.min(6, Math.round(Number(count) || 3)));
    this.damageEmitter.explode(sparkCount, x, y);
  }

  spawnKillParticles(x, y, count = 10) {
    if (!this.ensureParticleEmitters()) {
      return;
    }
    const scaledCount = this.getScaledParticleCount(count, 4);
    this.killEmitter.explode(Math.max(4, Math.min(20, scaledCount)), x, y);
  }

  spawnEliteKillParticles(x, y, count = 18) {
    if (!this.ensureParticleEmitters()) {
      return;
    }
    const scaledCount = this.getScaledParticleCount(count, 8);
    this.eliteKillEmitter.explode(Math.max(8, Math.min(28, scaledCount)), x, y);
  }

  playWeaponEvolutionFeedback(weapon) {
    this.ensureParticleEmitters();
    const flashDurationMs = 170;
    const slowScale = 0.26;
    const slowDurationMs = 180;

    if (this.cameras?.main) {
      this.cameras.main.flash(flashDurationMs, 255, 246, 197, true);
      this.cameras.main.shake(110, 0.0019);
    }

    if (this.evolutionEmitter && this.player && this.player.active) {
      this.evolutionEmitter.explode(this.getScaledParticleCount(36, 14), this.player.x, this.player.y);
    }

    if (!this.time || !this.tweens || !this.physics?.world) {
      return;
    }

    this.clearEvolutionSlowMoTimer();

    const previousTimeScale = this.time.timeScale;
    const previousTweenScale = this.tweens.timeScale;
    const previousPhysicsScale = this.physics.world.timeScale;
    this.time.timeScale = slowScale;
    this.tweens.timeScale = slowScale;
    this.physics.world.timeScale = slowScale;
    this.evolutionSlowMoActive = true;

    this.evolutionSlowMoRestoreHandle = setTimeout(() => {
      this.evolutionSlowMoRestoreHandle = null;
      if (!this.sys || !this.sys.isActive()) {
        return;
      }
      this.time.timeScale = previousTimeScale;
      this.tweens.timeScale = previousTweenScale;
      this.physics.world.timeScale = previousPhysicsScale;
      this.evolutionSlowMoActive = false;
    }, slowDurationMs);

    if (this.showHudAlert && weapon?.baseType) {
      this.showHudAlert(`${weapon.baseType.toUpperCase()} POWER SPIKE`, 1000);
    }
  }

  playWeaponFireFeedback(x, y, weaponType = "") {
    if (!this.add || !this.tweens) {
      return;
    }

    const flash = this.add.circle(x, y, 10, 0xfff1bf, 0.7).setDepth(8.4).setScale(1);
    this.tweens.add({
      targets: flash,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 80,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy()
    });

    if (this.player?.active) {
      const baseScaleX = this.player.getData("weaponRecoilBaseScaleX") ?? this.player.scaleX;
      const baseScaleY = this.player.getData("weaponRecoilBaseScaleY") ?? this.player.scaleY;
      this.player.setData("weaponRecoilBaseScaleX", baseScaleX);
      this.player.setData("weaponRecoilBaseScaleY", baseScaleY);

      if (this.weaponRecoilTween) {
        this.weaponRecoilTween.stop();
        this.weaponRecoilTween = null;
      }

      this.player.setScale(baseScaleX, baseScaleY);
      this.weaponRecoilTween = this.tweens.add({
        targets: this.player,
        scaleX: baseScaleX * 1.05,
        scaleY: baseScaleY * 1.05,
        duration: 40,
        ease: "Sine.easeOut",
        yoyo: true,
        onComplete: () => {
          if (this.player?.active) {
            this.player.setScale(baseScaleX, baseScaleY);
          }
          this.weaponRecoilTween = null;
        }
      });
    }

    this.cameras?.main?.shake(60, 0.0008, true);
    this.playSfx("weapon_fire", { weaponType });
  }

  emitDashTrail(delta) {
    if (!this.ensureParticleEmitters() || !this.player || !this.player.active || !this.player.isDashing()) {
      this.dashTrailTickMs = 0;
      return;
    }

    const particleScale = this.getParticleLoadScale();
    this.dashTrailTickMs += delta;
    const spacingMs = Phaser.Math.Linear(34, 58, 1 - particleScale);
    const trailCount = this.getScaledParticleCount(2, 1, 2);
    while (this.dashTrailTickMs >= spacingMs) {
      this.dashTrailTickMs -= spacingMs;
      const vx = this.player.body ? this.player.body.velocity.x : 0;
      const vy = this.player.body ? this.player.body.velocity.y : 0;
      const trailX = this.player.x - vx * 0.017;
      const trailY = this.player.y - vy * 0.017;
      this.dashTrailEmitter.explode(trailCount, trailX, trailY);
    }
  }

  playSfxTone({ wave = "sine", startFreq = 440, endFreq = 220, duration = 0.1, gain = 0.04, curve = "exponential" }) {
    if (!this.sound || !this.sound.context) {
      return;
    }

    const audioContext = this.sound.context;
    if (audioContext.state === "suspended" && audioContext.resume) {
      audioContext.resume().catch(() => {});
      if (audioContext.state === "suspended") {
        return;
      }
    }

    const startAt = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(40, startFreq), startAt);
    if (curve === "linear") {
      oscillator.frequency.linearRampToValueAtTime(Math.max(40, endFreq), startAt + duration);
    } else {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startAt + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.01);
  }

  playSfx(type, options = {}) {
    const now = this.time?.now ?? Date.now();
    const throttleMs = SFX_THROTTLE_MS[type] ?? 0;
    const lastPlayed = this.sfxLastPlayedAt[type] ?? Number.NEGATIVE_INFINITY;
    if (now - lastPlayed < throttleMs) {
      return;
    }
    this.sfxLastPlayedAt[type] = now;

    const key = SFX_KEY_BY_TYPE[type];
    const baseVolume = SFX_VOLUME[type] ?? 0.1;
    const safeVolume = Phaser.Math.Clamp(baseVolume * (options.elite ? 1.08 : 1), 0.01, 0.24);
    if (key && this.cache?.audio?.exists(key) && this.sound) {
      this.sound.play(key, { volume: safeVolume });
      return;
    }

    if (type === "enemy_hit") {
      this.playSfxTone({
        wave: "square",
        startFreq: 900,
        endFreq: 520,
        duration: 0.045,
        gain: options.elite ? 0.045 : 0.03
      });
      return;
    }

    if (type === "enemy_death") {
      this.playSfxTone({
        wave: options.elite ? "sawtooth" : "triangle",
        startFreq: options.elite ? 280 : 240,
        endFreq: options.elite ? 110 : 90,
        duration: options.elite ? 0.2 : 0.14,
        gain: options.elite ? 0.07 : 0.045
      });
      return;
    }

    if (type === "dash") {
      this.playSfxTone({
        wave: "sawtooth",
        startFreq: 150,
        endFreq: 380,
        duration: 0.12,
        gain: 0.05,
        curve: "linear"
      });
      return;
    }

    if (type === "level_up") {
      this.playSfxTone({
        wave: "triangle",
        startFreq: 430,
        endFreq: 620,
        duration: 0.08,
        gain: 0.045,
        curve: "linear"
      });
      this.time.delayedCall(75, () => {
        this.playSfxTone({
          wave: "triangle",
          startFreq: 620,
          endFreq: 900,
          duration: 0.11,
          gain: 0.05,
          curve: "linear"
        });
      });
      return;
    }

    if (type === "weapon_fire") {
      const weaponType = options.weaponType ?? "dagger";
      if (weaponType === "dagger") {
        this.playSfxTone({
          wave: "square",
          startFreq: 980,
          endFreq: 720,
          duration: 0.032,
          gain: 0.016
        });
        return;
      }
      if (weaponType === "fireball") {
        this.playSfxTone({
          wave: "sawtooth",
          startFreq: 520,
          endFreq: 280,
          duration: 0.06,
          gain: 0.026
        });
        return;
      }
      if (weaponType === "meteor") {
        this.playSfxTone({
          wave: "sawtooth",
          startFreq: 420,
          endFreq: 180,
          duration: 0.08,
          gain: 0.03
        });
        return;
      }
      if (weaponType === "lightning") {
        this.playSfxTone({
          wave: "triangle",
          startFreq: 1120,
          endFreq: 760,
          duration: 0.042,
          gain: 0.02
        });
        return;
      }
      this.playSfxTone({
        wave: "square",
        startFreq: 820,
        endFreq: 560,
        duration: 0.045,
        gain: 0.022
      });
    }
  }

  generateCircleTexture(key, radius, fillColor, strokeColor) {
    if (this.textures.exists(key)) {
      return;
    }

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(fillColor, 1);
    gfx.fillCircle(radius, radius, radius);
    gfx.lineStyle(2, strokeColor, 1);
    gfx.strokeCircle(radius, radius, radius);
    gfx.generateTexture(key, radius * 2, radius * 2);
    gfx.destroy();
  }

  generatePixelTexture(key, pixelSize, rows, palette, options = {}) {
    if (this.textures.exists(key)) {
      return;
    }

    const safeRows = Array.isArray(rows) ? rows : [];
    const rowCount = safeRows.length;
    const colCount = safeRows.reduce((max, row) => Math.max(max, row.length), 0);
    if (rowCount === 0 || colCount === 0) {
      return;
    }

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    const shadowColor = options.shadowColor;
    const shadowOffsetX = Number.isFinite(options.shadowOffsetX) ? options.shadowOffsetX : 0;
    const shadowOffsetY = Number.isFinite(options.shadowOffsetY) ? options.shadowOffsetY : 0;
    if (shadowColor !== undefined && (shadowOffsetX !== 0 || shadowOffsetY !== 0)) {
      safeRows.forEach((row, y) => {
        for (let x = 0; x < row.length; x += 1) {
          const symbol = row[x];
          if (palette[symbol] === undefined) {
            continue;
          }
          gfx.fillStyle(shadowColor, 0.9);
          gfx.fillRect((x + shadowOffsetX) * pixelSize, (y + shadowOffsetY) * pixelSize, pixelSize, pixelSize);
        }
      });
    }
    safeRows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const symbol = row[x];
        const color = palette[symbol];
        if (color === undefined) {
          continue;
        }
        gfx.fillStyle(color, 1);
        gfx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    });
    gfx.generateTexture(key, colCount * pixelSize, rowCount * pixelSize);
    gfx.destroy();
  }

  generateCompositeTexture(key, width, height, layers = []) {
    if (this.textures.exists(key)) {
      return;
    }
    if (!Array.isArray(layers) || layers.length === 0) {
      return;
    }

    const allLayersReady = layers.every((layer) => this.textures.exists(layer.sourceKey));
    if (!allLayersReady) {
      return;
    }

    const canvasTexture = this.textures.createCanvas(key, width, height);
    if (!canvasTexture?.context) {
      return;
    }

    const ctx = canvasTexture.context;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    layers.forEach((layer) => {
      const sourceTexture = this.textures.get(layer.sourceKey);
      const sourceImage = sourceTexture?.getSourceImage?.();
      if (!sourceImage) {
        return;
      }
      ctx.drawImage(
        sourceImage,
        0,
        0,
        sourceImage.width,
        sourceImage.height,
        layer.x,
        layer.y,
        layer.width,
        layer.height
      );
    });

    canvasTexture.refresh();
  }

  generatePolygonTexture(key, size, points, fillColor, strokeColor) {
    if (this.textures.exists(key)) {
      return;
    }

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    const shapePoints = points.map((point) => new Phaser.Geom.Point(point.x, point.y));
    gfx.fillStyle(fillColor, 1);
    gfx.fillPoints(shapePoints, true);
    gfx.lineStyle(2, strokeColor, 1);
    gfx.strokePoints(shapePoints, true, true);
    gfx.generateTexture(key, size * 2, size * 2);
    gfx.destroy();
  }

  generatePlayerTriangleTexture(key, size, fillColor, strokeColor, glowColor) {
    if (this.textures.exists(key)) {
      return;
    }

    const center = size;
    const outerPoints = [
      new Phaser.Geom.Point(center, center - size + 1),
      new Phaser.Geom.Point(center + size - 2, center + size - 4),
      new Phaser.Geom.Point(center - size + 2, center + size - 4)
    ];
    const innerPoints = [
      new Phaser.Geom.Point(center, center - size + 4),
      new Phaser.Geom.Point(center + size - 6, center + size - 8),
      new Phaser.Geom.Point(center - size + 6, center + size - 8)
    ];

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(glowColor, 0.26);
    gfx.fillPoints(outerPoints, true);
    gfx.fillStyle(fillColor, 1);
    gfx.fillPoints(innerPoints, true);
    gfx.lineStyle(2, strokeColor, 1);
    gfx.strokePoints(innerPoints, true, true);
    gfx.generateTexture(key, size * 2, size * 2);
    gfx.destroy();
  }

  drawArena() {
    const seaGraphics = this.add.graphics();
    seaGraphics.setDepth(-3);
    seaGraphics.fillStyle(0x061328, 1);
    seaGraphics.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const graphics = this.add.graphics();
    graphics.setDepth(0);

    const deckLeft = DECK_SURFACE_INSET;
    const deckTop = DECK_SURFACE_INSET;
    const deckWidth = WORLD_WIDTH - DECK_SURFACE_INSET * 2;
    const deckHeight = WORLD_HEIGHT - DECK_SURFACE_INSET * 2;
    const deckRight = deckLeft + deckWidth;
    const deckBottom = deckTop + deckHeight;
    const hasDeckPlankTexture = DECK_TILE_VARIANTS.some((variant) => this.textures.exists(variant.key));
    const hasDeckTrimTexture = this.textures.exists(IMPORTED_PIXEL_ASSETS.deckPlankTrim.key);

    graphics.fillStyle(scaleHexColor(0x5b3b25, DECK_BRIGHTNESS_MULTIPLIER), 1);
    graphics.fillRect(deckLeft, deckTop, deckWidth, deckHeight);

    let lastVariantKey = null;
    let variantRunLength = 0;
    for (let y = deckTop; y < deckBottom; y += DECK_TILE_SIZE) {
      const plankIndex = Math.floor((y - deckTop) / DECK_TILE_SIZE);
      const rowHeight = Math.min(DECK_TILE_SIZE - 2, deckBottom - y);
      const excludedKey = variantRunLength >= 3 ? lastVariantKey : null;
      const deckVariant = pickWeightedDeckVariant(DECK_TILE_VARIANTS, excludedKey);
      if (deckVariant.key === lastVariantKey) {
        variantRunLength += 1;
      } else {
        lastVariantKey = deckVariant.key;
        variantRunLength = 1;
      }

      if (hasDeckPlankTexture) {
        const textureKey = this.textures.exists(deckVariant.key) ? deckVariant.key : IMPORTED_PIXEL_ASSETS.deckPlankMain.key;
        const plankRow = this.add.tileSprite(
          deckLeft + deckWidth * 0.5,
          y + rowHeight * 0.5,
          deckWidth,
          rowHeight,
          textureKey
        );
        plankRow.setDepth(0);
        const plankTint = plankIndex % 2 === 0 ? deckVariant.tintEven : deckVariant.tintOdd;
        plankRow.setTint(scaleHexColor(plankTint, DECK_BRIGHTNESS_MULTIPLIER));
        plankRow.tileScaleX = 1;
        plankRow.tileScaleY = 1;
        plankRow.tilePositionX = (plankIndex % 5) * deckVariant.tileOffsetStep;
      } else {
        const plankColor = plankIndex % 2 === 0 ? deckVariant.fallbackEven : deckVariant.fallbackOdd;
        graphics.fillStyle(scaleHexColor(plankColor, DECK_BRIGHTNESS_MULTIPLIER), 1);
        graphics.fillRect(deckLeft, y, deckWidth, rowHeight);
      }

      const seamInset = 28 + (plankIndex % 4) * 18;
      const seamWidth = Math.max(120, deckWidth - seamInset * 2);
      graphics.fillStyle(
        scaleHexColor(0x8b603f, DECK_BRIGHTNESS_MULTIPLIER),
        (plankIndex % 2 === 0 ? 0.08 : 0.14) * DECK_HIGHLIGHT_OPACITY
      );
      graphics.fillRect(deckLeft + seamInset, y, seamWidth, 2);

      if (hasDeckTrimTexture) {
        const trimRow = this.add.tileSprite(
          deckLeft + deckWidth * 0.5,
          y + 2,
          deckWidth,
          6,
          IMPORTED_PIXEL_ASSETS.deckPlankTrim.key
        );
        trimRow.setDepth(0.1);
        trimRow.setTint(
          scaleHexColor(plankIndex % 2 === 0 ? 0xd9b48c : 0xc49263, DECK_BRIGHTNESS_MULTIPLIER)
        );
        trimRow.setAlpha(DECK_HIGHLIGHT_OPACITY);
      }

      const jointSteps = [148, 206, 172, 228];
      let jointX = deckLeft + 76 + ((plankIndex % 5) * 22);
      let jointIndex = plankIndex % jointSteps.length;
      while (jointX < deckRight - 72) {
        graphics.fillStyle(
          scaleHexColor(0x4a2f1f, DECK_BRIGHTNESS_MULTIPLIER),
          0.22 * DECK_HIGHLIGHT_OPACITY
        );
        graphics.fillRect(jointX, y + 4, 3, DECK_TILE_SIZE - 10);
        if ((jointIndex + plankIndex) % 3 === 0) {
          graphics.fillStyle(
            scaleHexColor(0x2f1d12, DECK_BRIGHTNESS_MULTIPLIER),
            0.1 * DECK_HIGHLIGHT_OPACITY
          );
          graphics.fillRect(jointX + 6, y + 8, 22, 2);
        }
        jointX += jointSteps[jointIndex];
        jointIndex = (jointIndex + 1) % jointSteps.length;
      }
    }

    graphics.fillStyle(0x3d2619, 1);
    graphics.fillRect(deckLeft, deckTop, deckWidth, 18);
    graphics.fillRect(deckLeft, deckBottom - 18, deckWidth, 18);
    graphics.fillRect(deckLeft, deckTop, 18, deckHeight);
    graphics.fillRect(deckRight - 18, deckTop, 18, deckHeight);

    const hatchWidth = 128;
    const hatchHeight = 64;
    const hatchX = HATCH_BREACH_POINT.x - hatchWidth / 2;
    const hatchY = HATCH_BREACH_POINT.y - hatchHeight / 2;
    graphics.fillStyle(0x4b2f1e, 1);
    graphics.fillRect(hatchX, hatchY, hatchWidth, hatchHeight);
    graphics.lineStyle(2, 0x28170f, 1);
    graphics.strokeRect(hatchX, hatchY, hatchWidth, hatchHeight);
    graphics.lineStyle(2, 0x8f6441, 0.75);
    graphics.lineBetween(HATCH_BREACH_POINT.x, hatchY + 6, HATCH_BREACH_POINT.x, hatchY + hatchHeight - 6);
    graphics.lineBetween(hatchX + 6, HATCH_BREACH_POINT.y, hatchX + hatchWidth - 6, HATCH_BREACH_POINT.y);

    const beamYPositions = [deckTop + 186, deckTop + 420, deckBottom - 214];
    beamYPositions.forEach((beamY, index) => {
      graphics.fillStyle(0x3f281a, 0.26);
      graphics.fillRect(deckLeft + 36, beamY - 7, deckWidth - 72, 14);
      graphics.fillStyle(0x8f6441, 0.12);
      graphics.fillRect(deckLeft + 44, beamY - 5, deckWidth - 88, 3);
      for (let x = deckLeft + 120 + (index % 2) * 38; x < deckRight - 120; x += 260) {
        graphics.fillStyle(0x2d1a10, 0.35);
        graphics.fillRect(x, beamY - 3, 10, 6);
      }
    });

    [
      { x: deckLeft + 118, y: deckTop + 146 },
      { x: deckRight - 118, y: deckTop + 146 },
      { x: deckLeft + 118, y: deckBottom - 146 },
      { x: deckRight - 118, y: deckBottom - 146 }
    ].forEach((plate) => {
      graphics.fillStyle(0x4f3728, 0.42);
      graphics.fillRect(plate.x - 18, plate.y - 12, 36, 24);
      graphics.lineStyle(1, 0xb08961, 0.34);
      graphics.strokeRect(plate.x - 18, plate.y - 12, 36, 24);
    });

    this.initializeSeaWaves();
    this.drawDeckRails();
    this.drawDeckDecor(deckLeft, deckTop, deckRight, deckBottom);
  }

  drawDeckDecor(deckLeft, deckTop, deckRight, deckBottom) {
    const decorDepth = 1.4;

    if (this.textures.exists(IMPORTED_PIXEL_ASSETS.deckHullLarge.key)) {
      this.add
        .image((deckLeft + deckRight) * 0.5, deckTop + 54, IMPORTED_PIXEL_ASSETS.deckHullLarge.key)
        .setDepth(decorDepth)
        .setScale(1.8);
      this.add
        .image((deckLeft + deckRight) * 0.5, deckBottom - 54, IMPORTED_PIXEL_ASSETS.deckHullLarge.key)
        .setDepth(decorDepth)
        .setScale(1.8)
        .setRotation(Math.PI);
    }

    const looseCannonKey = IMPORTED_PIXEL_ASSETS.deckCannonLoose.key;
    const cannonBallKey = IMPORTED_PIXEL_ASSETS.deckCannonBall.key;
    SHIP_DECK_OBSTACLE_LAYOUT.filter((entry) => entry.role === "cannon").forEach((entry, index) => {
      if (this.textures.exists(looseCannonKey)) {
        const looseX = entry.x < WORLD_WIDTH * 0.5 ? entry.x + 40 : entry.x - 40;
        const looseRotation = entry.x < WORLD_WIDTH * 0.5 ? 0 : Math.PI;
        this.add
          .image(looseX, entry.y + 18, looseCannonKey)
          .setDepth(decorDepth)
          .setScale(1.4)
          .setRotation(looseRotation);
      }
      if (this.textures.exists(cannonBallKey)) {
        const ballX = entry.x < WORLD_WIDTH * 0.5 ? entry.x + 54 : entry.x - 54;
        this.add
          .image(ballX, entry.y + (index % 2 === 0 ? -12 : 12), cannonBallKey)
          .setDepth(decorDepth + 0.05)
          .setScale(1.6);
      }
    });
  }

  initializeSeaWaves() {
    if (this.seaWaveGraphics) {
      this.seaWaveGraphics.destroy();
    }

    this.seaWaveGraphics = this.add.graphics();
    this.seaWaveGraphics.setDepth(-2);
    this.seaWaves = [];

    const waveCount = Phaser.Math.Between(SEA_WAVE_MIN, SEA_WAVE_MAX);
    for (let i = 0; i < waveCount; i += 1) {
      const topBand = i < Math.ceil(waveCount / 2);
      const minY = topBand ? 8 : WORLD_HEIGHT - DECK_SURFACE_INSET + 8;
      const maxY = topBand ? DECK_SURFACE_INSET - 8 : WORLD_HEIGHT - 8;
      this.seaWaves.push({
        baseY: Phaser.Math.Between(minY, maxY),
        length: Phaser.Math.Between(190, 360),
        amplitude: Phaser.Math.FloatBetween(3.5, 9.5),
        speed: Phaser.Math.FloatBetween(0.016, 0.03),
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
        alpha: Phaser.Math.FloatBetween(0.13, 0.24),
        thickness: Phaser.Math.Between(1, 2),
        color: 0x78b4e3
      });
    }
  }

  updateSeaWaves(timeMs) {
    if (!this.seaWaveGraphics || !Array.isArray(this.seaWaves) || this.seaWaves.length === 0) {
      return;
    }

    this.seaWaveGraphics.clear();
    this.seaWaves.forEach((wave) => {
      const segmentCount = 8;
      const lineStartX = ((timeMs * wave.speed + wave.phase * 80) % (WORLD_WIDTH + wave.length * 2)) - wave.length;
      const baseY = wave.baseY + Math.sin(timeMs * 0.0016 + wave.phase) * wave.amplitude;

      this.seaWaveGraphics.lineStyle(wave.thickness, wave.color, wave.alpha);
      this.seaWaveGraphics.beginPath();
      for (let i = 0; i <= segmentCount; i += 1) {
        const t = i / segmentCount;
        const x = lineStartX + wave.length * t;
        const y = baseY + Math.sin(timeMs * 0.0022 + wave.phase + t * 5.2) * wave.amplitude * 0.42;
        if (i === 0) {
          this.seaWaveGraphics.moveTo(x, y);
        } else {
          this.seaWaveGraphics.lineTo(x, y);
        }
      }
      this.seaWaveGraphics.strokePath();
    });
  }

  drawDeckRails() {
    const rail = this.add.graphics();
    rail.setDepth(1);

    const left = DECK_RAIL_INSET;
    const top = DECK_RAIL_INSET;
    const width = WORLD_WIDTH - DECK_RAIL_INSET * 2;
    const height = WORLD_HEIGHT - DECK_RAIL_INSET * 2;
    const right = left + width;
    const bottom = top + height;

    // Main rail body and highlight.
    rail.lineStyle(12, 0x503724, 0.95);
    rail.strokeRect(left, top, width, height);
    rail.lineStyle(4, 0x8e6340, 0.9);
    rail.strokeRect(left + 4, top + 4, width - 8, height - 8);

    // Post segments along port/starboard.
    rail.fillStyle(0x6d4b30, 1);
    for (let y = top + 30; y <= bottom - 30; y += DECK_RAIL_POST_GAP) {
      rail.fillRect(left - 2, y - DECK_RAIL_POST_LENGTH / 2, DECK_RAIL_POST_WIDTH, DECK_RAIL_POST_LENGTH);
      rail.fillRect(right - DECK_RAIL_POST_WIDTH + 2, y - DECK_RAIL_POST_LENGTH / 2, DECK_RAIL_POST_WIDTH, DECK_RAIL_POST_LENGTH);
    }

    // Post segments along bow/stern.
    for (let x = left + 34; x <= right - 34; x += DECK_RAIL_POST_GAP) {
      rail.fillRect(x - DECK_RAIL_POST_LENGTH / 2, top - 2, DECK_RAIL_POST_LENGTH, DECK_RAIL_POST_WIDTH);
      rail.fillRect(x - DECK_RAIL_POST_LENGTH / 2, bottom - DECK_RAIL_POST_WIDTH + 2, DECK_RAIL_POST_LENGTH, DECK_RAIL_POST_WIDTH);
    }
  }

  createTouchControls() {
    const hasTouch = Boolean(this.sys.game.device?.input?.touch);
    this.touchControlsEnabled = hasTouch;
    this.updateHelpOverlayText();
    if (!hasTouch) {
      return;
    }

    const hudDepth = 26;
    this.touchJoystickCenter.set(96, this.scale.height - 96);
    this.touchJoystickBase = this.add
      .circle(this.touchJoystickCenter.x, this.touchJoystickCenter.y, TOUCH_JOYSTICK_RADIUS, 0x16304f, 0.38)
      .setStrokeStyle(2, 0x7fb8ff, 0.72)
      .setScrollFactor(0)
      .setDepth(hudDepth)
      .setVisible(true);
    this.touchJoystickThumb = this.add
      .circle(this.touchJoystickCenter.x, this.touchJoystickCenter.y, 28, 0x8ed8ff, 0.45)
      .setStrokeStyle(2, 0xc6ecff, 0.8)
      .setScrollFactor(0)
      .setDepth(hudDepth + 1)
      .setVisible(true);

    const dashX = this.scale.width - 98;
    const dashY = this.scale.height - 96;
    this.touchDashButton = this.add
      .circle(dashX, dashY, TOUCH_DASH_BUTTON_RADIUS, 0x72591a, 0.45)
      .setStrokeStyle(2, 0xffd166, 0.86)
      .setScrollFactor(0)
      .setDepth(hudDepth)
      .setInteractive();
    this.touchDashLabel = this.add
      .text(dashX, dashY, "DASH", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffe8a8",
        stroke: "#3b2a08",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(hudDepth + 1);

    this.touchDashButton.on("pointerdown", () => {
      this.touchDashQueued = true;
    });

    this.onTouchPointerDown = (pointer) => {
      if (!this.touchControlsEnabled || this.touchMovePointerId !== null) {
        return;
      }
      if (!this.isPointerInTouchJoystick(pointer)) {
        return;
      }
      this.touchMovePointerId = pointer.id;
      this.updateTouchJoystick(pointer);
    };

    this.onTouchPointerMove = (pointer) => {
      if (!this.touchControlsEnabled || pointer.id !== this.touchMovePointerId) {
        return;
      }
      this.updateTouchJoystick(pointer);
    };

    this.onTouchPointerUp = (pointer) => {
      if (!this.touchControlsEnabled || pointer.id !== this.touchMovePointerId) {
        return;
      }
      this.releaseTouchJoystick();
    };

    this.input.on("pointerdown", this.onTouchPointerDown);
    this.input.on("pointermove", this.onTouchPointerMove);
    this.input.on("pointerup", this.onTouchPointerUp);
    this.input.on("pointerupoutside", this.onTouchPointerUp);
  }

  registerSceneShutdownCleanup() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupTransientUiPools();
      this.teardownTouchControls();
      this.clearEvolutionSlowMoTimer();
    });
  }

  cleanupTransientUiPools() {
    if (Array.isArray(this.damageNumberPool)) {
      this.damageNumberPool.forEach((text) => {
        const tween = text?.getData?.("damageTween");
        if (tween) {
          tween.stop();
        }
        text?.setData?.("damageTween", null);
        text?.setVisible?.(false);
        text?.setActive?.(false);
      });
    }

    if (Array.isArray(this.hudAlertPool)) {
      this.hudAlertPool.forEach((text) => this.releaseHudAlertText(text));
    }

    if (Array.isArray(this.offscreenIndicatorPool)) {
      this.offscreenIndicatorPool.forEach((marker) => {
        marker?.setVisible?.(false);
        marker?.setActive?.(false);
      });
    }
  }

  clearEvolutionSlowMoTimer() {
    if (this.evolutionSlowMoRestoreHandle) {
      clearTimeout(this.evolutionSlowMoRestoreHandle);
      this.evolutionSlowMoRestoreHandle = null;
    }

    if (this.evolutionSlowMoActive) {
      if (this.time) {
        this.time.timeScale = 1;
      }
      if (this.tweens) {
        this.tweens.timeScale = 1;
      }
      if (this.physics?.world) {
        this.physics.world.timeScale = 1;
      }
      this.evolutionSlowMoActive = false;
    }
  }

  teardownTouchControls() {
    if (this.onTouchPointerDown) {
      this.input.off("pointerdown", this.onTouchPointerDown);
      this.onTouchPointerDown = null;
    }
    if (this.onTouchPointerMove) {
      this.input.off("pointermove", this.onTouchPointerMove);
      this.onTouchPointerMove = null;
    }
    if (this.onTouchPointerUp) {
      this.input.off("pointerup", this.onTouchPointerUp);
      this.input.off("pointerupoutside", this.onTouchPointerUp);
      this.onTouchPointerUp = null;
    }

    if (this.touchDashButton) {
      this.touchDashButton.destroy();
      this.touchDashButton = null;
    }
    if (this.touchDashLabel) {
      this.touchDashLabel.destroy();
      this.touchDashLabel = null;
    }
    if (this.touchJoystickThumb) {
      this.touchJoystickThumb.destroy();
      this.touchJoystickThumb = null;
    }
    if (this.touchJoystickBase) {
      this.touchJoystickBase.destroy();
      this.touchJoystickBase = null;
    }

    this.touchMovePointerId = null;
    this.touchDashQueued = false;
    this.touchMoveVector.set(0, 0);
  }

  updateHelpOverlayText() {
    if (typeof document === "undefined") {
      return;
    }
    const helpElement = document.getElementById("help");
    if (!helpElement) {
      return;
    }

    helpElement.textContent = this.touchControlsEnabled
      ? this.helpOverlayCompact
        ? "MOVE PAD · DASH BTN · R"
        : "Touch Move · Dash Button · R Restart"
      : this.helpOverlayCompact
        ? "WASD · SPACE · R"
        : "WASD Move · SPACE Dash · R";
  }

  updateHelpOverlayPresentation() {
    if (typeof document === "undefined") {
      return;
    }
    const helpElement = document.getElementById("help");
    if (!helpElement) {
      return;
    }

    const shouldCompact = !this.touchControlsEnabled && !this.isGameOver && this.runTimeMs >= 12000;
    if (shouldCompact === this.helpOverlayCompact) {
      return;
    }

    this.helpOverlayCompact = shouldCompact;
    helpElement.classList.toggle("is-compact", shouldCompact);
    this.updateHelpOverlayText();
  }

  applyHudModalFocus(isModalOpen) {
    const hudAlpha = isModalOpen ? 0.34 : 1;
    const panelAlpha = isModalOpen ? 0.2 : 1;
    [
      this.hudLevelText,
      this.hudStatsText,
      this.hudTimerText,
      this.hudGoldText,
      this.hudXpLabelText,
      this.hudCoreLabelText,
      this.hudXpFrame
    ]
      .filter(Boolean)
      .forEach((obj) => obj.setAlpha(hudAlpha));
    [this.hudPanelBack].filter(Boolean).forEach((obj) => obj.setAlpha(panelAlpha));
    [this.hudBarsGraphics].filter(Boolean).forEach((obj) => obj.setAlpha(hudAlpha));
    [...(this.hudWeaponSlotFrames ?? []), ...(this.hudWeaponSlotLabels ?? [])]
      .filter(Boolean)
      .forEach((obj) => obj.setAlpha(hudAlpha));
    this.hud?.setAlpha(hudAlpha);
    this.dashCooldownRingGraphics?.setAlpha(isModalOpen ? 0.2 : 1);
    this.enemyHealthBarsGraphics?.setAlpha(isModalOpen ? 0.25 : 1);
    this.offscreenIndicatorGraphics?.setAlpha(isModalOpen ? 0.08 : 1);
    this.modalBackdrop?.setVisible(isModalOpen);

    if (typeof document !== "undefined") {
      document.getElementById("help")?.classList.toggle("modal-open", isModalOpen);
    }
  }

  updatePlayerReadabilityAura() {
    if (!this.playerReadabilityGraphics) {
      return;
    }

    this.playerReadabilityGraphics.clear();
    if (!this.player?.active) {
      return;
    }

    const x = this.player.x;
    const y = this.player.y + 2;
    this.playerReadabilityGraphics.fillStyle(0x08111d, 0.22);
    this.playerReadabilityGraphics.fillEllipse(x, y + 8, 42, 18);
    this.playerReadabilityGraphics.lineStyle(2, 0xe7e1c4, 0.16);
    this.playerReadabilityGraphics.strokeCircle(x, y, 19);
  }

  isPointerInTouchJoystick(pointer) {
    return Phaser.Math.Distance.Between(pointer.x, pointer.y, this.touchJoystickCenter.x, this.touchJoystickCenter.y) <= TOUCH_JOYSTICK_TOUCH_RADIUS;
  }

  updateTouchJoystick(pointer) {
    const dx = pointer.x - this.touchJoystickCenter.x;
    const dy = pointer.y - this.touchJoystickCenter.y;
    const distance = Math.hypot(dx, dy);
    const clampedDistance = Math.min(distance, TOUCH_JOYSTICK_RADIUS);
    const nx = distance > 0.0001 ? dx / distance : 0;
    const ny = distance > 0.0001 ? dy / distance : 0;
    const thumbX = this.touchJoystickCenter.x + nx * clampedDistance;
    const thumbY = this.touchJoystickCenter.y + ny * clampedDistance;

    this.touchMoveVector.set(nx * (clampedDistance / TOUCH_JOYSTICK_RADIUS), ny * (clampedDistance / TOUCH_JOYSTICK_RADIUS));
    if (this.touchJoystickThumb) {
      this.touchJoystickThumb.setPosition(thumbX, thumbY);
    }
  }

  releaseTouchJoystick() {
    this.touchMovePointerId = null;
    this.touchMoveVector.set(0, 0);
    if (this.touchJoystickThumb) {
      this.touchJoystickThumb.setPosition(this.touchJoystickCenter.x, this.touchJoystickCenter.y);
    }
  }

  getTouchMoveInput() {
    if (!this.touchControlsEnabled) {
      return null;
    }
    return this.touchMoveVector;
  }

  consumeTouchDash() {
    if (!this.touchDashQueued) {
      return false;
    }
    this.touchDashQueued = false;
    return true;
  }

  createTerrainObstacles() {
    if (!this.obstacles) {
      return;
    }

    this.terrainObstacleAnchors = [];
    SHIP_DECK_OBSTACLE_LAYOUT.forEach((entry) => this.spawnTerrainObstacle(entry));
    this.spawnRandomDeckObstacles();
    this.ensureNavigableDeckPassages();
  }

  spawnRandomDeckObstacles() {
    const deckLeft = DECK_SURFACE_INSET;
    const deckTop = DECK_SURFACE_INSET;
    const deckWidth = WORLD_WIDTH - DECK_SURFACE_INSET * 2;
    const deckHeight = WORLD_HEIGHT - DECK_SURFACE_INSET * 2;
    const deckRight = deckLeft + deckWidth;
    const deckBottom = deckTop + deckHeight;

    const logicalCols = Math.max(1, Math.floor(deckWidth / RANDOM_DECK_OBSTACLE_TILE_GROUP_SIZE));
    const logicalRows = Math.max(1, Math.floor(deckHeight / RANDOM_DECK_OBSTACLE_TILE_GROUP_SIZE));
    const logicalTileCount = logicalCols * logicalRows;
    const densityDivisor = Phaser.Math.Between(RANDOM_DECK_OBSTACLE_DENSITY_MIN_TILES, RANDOM_DECK_OBSTACLE_DENSITY_MAX_TILES);
    const targetSpawnCount = Math.max(1, Math.floor(logicalTileCount / densityDivisor));
    const maxAttempts = targetSpawnCount * RANDOM_DECK_OBSTACLE_MAX_ATTEMPTS_MULTIPLIER;

    const playerStartX = WORLD_WIDTH * 0.5;
    const playerStartY = WORLD_HEIGHT * 0.5;
    const hatchClearRadius = RANDOM_DECK_OBSTACLE_EVENT_CLEAR_RADIUS;
    let spawned = 0;

    for (let attempt = 0; attempt < maxAttempts && spawned < targetSpawnCount; attempt += 1) {
      const x = Phaser.Math.Between(deckLeft + RANDOM_DECK_OBSTACLE_MIN_PADDING, deckRight - RANDOM_DECK_OBSTACLE_MIN_PADDING);
      const y = Phaser.Math.Between(deckTop + RANDOM_DECK_OBSTACLE_MIN_PADDING, deckBottom - RANDOM_DECK_OBSTACLE_MIN_PADDING);

      if (Phaser.Math.Distance.Between(playerStartX, playerStartY, x, y) <= this.safeRadius) {
        continue;
      }

      if (Phaser.Math.Distance.Between(HATCH_BREACH_POINT.x, HATCH_BREACH_POINT.y, x, y) <= hatchClearRadius) {
        continue;
      }

      const minEdgeDistance = Math.min(x - deckLeft, deckRight - x, y - deckTop, deckBottom - y);
      if (minEdgeDistance <= RANDOM_DECK_OBSTACLE_EDGE_SPAWN_BUFFER) {
        continue;
      }

      if (this.isObstacleBlockedAt(x, y, RANDOM_DECK_OBSTACLE_MIN_PADDING)) {
        continue;
      }

      const spec = pickWeightedRandomObstacleSpec(RANDOM_DECK_OBSTACLE_SPAWN_TABLE);
      const scale = Phaser.Math.FloatBetween(spec.scaleMin, spec.scaleMax);
      const obstacle = this.spawnTerrainObstacle({
        type: spec.type,
        role: spec.objectType,
        textureKey: spec.textureKey,
        x,
        y,
        scale,
        anchorRadius: spec.anchorRadius,
        tint: spec.tint
      });

      if (!obstacle) {
        continue;
      }

      spawned += 1;
    }
  }

  spawnTerrainObstacle(config = {}) {
    if (!this.obstacles) {
      return null;
    }

    const obstacleType = config.type === "terrain_pillar" ? "terrain_pillar" : "terrain_rock";
    const role = config.role ?? "misc";
    let textureKey = config.textureKey ?? obstacleType;
    if (!config.textureKey) {
      if (role === "mast") {
        textureKey = "terrain_mast";
      } else if (role === "crate") {
        textureKey = "terrain_crate";
      } else if (role === "cannon") {
        textureKey = this.textures.exists(IMPORTED_PIXEL_ASSETS.cannon.key)
          ? IMPORTED_PIXEL_ASSETS.cannon.key
          : "terrain_cannon";
      }
    }
    const x = Phaser.Math.Clamp(Number(config.x) || WORLD_WIDTH * 0.5, 12, WORLD_WIDTH - 12);
    const y = Phaser.Math.Clamp(Number(config.y) || WORLD_HEIGHT * 0.5, 12, WORLD_HEIGHT - 12);
    const scale = Phaser.Math.Clamp(Number(config.scale) || 1, 0.5, 1.9);

    const obstacle = this.obstacles.create(x, y, textureKey);
    if (!obstacle) {
      return null;
    }

    obstacle.setScale(scale);
    obstacle.setDepth(2);
    obstacle.setData("obstacleRole", role);
    if (Number.isFinite(config.tint)) {
      obstacle.setTint(config.tint);
    }
    obstacle.refreshBody();

    let anchorRadius = obstacleType === "terrain_rock" ? 36 : 40;
    if (role === "mast") {
      anchorRadius = 42;
    } else if (role === "crate") {
      anchorRadius = 34;
    } else if (role === "cannon") {
      anchorRadius = 32;
    }
    if (Number.isFinite(config.anchorRadius)) {
      anchorRadius = config.anchorRadius;
    }
    this.terrainObstacleAnchors.push({
      x,
      y,
      radius: anchorRadius * scale,
      obstacle,
      role
    });
    return obstacle;
  }

  resolveDevAntiJamEnabled() {
    if (typeof window === "undefined") {
      return false;
    }
    try {
      const params = new URLSearchParams(window.location?.search ?? "");
      if (params.get("dev_jam") === "1") {
        return true;
      }
    } catch (_error) {
      // Ignore URL parsing failures.
    }
    return Boolean(window.__DEV__);
  }

  getDeckPassageOpenDirectionCount() {
    const centerX = WORLD_WIDTH * 0.5;
    const centerY = WORLD_HEIGHT * 0.5;
    const directions = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 }
    ];
    let openDirections = 0;

    directions.forEach((dir) => {
      let clearSamples = 0;
      DECK_PASSAGE_SAMPLE_DISTANCES.forEach((distance) => {
        const sampleX = centerX + dir.x * distance;
        const sampleY = centerY + dir.y * distance;
        if (!this.isObstacleBlockedAt(sampleX, sampleY, 24)) {
          clearSamples += 1;
        }
      });
      if (clearSamples >= 2) {
        openDirections += 1;
      }
    });

    return openDirections;
  }

  canRepositionObstacleAnchor(anchor, nextX, nextY) {
    if (!anchor) {
      return false;
    }

    if (nextX < 12 || nextX > WORLD_WIDTH - 12 || nextY < 12 || nextY > WORLD_HEIGHT - 12) {
      return false;
    }
    const distFromCenter = Phaser.Math.Distance.Between(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, nextX, nextY);
    if (distFromCenter < 120) {
      return false;
    }

    return this.terrainObstacleAnchors.every((other) => {
      if (other === anchor) {
        return true;
      }
      const gap = Phaser.Math.Distance.Between(other.x, other.y, nextX, nextY);
      return gap >= other.radius + anchor.radius + 20;
    });
  }

  ensureNavigableDeckPassages() {
    if (!Array.isArray(this.terrainObstacleAnchors) || this.terrainObstacleAnchors.length === 0) {
      return;
    }

    const movableAnchors = this.terrainObstacleAnchors.filter((anchor) => anchor.role === "crate" && anchor.obstacle?.active);
    if (movableAnchors.length === 0) {
      return;
    }

    let openDirectionCount = this.getDeckPassageOpenDirectionCount();
    if (openDirectionCount >= DECK_PASSAGE_MIN_OPEN_DIRECTIONS) {
      return;
    }

    for (let i = 0; i < DECK_PASSAGE_REPAIR_MAX_STEPS; i += 1) {
      const anchor = Phaser.Utils.Array.GetRandom(movableAnchors);
      const nextX = Phaser.Math.Clamp(anchor.x + Phaser.Math.Between(-DECK_PASSAGE_REPAIR_NUDGE, DECK_PASSAGE_REPAIR_NUDGE), 16, WORLD_WIDTH - 16);
      const nextY = Phaser.Math.Clamp(anchor.y + Phaser.Math.Between(-DECK_PASSAGE_REPAIR_NUDGE, DECK_PASSAGE_REPAIR_NUDGE), 16, WORLD_HEIGHT - 16);
      if (!this.canRepositionObstacleAnchor(anchor, nextX, nextY)) {
        continue;
      }

      anchor.x = nextX;
      anchor.y = nextY;
      if (anchor.obstacle) {
        anchor.obstacle.setPosition(nextX, nextY);
        anchor.obstacle.refreshBody();
      }

      openDirectionCount = this.getDeckPassageOpenDirectionCount();
      if (openDirectionCount >= DECK_PASSAGE_MIN_OPEN_DIRECTIONS) {
        return;
      }
    }
  }

  applyEnemyAntiJam(enemy, nowMs) {
    if (!this.devAntiJamEnabled || !enemy?.active || !enemy?.body) {
      return;
    }

    if (enemy.getData("isBoss")) {
      return;
    }

    const lastX = enemy.getData("jamLastX");
    const lastY = enemy.getData("jamLastY");
    if (lastX === undefined || lastY === undefined) {
      enemy.setData("jamLastX", enemy.x);
      enemy.setData("jamLastY", enemy.y);
      enemy.setData("jamLastMoveAtMs", nowMs);
      return;
    }

    const distanceMoved = Phaser.Math.Distance.Between(lastX, lastY, enemy.x, enemy.y);
    const desiredSpeed = Math.hypot(enemy.body.velocity.x, enemy.body.velocity.y);
    const lastMoveAtMs = enemy.getData("jamLastMoveAtMs") ?? nowMs;
    if (distanceMoved > ENEMY_JAM_MIN_PROGRESS_PX) {
      enemy.setData("jamLastMoveAtMs", nowMs);
    } else {
      const stuckDuration = nowMs - lastMoveAtMs;
      if (desiredSpeed > Math.max(40, enemy.speed * 0.35) && stuckDuration >= ENEMY_JAM_STUCK_WINDOW_MS) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const sourceX = enemy.x - Math.cos(angle) * 18;
        const sourceY = enemy.y - Math.sin(angle) * 18;
        if (typeof enemy.applyKnockbackFrom === "function") {
          enemy.applyKnockbackFrom(sourceX, sourceY, ENEMY_JAM_PUSH_FORCE);
        }
        enemy.setData("jamLastMoveAtMs", nowMs);
      }
    }

    enemy.setData("jamLastX", enemy.x);
    enemy.setData("jamLastY", enemy.y);
  }

  getTargetEnemyCount(seconds) {
    for (let i = 0; i < TARGET_ENEMY_CURVE.length; i += 1) {
      const segment = TARGET_ENEMY_CURVE[i];
      if (seconds < segment.endSec) {
        const duration = Math.max(1, segment.endSec - segment.startSec);
        const progress = (seconds - segment.startSec) / duration;
        return Phaser.Math.Linear(segment.from, segment.to, progress);
      }
    }

    const lastSegmentEndSec = TARGET_ENEMY_CURVE[TARGET_ENEMY_CURVE.length - 1]?.endSec ?? 0;
    const elapsedPostWaveSec = Math.max(0, seconds - lastSegmentEndSec);
    const postWaveCount = Math.floor(elapsedPostWaveSec / TARGET_ENEMY_WAVE_DURATION_SEC) + 1;
    return TARGET_ENEMY_FALLBACK + postWaveCount * TARGET_ENEMY_WAVE_INCREMENT;
  }

  getSpawnBurst(seconds, deficit) {
    let burst = SPAWN_BURST_CONFIG.defaultBurst;
    for (let i = 0; i < SPAWN_BURST_CONFIG.steps.length; i += 1) {
      if (seconds >= SPAWN_BURST_CONFIG.steps[i].atSec) {
        burst = SPAWN_BURST_CONFIG.steps[i].burst;
      }
    }
    return Math.min(deficit, burst);
  }

  getEffectiveSpawnRateMultiplier() {
    return this.director.getSpawnRateMultiplier();
  }

  getEffectiveEnemySpeedMultiplier() {
    return this.director.getEnemySpeedMultiplier();
  }

  maintainEnemyDensity() {
    if (this.isGameOver || this.isLeveling || this.isWeaponSelecting) {
      return;
    }

    const seconds = this.runTimeMs / 1000;
    const pacingTargetScale = Math.max(0.5, Number(this.spawnPacingPreset?.targetCountScale) || 1);
    const baseTarget = this.getTargetEnemyCount(seconds) * pacingTargetScale;
    const spawnRateMultiplier = this.getEffectiveSpawnRateMultiplier();
    const scaledTarget = baseTarget * spawnRateMultiplier;
    const performance = this.getPerformanceMetrics();
    const adaptiveOffset = this.director.getAdaptiveTargetOffset(scaledTarget, performance.dps, performance.killRate);
    this.targetEnemies = Math.min(PERFORMANCE_MAX_ACTIVE_ENEMIES, Math.round(scaledTarget + adaptiveOffset));

    const aliveEnemies = this.getAliveEnemyCount();
    if (aliveEnemies >= this.targetEnemies) {
      return;
    }

    const deficit = this.targetEnemies - aliveEnemies;
    const spawnCount = this.getSpawnBurst(seconds, deficit);
    for (let i = 0; i < spawnCount; i += 1) {
      this.spawnEnemyFromEdge();
    }
  }

  spawnEnemyFromEdge(preferredLane = null) {
    if (this.isGameOver || this.isLeveling || this.isWeaponSelecting) {
      return;
    }
    if (this.getAliveEnemyCount() >= PERFORMANCE_MAX_ACTIVE_ENEMIES) {
      return;
    }

    const type = this.pickEnemyArchetype();
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    const baseHp = ENEMY_ARCHETYPE_CONFIGS[type]?.hp ?? ENEMY_ARCHETYPE_CONFIGS.chaser.hp;
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier));
    const groupCount = type === "swarm" ? Phaser.Math.Between(3, 5) : 1;
    const lane = this.director?.chooseSpawnLane?.(preferredLane) ?? null;
    const anchor = this.getSpawnPosition(lane);

    for (let i = 0; i < groupCount; i += 1) {
      if (this.getAliveEnemyCount() >= PERFORMANCE_MAX_ACTIVE_ENEMIES) {
        break;
      }
      const jitter = type === "swarm" ? Phaser.Math.Between(12, 48) : 0;
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      let spawnX = Phaser.Math.Clamp(anchor.x + Math.cos(angle) * jitter, 12, WORLD_WIDTH - 12);
      let spawnY = Phaser.Math.Clamp(anchor.y + Math.sin(angle) * jitter, 12, WORLD_HEIGHT - 12);

      if (!this.isValidSpawnPoint(spawnX, spawnY)) {
        const fallback = this.getSpawnPosition(lane);
        spawnX = fallback.x;
        spawnY = fallback.y;
      }
      if (!this.isValidSpawnPoint(spawnX, spawnY)) {
        continue;
      }

      const enemy = this.spawnEnemyAtPosition(type, spawnX, spawnY, lane);
      if (!enemy) {
        continue;
      }
    }
  }

  getParticleLoadScale() {
    const aliveEnemies = this.getAliveEnemyCount();
    if (aliveEnemies <= PARTICLE_LOAD_SOFT_CAP_ENEMIES) {
      return 1;
    }

    const pressure = Phaser.Math.Clamp(
      (aliveEnemies - PARTICLE_LOAD_SOFT_CAP_ENEMIES) / (PARTICLE_LOAD_HARD_CAP_ENEMIES - PARTICLE_LOAD_SOFT_CAP_ENEMIES),
      0,
      1
    );
    return Phaser.Math.Linear(1, MIN_PARTICLE_LOAD_SCALE, pressure);
  }

  getScaledParticleCount(baseCount, minCount = 1, maxCount = baseCount) {
    const scaled = Math.round(baseCount * this.getParticleLoadScale());
    return Phaser.Math.Clamp(scaled, minCount, maxCount);
  }

  processDirectorBossSpawns() {
    const pendingBossSpawns = this.director.consumeBossSpawnRequests();
    for (let i = 0; i < pendingBossSpawns; i += 1) {
      this.spawnBossEnemy();
    }
  }

  processDirectorMiniBossSpawns() {
    if (this.hasActiveMiniBoss()) {
      return;
    }
    const pendingMiniBossSpawns = this.director.consumeMiniBossSpawnRequests();
    for (let i = 0; i < Math.min(1, pendingMiniBossSpawns); i += 1) {
      this.spawnMiniBossEnemy();
    }
  }

  processDirectorSpawnBursts() {
    const pendingBurstSpawns = this.director.consumeSpawnBurstRequests();
    for (let i = 0; i < pendingBurstSpawns; i += 1) {
      this.spawnEnemyFromEdge();
    }
  }

  processDirectorLadderSpawns() {
    const pendingLadderSpawns = this.director.consumeLadderSpawnRequests();
    if (pendingLadderSpawns <= 0) {
      return;
    }
    this.logSpawnEventPressure("LADDER", pendingLadderSpawns);

    for (let i = 0; i < pendingLadderSpawns; i += 1) {
      const lane = this.director.chooseLadderLane();
      this.spawnEnemyFromEventPoint(lane, this.getLadderSpawnPoint(lane), "ladder");
    }
  }

  processDirectorHatchBreaches() {
    const pendingHatchSpawns = this.director.consumeHatchBreachSpawnRequests();
    if (pendingHatchSpawns <= 0) {
      return;
    }
    this.logSpawnEventPressure("HATCH", pendingHatchSpawns);

    this.showHudAlert("HATCH BREACH", 1000);
    for (let i = 0; i < pendingHatchSpawns; i += 1) {
      this.spawnEnemyFromEventPoint(SPAWN_LANES.STERN, HATCH_BREACH_POINT, "hatch");
    }
  }

  logSpawnEventPressure(eventType, requestedCount) {
    if (!this.debugOverlayEnabled) {
      return;
    }
    const alive = this.getAliveEnemyCount();
    const target = this.targetEnemies;
    const runTime = this.formatRunTime(this.runTimeMs);
    console.info(`[SpawnEvent] t=${runTime} type=${eventType} requested=${requestedCount} alive=${alive} target=${target}`);
  }

  getLadderSpawnPoint(lane) {
    const candidates = LADDER_SPAWN_POINTS[lane] ?? LADDER_SPAWN_POINTS[SPAWN_LANES.PORT];
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  isObstacleBlockedAt(x, y, padding = 18) {
    return this.terrainObstacleAnchors.some((anchor) => {
      const distance = Phaser.Math.Distance.Between(anchor.x, anchor.y, x, y);
      return distance < anchor.radius + padding;
    });
  }

  isValidEventSpawnPoint(x, y) {
    const inBounds = x >= 12 && x <= WORLD_WIDTH - 12 && y >= 12 && y <= WORLD_HEIGHT - 12;
    if (!inBounds) {
      return false;
    }
    const isOutsideSafeRadius = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) > this.safeRadius;
    if (!isOutsideSafeRadius) {
      return false;
    }
    return !this.isObstacleBlockedAt(x, y, 20);
  }

  spawnEnemyFromEventPoint(lane, anchor, eventType = "ladder") {
    if (!anchor || this.getAliveEnemyCount() >= PERFORMANCE_MAX_ACTIVE_ENEMIES) {
      return null;
    }

    const type = this.pickEnemyArchetype();
    const spreadMin = eventType === "hatch" ? 28 : 16;
    const spreadMax = eventType === "hatch" ? 86 : 52;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(spreadMin, spreadMax);
      const x = Phaser.Math.Clamp(anchor.x + Math.cos(angle) * distance, 12, WORLD_WIDTH - 12);
      const y = Phaser.Math.Clamp(anchor.y + Math.sin(angle) * distance, 12, WORLD_HEIGHT - 12);
      if (!this.isValidEventSpawnPoint(x, y)) {
        continue;
      }
      return this.spawnEnemyAtPosition(type, x, y, lane);
    }

    const fallback = this.getSpawnPosition(lane);
    if (!this.isValidSpawnPoint(fallback.x, fallback.y)) {
      return null;
    }
    return this.spawnEnemyAtPosition(type, fallback.x, fallback.y, lane);
  }

  spawnEnemyAtPosition(type, x, y, lane = null) {
    if (this.getAliveEnemyCount() >= PERFORMANCE_MAX_ACTIVE_ENEMIES) {
      return null;
    }
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    const baseHp = ENEMY_ARCHETYPE_CONFIGS[type]?.hp ?? ENEMY_ARCHETYPE_CONFIGS.chaser.hp;
    const scaledHp = Math.max(1, Math.round(baseHp * hpMultiplier));
    const enemy = this.enemyPool.acquire(type, { x, y, hp: scaledHp });
    if (!enemy) {
      return null;
    }

    enemy.setData("lastDashHitId", -1);
    enemy.setData("archetype", type);
    enemy.setData("spawnLane", lane);

    const eliteChance = this.director.getEliteChance();
    const isElite = type !== "swarm" && Math.random() < eliteChance;
    enemy.setData("isElite", isElite);
    enemy.setData("eliteType", null);
    if (isElite) {
      const eliteType = this.pickEliteType();
      enemy.setData("eliteType", eliteType);
      enemy.setElite(eliteType);
    }

    return enemy;
  }

  getOppositeBossEntryLane(lane) {
    if (lane === SPAWN_LANES.BOW) {
      return SPAWN_LANES.STERN;
    }
    return SPAWN_LANES.BOW;
  }

  getBossEntrySpawn(preferredLane = null) {
    const safePreferredLane = BOSS_ENTRY_LANES.includes(preferredLane) ? preferredLane : Phaser.Utils.Array.GetRandom(BOSS_ENTRY_LANES);
    const fallbackLane = this.getOppositeBossEntryLane(safePreferredLane);
    const primary = this.getSpawnPosition(safePreferredLane);
    if (this.isValidSpawnPoint(primary.x, primary.y)) {
      return { lane: safePreferredLane, position: primary };
    }

    const fallback = this.getSpawnPosition(fallbackLane);
    return {
      lane: fallbackLane,
      position: fallback
    };
  }

  spawnBossEnemy(preferredLane = null) {
    const spawn = this.getBossEntrySpawn(preferredLane);
    const lane = spawn.lane;
    const spawnPosition = spawn.position;
    const boss = new BossEnemy(this, spawnPosition.x, spawnPosition.y);
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    boss.hp = Math.max(1, Math.round(boss.hp * hpMultiplier));
    boss.setData("lastDashHitId", -1);
    boss.setData("archetype", "boss");
    boss.setData("spawnLane", lane);
    this.enemies.add(boss);

    this.cameras.main.shake(210, 0.0048);
    this.showHudAlert("BOSS INCOMING");
  }

  spawnMiniBossEnemy(preferredLane = null) {
    const spawn = this.getBossEntrySpawn(preferredLane);
    const lane = spawn.lane;
    const spawnPosition = spawn.position;
    const miniBoss = new BossEnemy(this, spawnPosition.x, spawnPosition.y, { variant: "mini" });
    const hpMultiplier = this.director.getEnemyHpMultiplier();
    miniBoss.hp = Math.max(1, Math.round(miniBoss.hp * hpMultiplier));
    miniBoss.setData("lastDashHitId", -1);
    miniBoss.setData("archetype", "mini_boss");
    miniBoss.setData("spawnLane", lane);
    this.enemies.add(miniBoss);

    this.cameras.main.shake(160, 0.0036);
    this.showHudAlert("MINI BOSS");
  }

  createHudAlertPool() {
    this.hudAlertPool = [];
    for (let i = 0; i < HUD_ALERT_POOL_SIZE; i += 1) {
      const text = this.add
        .text(640, 74, "", HUD_ALERT_STYLE)
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(25)
        .setVisible(false)
        .setActive(false);
      text.setData("alertKind", null);
      text.setData("alertTween", null);
      text.setData("alertHideEvent", null);
      this.hudAlertPool.push(text);
    }
  }

  releaseHudAlertText(text) {
    if (!text) {
      return;
    }

    const alertTween = text.getData("alertTween");
    if (alertTween) {
      alertTween.stop();
    }
    const hideEvent = text.getData("alertHideEvent");
    if (hideEvent) {
      hideEvent.remove(false);
    }

    text.setData("alertTween", null);
    text.setData("alertHideEvent", null);
    text.setData("alertKind", null);
    text.setAlpha(1);
    text.setScale(1);
    text.setVisible(false);
    text.setActive(false);
  }

  acquireHudAlertText(kind) {
    if (!Array.isArray(this.hudAlertPool) || this.hudAlertPool.length === 0) {
      return null;
    }

    let text = this.hudAlertPool.find((entry) => entry.active && entry.getData("alertKind") === kind);
    if (!text) {
      text = this.hudAlertPool.find((entry) => !entry.active);
    }
    if (!text) {
      text = this.hudAlertPool[0];
    }
    if (!text) {
      return null;
    }

    this.releaseHudAlertText(text);
    text.setData("alertKind", kind);
    text.setVisible(true);
    text.setActive(true);
    return text;
  }

  showHudAlert(message, durationMs = 1600) {
    const text = this.acquireHudAlertText("center_alert");
    if (!text) {
      return;
    }

    text.setStyle(HUD_ALERT_STYLE);
    text.setPosition(640, 74);
    text.setDepth(20);
    text.setText(message);

    const hideEvent = this.time.delayedCall(durationMs, () => {
      this.releaseHudAlertText(text);
    });
    text.setData("alertHideEvent", hideEvent);
  }

  updateBossApproachWarning() {
    const intervalMs = DIRECTOR_BOSS_SPAWN.intervalMs;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }

    const nextBossCycleIndex = Math.floor(this.runTimeMs / intervalMs) + 1;
    const nextBossAtMs = nextBossCycleIndex * intervalMs;
    const remainingMs = nextBossAtMs - this.runTimeMs;
    if (remainingMs > BOSS_WARNING_LEAD_MS || remainingMs <= 0) {
      return;
    }
    if (this.bossApproachWarnedCycleIndex === nextBossCycleIndex) {
      return;
    }

    this.bossApproachWarnedCycleIndex = nextBossCycleIndex;
    this.playSfx("boss_warning");
    this.showHudAlert("BOSS APPROACHING", 1500);
  }

  lerpColor(fromHex, toHex, t) {
    const blend = Phaser.Math.Clamp(t, 0, 1);
    const fromR = (fromHex >> 16) & 0xff;
    const fromG = (fromHex >> 8) & 0xff;
    const fromB = fromHex & 0xff;
    const toR = (toHex >> 16) & 0xff;
    const toG = (toHex >> 8) & 0xff;
    const toB = toHex & 0xff;

    const r = Math.round(Phaser.Math.Linear(fromR, toR, blend));
    const g = Math.round(Phaser.Math.Linear(fromG, toG, blend));
    const b = Math.round(Phaser.Math.Linear(fromB, toB, blend));
    return (r << 16) | (g << 8) | b;
  }

  updateDashCooldownRing() {
    if (!this.dashCooldownRingGraphics) {
      return;
    }

    this.dashCooldownRingGraphics.clear();
    if (!this.player?.active) {
      return;
    }

    const x = this.player.x;
    const y = this.player.y;
    const radius = 26;
    const dashRatio = Phaser.Math.Clamp(this.player.getDashRatio(), 0, 1);
    const nowMs = this.time?.now ?? 0;
    const isReady = dashRatio >= 1 && !this.player.isDashing();

    this.dashCooldownRingGraphics.lineStyle(2, 0x14253b, 0.7);
    this.dashCooldownRingGraphics.strokeCircle(x, y, radius);

    if (isReady) {
      const pulse = (Math.sin(nowMs / 130) + 1) / 2;
      const glowColor = this.lerpColor(0xffd166, 0xffffff, pulse * 0.65);
      this.dashCooldownRingGraphics.lineStyle(4, glowColor, 0.24 + pulse * 0.28);
      this.dashCooldownRingGraphics.strokeCircle(x, y, radius + 4 + pulse * 1.2);
    }

    if (dashRatio <= 0) {
      return;
    }

    const ringColor = isReady ? 0xffd166 : 0x7fd8ff;
    const ringAlpha = isReady ? 1 : 0.92;
    this.dashCooldownRingGraphics.lineStyle(3, ringColor, ringAlpha);
    this.dashCooldownRingGraphics.beginPath();
    this.dashCooldownRingGraphics.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashRatio, false);
    this.dashCooldownRingGraphics.strokePath();
  }

  spawnDamageNumber(x, y, amount, enemy = null) {
    const safeAmount = Math.max(0, Math.round(amount ?? 0));
    if (safeAmount <= 0) {
      return;
    }

    const isBoss = Boolean(enemy?.getData?.("isBoss")) || enemy?.type === "boss";
    const isElite = Boolean(enemy?.isElite);
    const textColor = isBoss ? "#ff3b3b" : isElite ? "#ffb347" : "#ffffff";

    let text = this.damageNumberPool.find((entry) => !entry.active);
    if (!text) {
      text = this.add
        .text(x, y, "", {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#ffffff",
          stroke: "#2f1c14",
          strokeThickness: 4
        })
        .setOrigin(0.5)
        .setDepth(18)
        .setVisible(false)
        .setActive(false);
      this.damageNumberPool.push(text);
    }

    const prevTween = text.getData("damageTween");
    if (prevTween) {
      prevTween.stop();
    }
    const prevPopTween = text.getData("damagePopTween");
    if (prevPopTween) {
      prevPopTween.stop();
    }

    text.setText(`${safeAmount}`);
    text.setStyle({
      fontSize: isBoss ? "20px" : isElite ? "18px" : "16px",
      color: textColor
    });
    text.setPosition(x, y);
    text.setAlpha(1);
    text.setScale(1);
    text.setVisible(true);
    text.setActive(true);

    const popTween = this.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => {
        text.setData("damagePopTween", null);
      }
    });
    text.setData("damagePopTween", popTween);

    const tween = this.tweens.add({
      targets: text,
      y: y - (isElite ? 36 : 28),
      alpha: 0,
      duration: isElite ? 420 : 320,
      ease: "Cubic.easeOut",
      onComplete: () => {
        text.setVisible(false);
        text.setActive(false);
        text.setData("damageTween", null);
        text.setData("damagePopTween", null);
      }
    });
    text.setData("damageTween", tween);
  }

  formatRunTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  getWeaponSlotLabel(weapon) {
    const baseType = weapon?.baseType ?? weapon?.type ?? "";
    if (baseType === "dagger") return "D";
    if (baseType === "fireball") return "F";
    if (baseType === "lightning") return "L";
    if (baseType === "meteor") return "M";
    if (baseType === "orbit_blades") return "O";
    return "?";
  }

  loadSpawnPacingPresetKey() {
    if (typeof window === "undefined" || !window.localStorage) {
      return PLAYTEST_SPAWN_PACING_DEFAULT;
    }

    const saved = window.localStorage.getItem(PLAYTEST_SPAWN_PACING_STORAGE_KEY);
    if (saved && PLAYTEST_SPAWN_PACING_PRESETS[saved]) {
      return saved;
    }
    return PLAYTEST_SPAWN_PACING_DEFAULT;
  }

  saveSpawnPacingPresetKey(key) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(PLAYTEST_SPAWN_PACING_STORAGE_KEY, key);
  }

  applySpawnPacingPreset(key) {
    const preset = PLAYTEST_SPAWN_PACING_PRESETS[key];
    if (!preset) {
      return false;
    }

    this.spawnPacingPresetKey = key;
    this.spawnPacingPreset = preset;
    this.baseSpawnCheckIntervalMs = Math.max(60, BASE_SPAWN_CHECK_INTERVAL_MS * (preset.spawnIntervalScale ?? 1));
    this.saveSpawnPacingPresetKey(key);
    return true;
  }

  cycleSpawnPacingPresetAtRunStart() {
    if (this.runTimeMs > 0) {
      this.showHudAlert("PACING LOCKED IN RUN", 900);
      return;
    }

    const currentIdx = Math.max(0, PLAYTEST_SPAWN_PACING_ORDER.indexOf(this.spawnPacingPresetKey));
    const nextKey = PLAYTEST_SPAWN_PACING_ORDER[(currentIdx + 1) % PLAYTEST_SPAWN_PACING_ORDER.length];
    if (!this.applySpawnPacingPreset(nextKey)) {
      return;
    }
    this.showHudAlert(`PACING ${nextKey}`, 1000);
    this.maintainEnemyDensity();
    this.updateDebugDirectorOverlay();
  }

  toggleDebugOverlay() {
    this.debugOverlayEnabled = !this.debugOverlayEnabled;
    this.debugOverlayPanel?.setVisible(this.debugOverlayEnabled);
    this.debugDirectorText?.setVisible(this.debugOverlayEnabled);
    this.showHudAlert(this.debugOverlayEnabled ? "DEBUG HUD ON" : "DEBUG HUD OFF", 850);
  }

  toggleCameraFollow() {
    if (!this.player || !this.cameras?.main) {
      return;
    }
    const camera = this.cameras.main;
    this.cameraFollowEnabled = !this.cameraFollowEnabled;
    if (this.cameraFollowEnabled) {
      camera.startFollow(this.player, true, 0.08, 0.08);
    } else {
      camera.stopFollow();
    }
    this.showHudAlert(this.cameraFollowEnabled ? "CAM FOLLOW ON" : "CAM FOLLOW OFF", 900);
  }

  handlePlaytestHotkeys() {
    if (!this.keys) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.debugToggle)) {
      this.toggleDebugOverlay();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pacingPreset)) {
      this.cycleSpawnPacingPresetAtRunStart();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.cameraToggle)) {
      this.toggleCameraFollow();
    }
  }

  updateDebugDirectorOverlay() {
    if (!this.debugDirectorText || !this.director || !this.debugOverlayEnabled) {
      return;
    }

    const alive = this.getAliveEnemyCount();
    const spawnRateMultiplier = this.getEffectiveSpawnRateMultiplier();
    const spawnIntervalMs = this.baseSpawnCheckIntervalMs / Math.max(0.2, spawnRateMultiplier);
    const eliteChance = this.director.getEliteChance();
    const weaponCount = this.player?.weapons?.length ?? 0;
    const passiveCount = Object.keys(this.player?.passives ?? {}).length;
    const metaLiveTotal = (this.metaData?.currency ?? 0) + (this.runMetaCurrency ?? 0);
    this.debugDirectorText.setText(
      [
        `Enemies: ${alive}/${this.targetEnemies}`,
        `Pacing: ${this.spawnPacingPresetKey}`,
        `EliteChance: ${(eliteChance * 100).toFixed(1)}%`,
        `SpawnInterval: ${Math.round(spawnIntervalMs)}ms`,
        `Build: WPN ${weaponCount} / PAS ${passiveCount} / META ${metaLiveTotal}`,
        `GameTime: ${this.formatRunTime(this.runTimeMs)}`
      ].join("\n")
    );
  }

  getOffscreenIndicatorColor(enemy) {
    if (enemy?.getData?.("isBoss")) {
      return 0xff3b3b;
    }
    if (enemy?.isElite) {
      return 0xffb347;
    }
    return 0xffffff;
  }

  acquireOffscreenIndicator() {
    let marker = this.offscreenIndicatorPool.find((entry) => !entry.active);
    if (marker) {
      return marker;
    }

    const size = OFFSCREEN_INDICATOR_SIZE;
    marker = this.add
      .triangle(
        0,
        0,
        size,
        0,
        -size * 0.78,
        -size * 0.66,
        -size * 0.78,
        size * 0.66,
        0xffffff,
        0.95
      )
      .setScrollFactor(0)
      .setDepth(19)
      .setVisible(false)
      .setActive(false);
    this.offscreenIndicatorPool.push(marker);
    return marker;
  }

  selectOffscreenIndicatorTargets(view, centerX, centerY) {
    const selected = [];
    const normalCandidates = [];
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy?.active) {
        return;
      }
      if (Phaser.Geom.Rectangle.Contains(view, enemy.x, enemy.y)) {
        return;
      }

      const dx = enemy.x - centerX;
      const dy = enemy.y - centerY;
      const distSq = dx * dx + dy * dy;
      const isBoss = Boolean(enemy.getData?.("isBoss"));
      const isElite = Boolean(enemy.isElite);
      const priorityBonus = isBoss ? OFFSCREEN_PRIORITY_BONUS_BOSS : isElite ? OFFSCREEN_PRIORITY_BONUS_ELITE : 0;
      const score = distSq - priorityBonus;
      const candidate = { enemy, score };

      if (priorityBonus > 0) {
        selected.push(candidate);
      } else {
        normalCandidates.push(candidate);
      }
    });

    selected.sort((a, b) => a.score - b.score);
    if (selected.length >= OFFSCREEN_INDICATOR_MAX) {
      return selected.slice(0, OFFSCREEN_INDICATOR_MAX).map((entry) => entry.enemy);
    }

    normalCandidates.sort((a, b) => a.score - b.score);
    const remaining = OFFSCREEN_INDICATOR_MAX - selected.length;
    return selected
      .concat(normalCandidates.slice(0, remaining))
      .map((entry) => entry.enemy);
  }

  updateOffscreenEnemyIndicators() {
    if (!this.cameras?.main) {
      return;
    }

    if (this.offscreenIndicatorGraphics) {
      this.offscreenIndicatorGraphics.clear();
    }
    this.offscreenIndicatorPool.forEach((marker) => {
      marker.setVisible(false);
      marker.setActive(false);
    });

    const cam = this.cameras.main;
    const view = cam.worldView;
    const sw = cam.width;
    const sh = cam.height;
    const centerX = view.centerX;
    const centerY = view.centerY;
    const edgeMinX = OFFSCREEN_INDICATOR_INSET;
    const edgeMaxX = sw - OFFSCREEN_INDICATOR_INSET;
    const edgeMinY = OFFSCREEN_INDICATOR_INSET;
    const edgeMaxY = sh - OFFSCREEN_INDICATOR_INSET;

    const targetX = this.player?.x ?? centerX;
    const targetY = this.player?.y ?? centerY;
    const offscreenTargets = this.selectOffscreenIndicatorTargets(view, targetX, targetY);

    offscreenTargets.forEach((enemy) => {
      const dx = enemy.x - centerX;
      const dy = enemy.y - centerY;
      const length = Math.hypot(dx, dy);
      if (length < 0.0001) {
        return;
      }
      const nx = dx / length;
      const ny = dy / length;

      const scaleX = nx !== 0 ? (nx > 0 ? edgeMaxX - sw / 2 : edgeMinX - sw / 2) / nx : Number.POSITIVE_INFINITY;
      const scaleY = ny !== 0 ? (ny > 0 ? edgeMaxY - sh / 2 : edgeMinY - sh / 2) / ny : Number.POSITIVE_INFINITY;
      const t = Math.min(Math.abs(scaleX), Math.abs(scaleY));
      const screenX = sw / 2 + nx * t;
      const screenY = sh / 2 + ny * t;
      const marker = this.acquireOffscreenIndicator();
      marker.setPosition(screenX, screenY);
      marker.setRotation(Math.atan2(ny, nx));
      marker.setFillStyle(this.getOffscreenIndicatorColor(enemy), 0.95);
      marker.setVisible(true);
      marker.setActive(true);
    });
  }

  getSpawnCandidateForLane(lane, view) {
    const rule = SPAWN_LANE_RULES[lane];
    if (!rule) {
      return null;
    }

    const width = Math.max(1, view.right - view.left);
    const height = Math.max(1, view.bottom - view.top);
    const rangeStart = Phaser.Math.Clamp(rule.rangeStart ?? 0, 0, 1);
    const rangeEnd = Phaser.Math.Clamp(rule.rangeEnd ?? 1, rangeStart, 1);
    const offset = Math.max(24, Number(rule.offscreenOffset) || 90);

    let x = view.centerX;
    let y = view.centerY;
    if (rule.edge === "top") {
      x = Phaser.Math.Between(view.left + width * rangeStart, view.left + width * rangeEnd);
      y = view.top - offset;
    } else if (rule.edge === "bottom") {
      x = Phaser.Math.Between(view.left + width * rangeStart, view.left + width * rangeEnd);
      y = view.bottom + offset;
    } else if (rule.edge === "left") {
      x = view.left - offset;
      y = Phaser.Math.Between(view.top + height * rangeStart, view.top + height * rangeEnd);
    } else if (rule.edge === "right") {
      x = view.right + offset;
      y = Phaser.Math.Between(view.top + height * rangeStart, view.top + height * rangeEnd);
    }

    return {
      x: Phaser.Math.Clamp(x, 12, WORLD_WIDTH - 12),
      y: Phaser.Math.Clamp(y, 12, WORLD_HEIGHT - 12),
      lane
    };
  }

  getSpawnPosition(lane = null) {
    const view = this.cameras.main.worldView;
    const hasRequestedLane = Boolean(lane && SPAWN_LANE_RULES[lane]);
    const lanes = hasRequestedLane ? [lane] : SPAWN_LANE_KEYS;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const laneForAttempt = hasRequestedLane ? lane : Phaser.Utils.Array.GetRandom(lanes);
      const candidate = this.getSpawnCandidateForLane(laneForAttempt, view);
      if (!candidate) {
        continue;
      }
      if (this.isValidSpawnPoint(candidate.x, candidate.y)) {
        return candidate;
      }
    }

    const fallbackCandidates = lanes
      .map((laneKey) => this.getSpawnCandidateForLane(laneKey, view))
      .filter(Boolean);

    let best = fallbackCandidates[0] ?? { x: this.player.x, y: this.player.y };
    let bestScore = Number.NEGATIVE_INFINITY;
    fallbackCandidates.forEach((candidate) => {
      const outsideBonus = Phaser.Geom.Rectangle.Contains(view, candidate.x, candidate.y) ? 0 : 100000;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, candidate.x, candidate.y);
      const score = outsideBonus + distance;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });

    return best;
  }

  isValidSpawnPoint(x, y) {
    const view = this.cameras.main.worldView;
    const isOutsideView = !Phaser.Geom.Rectangle.Contains(view, x, y);
    const isOutsideSafeRadius = Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) > this.safeRadius;
    const noObstacleOverlap = !this.isObstacleBlockedAt(x, y, 18);
    return isOutsideView && isOutsideSafeRadius && noObstacleOverlap;
  }

  pickEnemyArchetype() {
    const elapsedSeconds = this.runTimeMs / 1000;
    const availableTypes = ENEMY_TYPE_WEIGHTS.filter((entry) => {
      if (entry.type === "hunter" && elapsedSeconds < HUNTER_UNLOCK_TIME_SEC) {
        return false;
      }
      return true;
    });

    const totalWeight = availableTypes.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < availableTypes.length; i += 1) {
      roll -= availableTypes[i].weight;
      if (roll <= 0) {
        return availableTypes[i].type;
      }
    }

    return "chaser";
  }

  pickEliteType() {
    const roll = Math.random();
    if (roll < 0.34) {
      return "speed_boost";
    }
    if (roll < 0.67) {
      return "dash_attack";
    }
    return "poison_aura";
  }

  handlePlayerEnemyCollision(player, enemy) {
    if (!enemy || typeof enemy.takeDamage !== "function" || typeof enemy.applyKnockbackFrom !== "function") {
      return;
    }

    if (player.isDashing()) {
      const lastDashHitId = enemy.getData("lastDashHitId") ?? -1;
      if (lastDashHitId !== player.currentDashId) {
        enemy.setData("lastDashHitId", player.currentDashId);
        enemy.takeDamage(player.dashDamage);
        enemy.applyKnockbackFrom(player.x, player.y, 360);
        this.cameras.main.shake(80, 0.003);

        if (enemy.isDead()) {
          this.handleEnemyDefeat(enemy);
        }
      }

      if (player.isDashInvulnerable()) {
        return;
      }
    }

    const damaged = player.takeDamage(enemy.damage, this.time.now);
    if (!damaged) {
      return;
    }
    this.cameras.main.shake(85, 0.0019);

    if (!player.isDead()) {
      return;
    }
    this.triggerGameOver();
  }

  handleBossProjectileHit(player, projectile) {
    if (!projectile?.active || !player?.active) {
      return;
    }

    const damage = Math.max(1, Math.round(projectile.getData("damage") ?? 12));
    this.releaseBossProjectile(projectile);

    if (player.isDashInvulnerable()) {
      return;
    }

    const damaged = player.takeDamage(damage, this.time.now);
    if (!damaged) {
      return;
    }
    this.cameras.main.shake(65, 0.0016);

    if (player.isDead()) {
      this.triggerGameOver();
    }
  }

  showBossRadialWarning(boss, durationMs = 1000) {
    if (!boss?.active) {
      return;
    }

    const indicatorY = boss.y - Math.max(42, boss.displayHeight * 0.45);
    const warningText = this.add
      .text(boss.x, indicatorY, "RADIAL BURST", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffd1d1",
        stroke: "#3f0f0f",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(22);

    this.tweens.add({
      targets: warningText,
      y: indicatorY - 16,
      alpha: 0,
      duration: Math.max(120, durationMs),
      ease: "Cubic.easeOut",
      onComplete: () => warningText.destroy()
    });
  }

  acquireBossProjectile() {
    if (!this.bossProjectiles) {
      return null;
    }

    let projectile = this.bossProjectiles.getFirstDead(false);
    if (!projectile) {
      if (this.bossProjectiles.getLength() >= BOSS_BULLET_MAX) {
        return null;
      }
      projectile = this.bossProjectiles.create(-1000, -1000, "boss_bullet");
      if (!projectile?.body) {
        return null;
      }
      projectile.body.setCircle(Math.max(2, projectile.displayWidth * 0.42), 0, 0);
      projectile.setDepth(8);
    }

    projectile.setActive(true);
    projectile.setVisible(true);
    projectile.body.enable = true;
    return projectile;
  }

  releaseBossProjectile(projectile) {
    if (!projectile) {
      return;
    }
    if (projectile.body) {
      projectile.body.setVelocity(0, 0);
      projectile.body.enable = false;
    }
    projectile.setActive(false);
    projectile.setVisible(false);
    projectile.setPosition(-1000, -1000);
  }

  spawnBossRadialBurst(boss, bulletCount = 12, bulletSpeed = 220) {
    if (!boss?.active || this.isGameOver) {
      return;
    }

    const safeCount = Math.max(3, Math.min(32, Math.floor(bulletCount || 12)));
    const safeSpeed = Math.max(80, Math.min(420, Number(bulletSpeed) || 220));
    const damagePerBullet = Math.max(8, Math.round((boss.damage ?? 24) * 0.45));
    const nowMs = this.time?.now ?? 0;
    for (let i = 0; i < safeCount; i += 1) {
      const projectile = this.acquireBossProjectile();
      if (!projectile || !projectile.body) {
        continue;
      }

      const angle = (Math.PI * 2 * i) / safeCount;
      const vx = Math.cos(angle) * safeSpeed;
      const vy = Math.sin(angle) * safeSpeed;
      projectile.enableBody(true, boss.x, boss.y, true, true);
      projectile.body.setVelocity(vx, vy);
      projectile.setData("damage", damagePerBullet);
      projectile.setData("expireAtMs", nowMs + BOSS_BULLET_LIFETIME_MS);
    }
  }

  updateBossProjectiles(nowMs) {
    if (!this.bossProjectiles) {
      return;
    }

    this.bossProjectiles.getChildren().forEach((projectile) => {
      if (!projectile?.active) {
        return;
      }

      const expireAtMs = projectile.getData("expireAtMs") ?? 0;
      const outOfBounds =
        projectile.x < -30 || projectile.y < -30 || projectile.x > WORLD_WIDTH + 30 || projectile.y > WORLD_HEIGHT + 30;
      if (nowMs >= expireAtMs || outOfBounds) {
        this.releaseBossProjectile(projectile);
      }
    });
  }

  performAutoAttack(now) {
    if (now - this.lastAttackAt < this.attackIntervalMs) {
      return;
    }

    let nearestEnemy = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) {
        return;
      }
      if (enemy.getData("isDying") || enemy.isDead?.()) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance > this.attackRange || distance >= nearestDistance) {
        return;
      }

      nearestDistance = distance;
      nearestEnemy = enemy;
    });

    if (!nearestEnemy) {
      return;
    }

    this.lastAttackAt = now;
    if (typeof nearestEnemy.takeDamage !== "function" || typeof nearestEnemy.applyKnockbackFrom !== "function") {
      return;
    }
    nearestEnemy.takeDamage(this.attackDamage);
    nearestEnemy.applyKnockbackFrom(this.player.x, this.player.y, 140);

    const flash = this.add.graphics();
    flash.lineStyle(2, 0x89e8ff, 1);
    flash.lineBetween(this.player.x, this.player.y, nearestEnemy.x, nearestEnemy.y);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 90,
      onComplete: () => flash.destroy()
    });

    if (nearestEnemy.isDead()) {
      this.handleEnemyDefeat(nearestEnemy);
    }
  }

  spawnXpOrb(x, y, value, config = {}) {
    const texture = config.texture ?? "xp_orb";
    const orb = this.xpOrbs.create(x, y, texture);
    if (!orb) {
      return;
    }
    const radius = config.radius ?? (config.pickupType === "elite_upgrade" ? 8 : 6);
    orb.setCircle?.(radius, 0, 0);
    orb.setDepth(config.pickupType === "elite_upgrade" ? 7 : 5);
    orb.setScale(config.pickupType === "elite_upgrade" ? 1.18 : 1.1);
    orb.setAlpha(config.pickupType === "elite_upgrade" ? 1 : 0.96);
    orb.xpValue = value;
    if (config.pickupType) {
      orb.setData("pickupType", config.pickupType);
    } else {
      orb.setData("pickupType", null);
    }
    orb.setData("rewardUpgradeId", config.rewardUpgradeId ?? null);
    orb.setData("rewardCoins", Math.max(0, Math.floor(Number(config.rewardCoins) || 0)));
  }

  spawnEliteBonusXpOrbs(enemy) {
    const orbCount = Phaser.Math.Between(ELITE_BONUS_XP_ORB_MIN, ELITE_BONUS_XP_ORB_MAX);
    const perOrbValue = Math.max(3, Math.round((enemy.xpValue ?? 10) * ELITE_BONUS_XP_ORB_VALUE_FACTOR));
    for (let i = 0; i < orbCount; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(10, 26);
      const x = enemy.x + Math.cos(angle) * distance;
      const y = enemy.y + Math.sin(angle) * distance;
      this.spawnXpOrb(x, y, perOrbValue);
    }
  }

  spawnEliteUpgradePickup(x, y) {
    if (Math.random() >= ELITE_UPGRADE_DROP_CHANCE) {
      return false;
    }

    const rewardUpgradeId = Phaser.Utils.Array.GetRandom(ELITE_BONUS_UPGRADE_IDS);
    this.spawnXpOrb(x, y, 0, {
      texture: "upgrade_orb",
      pickupType: "elite_upgrade",
      rewardUpgradeId,
      radius: 8
    });
    return true;
  }

  spawnMiniBossRewardDrops(enemy) {
    const goldBundle = MINI_BOSS_GOLD_BUNDLE;
    const xpBase = Math.max(4, Math.round(enemy.xpValue ?? 20));
    const centerX = enemy.x;
    const centerY = enemy.y;

    this.spawnXpOrb(centerX, centerY, 0, {
      texture: "upgrade_orb",
      pickupType: "mini_boss_gold",
      rewardCoins: goldBundle,
      radius: 8
    });

    for (let i = 0; i < MINI_BOSS_XP_BURST_COUNT; i += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(14, 42);
      const xpFactor = Phaser.Math.FloatBetween(MINI_BOSS_XP_BURST_MIN_FACTOR, MINI_BOSS_XP_BURST_MAX_FACTOR);
      const xpValue = Math.max(3, Math.round(xpBase * xpFactor));
      this.spawnXpOrb(centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance, xpValue);
    }
  }

  applyEliteUpgradeReward(rewardUpgradeId) {
    const rewardUpgrade = LEVEL_UP_UPGRADES.find((upgrade) => upgrade.id === rewardUpgradeId);
    if (!rewardUpgrade) {
      return false;
    }
    this.applyLevelUpUpgrade(rewardUpgrade);
    this.showHudAlert(`ELITE ${rewardUpgrade.label.toUpperCase()}`, 1200);
    return true;
  }

  updateKillCombo() {
    const nowMs = this.time?.now ?? 0;
    if (nowMs - this.lastKillAtMs > COMBO_RESET_WINDOW_MS) {
      this.killCombo = 0;
    }
    this.killCombo += 1;
    this.maxKillCombo = Math.max(this.maxKillCombo, this.killCombo);
    this.lastKillAtMs = nowMs;

    if (this.killCombo < 3) {
      return;
    }

    let label = `x${this.killCombo} COMBO`;
    if (this.killCombo >= 10) {
      label = `x${this.killCombo} RAMPAGE`;
    }

    const comboText = this.acquireHudAlertText("combo");
    if (!comboText) {
      return;
    }

    comboText.setStyle(HUD_COMBO_STYLE);
    comboText.setPosition(640, 198);
    comboText.setDepth(25);
    comboText.setText(label);
    comboText.setAlpha(1);
    comboText.setScale(COMBO_TEXT_SCALE);

    const tween = this.tweens.add({
      targets: comboText,
      y: 176,
      scale: COMBO_TEXT_SCALE * 1.05,
      alpha: 0,
      duration: COMBO_TEXT_FADE_TIME_MS,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.releaseHudAlertText(comboText);
      }
    });
    comboText.setData("alertTween", tween);
  }

  handleEnemyDefeat(enemy) {
    if (!enemy || !enemy.active) {
      return;
    }
    if (enemy.getData("isDying")) {
      return;
    }
    enemy.setData("isDying", true);
    if (enemy.body) {
      enemy.body.setVelocity(0, 0);
      enemy.body.enable = false;
    }
    this.totalKills += 1;
    this.playKillCounterPulse();
    this.recordKillEvent();

    this.updateKillCombo();

    this.playSfx("enemy_death", { elite: enemy.isElite });
    if (enemy.isElite) {
      this.spawnEliteKillParticles(enemy.x, enemy.y, 20);
    }
    this.spawnKillParticles(enemy.x, enemy.y, enemy.isElite ? 14 : 10);
    const archetype = enemy.getData("archetype");
    if (archetype === "mini_boss" || enemy.getData("bossVariant") === "mini") {
      this.spawnMiniBossRewardDrops(enemy);
      this.showHudAlert("MINI BOSS LOOT", 1200);
    } else {
      this.spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);
    }
    if (enemy.isElite) {
      this.spawnEliteBonusXpOrbs(enemy);
      const droppedUpgrade = this.spawnEliteUpgradePickup(enemy.x, enemy.y);
      if (droppedUpgrade) {
        this.showHudAlert("ELITE LOOT", 1000);
      }
    }

    this.tweens.add({
      targets: enemy,
      scaleX: enemy.scaleX * 1.3,
      scaleY: enemy.scaleY * 1.3,
      alpha: 0,
      duration: 120,
      ease: "Quad.easeOut",
      onComplete: () => {
        enemy.setData("isDying", false);
        enemy.setAlpha(1);
        if (enemy.getData("pooledEnemy") === true) {
          this.enemyPool.release(enemy);
          return;
        }
        enemy.destroy();
      }
    });
  }

  handleXpOrbPickup(_, orb) {
    if (!orb.active) {
      return;
    }

    const xpValue = orb.xpValue ?? 0;
    if (xpValue > 0) {
      this.gainXp(xpValue);
    }

    const pickupType = orb.getData("pickupType");
    if (pickupType === "elite_upgrade") {
      this.applyEliteUpgradeReward(orb.getData("rewardUpgradeId"));
    } else if (pickupType === "mini_boss_gold") {
      const rewardCoins = Math.max(0, Math.floor(Number(orb.getData("rewardCoins")) || 0));
      this.runMetaCurrency += rewardCoins;
      this.showHudAlert(`+${rewardCoins} GOLD`, 900);
    }
    orb.destroy();
  }

  gainXp(amount) {
    const baseAmount = Math.max(0, Math.round(amount));
    const effectiveAmount = Math.max(0, Math.round(baseAmount * this.metaXpMultiplier));
    if (effectiveAmount > 0) {
      this.playExpGainPulse();
    }

    this.totalXp += effectiveAmount;
    this.currentXp += effectiveAmount;

    let hasLeveledUp = false;
    while (this.currentXp >= this.xpToNext) {
      this.currentXp -= this.xpToNext;
      this.level += 1;
      this.player.level = this.level;
      this.pendingLevelUps += 1;
      this.xpToNext = this.getXpRequirement(this.level);
      hasLeveledUp = true;
    }

    if (hasLeveledUp) {
      this.playSfx("level_up");
    }

    if (!this.isLeveling && this.pendingLevelUps > 0) {
      this.openLevelUpChoices();
    }
  }

  getXpRequirement(level) {
    if (XP_REQUIREMENTS.byLevel[level] !== undefined) {
      return XP_REQUIREMENTS.byLevel[level];
    }
    return XP_REQUIREMENTS.postL3Base + (level - 3) * XP_REQUIREMENTS.postL3Step;
  }

  playExpGainPulse() {
    if (!this.tweens) {
      return;
    }

    if (this.expBarPulseTween) {
      this.expBarPulseTween.stop();
      this.expBarPulseTween = null;
    }

    this.expBarScaleY = 1;
    this.expBarPulseTween = this.tweens.add({
      targets: this,
      expBarScaleY: HUD_EXP_PULSE_SCALE,
      duration: Math.floor(HUD_EXP_PULSE_DURATION_MS * 0.5),
      ease: "Sine.easeOut",
      yoyo: true,
      onComplete: () => {
        this.expBarScaleY = 1;
        this.expBarPulseTween = null;
      }
    });
  }

  playKillCounterPulse() {
    if (!this.hudGoldText || !this.tweens) {
      return;
    }

    if (this.killCounterPulseTween) {
      this.killCounterPulseTween.stop();
      this.killCounterPulseTween = null;
    }

    this.hudGoldText.setScale(1);
    this.killCounterPulseTween = this.tweens.add({
      targets: this.hudGoldText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 50,
      ease: "Sine.easeOut",
      yoyo: true,
      onComplete: () => {
        this.hudGoldText?.setScale(1);
        this.killCounterPulseTween = null;
      }
    });
  }

  createModalTitle(centerX, centerY, label, config = {}) {
    const snappedX = Math.round(centerX);
    const snappedY = Math.round(centerY);
    const fontSize = Number(config.fontSize ?? 32);
    const badgeHeight = Number(config.badgeHeight ?? 32);
    const paddingX = Number(config.paddingX ?? 26);
    const minWidth = Number(config.minWidth ?? 180);
    const badgeDepth = Number(config.badgeDepth ?? 30.4);
    const textDepth = Number(config.textDepth ?? badgeDepth + 0.6);
    const textStyle = {
      fontFamily: "Arial",
      fontSize: `${fontSize}px`,
      color: config.color ?? "#3a1f11"
    };

    const measureText = this.add
      .text(-1000, -1000, label, textStyle)
      .setVisible(false)
      .setActive(false);
    const badgeWidth = Math.max(minWidth, Math.ceil(measureText.width) + paddingX * 2);
    measureText.destroy();

    const titleChip = this.add
      .rectangle(snappedX, snappedY, badgeWidth, badgeHeight, 0xc19a67, 0.96)
      .setStrokeStyle(2, 0x6d4a31, 0.95)
      .setScrollFactor(0)
      .setDepth(badgeDepth);

    const title = this.add
      .text(snappedX, snappedY, label, textStyle)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(textDepth);

    return { titleChip, title };
  }

  openLevelUpChoices() {
    if (this.pendingLevelUps <= 0) {
      return;
    }

    this.pendingLevelUps -= 1;
    this.isLeveling = true;
    this.levelUpOptionActions = [];
    this.physics.pause();
    this.player.body?.setVelocity(0, 0);
    this.applyHudModalFocus(true);

    const centerX = 640;
    const centerY = 360;
    const panel = this.add
      .rectangle(centerX, centerY, 620, 420, 0x22150d, 0.96)
      .setStrokeStyle(3, 0xb48855, 0.96)
      .setScrollFactor(0)
      .setDepth(30);
    const panelInset = this.add
      .rectangle(centerX, centerY, 596, 396, 0x352215, 0.94)
      .setStrokeStyle(1, 0x6d4a31, 0.88)
      .setScrollFactor(0)
      .setDepth(30.2);
    const { titleChip, title } = this.createModalTitle(centerX, centerY - 162, "LEVEL UP", {
      fontSize: 34,
      minWidth: 208,
      badgeDepth: 30.4,
      textDepth: 31
    });
    const subtitle = this.add
      .text(centerX, centerY - 119, "Choose one upgrade", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#e8d0a5",
        stroke: "#2a1a10",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(31);

    const choices = Phaser.Utils.Array.Shuffle([...LEVEL_UP_UPGRADES]).slice(0, 3);
    const optionObjects = [];

    choices.forEach((upgrade, index) => {
      const y = centerY - 36 + index * 96;
      const box = this.add
        .rectangle(centerX, y, 530, 76, 0x4a2f1d, 0.98)
        .setStrokeStyle(2, 0xb48855, 0.92)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(31);
      const boxInlay = this.add
        .rectangle(centerX, y, 514, 60, 0xead7b7, 0.9)
        .setStrokeStyle(1, 0x6d4a31, 0.6)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(31.2);

      const heading = this.add
        .text(centerX - 244, y - 12, `[${index + 1}] ${upgrade.label}`, {
          fontFamily: "Arial",
          fontSize: "23px",
          color: "#2e170d",
          stroke: "#f7e8cc",
          strokeThickness: 1
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(32);
      const description = this.add
        .text(centerX - 244, y + 14, upgrade.description, {
          fontFamily: "Arial",
          fontSize: "14px",
          color: "#6a4d36",
          stroke: "#f7e8cc",
          strokeThickness: 1
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(32);

      const chooseUpgrade = () => {
        this.applyLevelUpUpgrade(upgrade);
        this.closeLevelUpChoices();
      };
      box.on("pointerdown", chooseUpgrade);
      boxInlay.on("pointerdown", chooseUpgrade);
      heading.setInteractive({ useHandCursor: true }).on("pointerdown", chooseUpgrade);
      description.setInteractive({ useHandCursor: true }).on("pointerdown", chooseUpgrade);
      this.levelUpOptionActions.push(chooseUpgrade);

      optionObjects.push(box, boxInlay, heading, description);
    });

    this.levelUpUi = [panel, panelInset, titleChip, title, subtitle, ...optionObjects];
  }

  handleLevelUpInput() {
    const indexes = [this.keys.meta1, this.keys.meta2, this.keys.meta3];
    for (let i = 0; i < indexes.length; i += 1) {
      if (Phaser.Input.Keyboard.JustDown(indexes[i])) {
        const action = this.levelUpOptionActions[i];
        if (action) {
          action();
        }
      }
    }
  }

  openWeaponSelection() {
    if (this.isWeaponSelecting || this.isGameOver) {
      return;
    }

    this.isWeaponSelecting = true;
    this.weaponSelectionActions = [];
    this.physics.pause();
    this.player.body?.setVelocity(0, 0);
    this.applyHudModalFocus(true);

    const centerX = 640;
    const centerY = 360;
    const panel = this.add
      .rectangle(centerX, centerY, 700, 500, 0x22150d, 0.96)
      .setStrokeStyle(3, 0xb48855, 0.96)
      .setScrollFactor(0)
      .setDepth(35);
    const panelInset = this.add
      .rectangle(centerX, centerY, 672, 470, 0x342214, 0.94)
      .setStrokeStyle(1, 0x6d4a31, 0.88)
      .setScrollFactor(0)
      .setDepth(35.2);
    const { titleChip, title } = this.createModalTitle(
      centerX,
      centerY - 206,
      "SELECT START WEAPON",
      {
        fontSize: 32,
        minWidth: 292,
        badgeDepth: 35.4,
        textDepth: 36
      }
    );

    const coinText = this.add
      .text(centerX, centerY - 168, `Coins: ${this.metaData.currency}`, {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#e2c388",
        stroke: "#2e170d",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(36);

    const subtitle = this.add
      .text(centerX, centerY - 130, "Pick one weapon to begin this run", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#d8bf95",
        stroke: "#2a1a10",
        strokeThickness: 2
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(36);

    const statusText = this.add
      .text(centerX, centerY + 204, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ebd7b7",
        stroke: "#2e170d",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(36);

    const optionRows = [];
    START_WEAPON_OPTIONS.forEach((option, index) => {
      const y = centerY - 60 + index * 86;
      const box = this.add
        .rectangle(centerX, y, 620, 74, 0x4a2f1d, 0.98)
        .setStrokeStyle(2, 0xb48855, 0.92)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(36);
      const boxInlay = this.add
        .rectangle(centerX, y, 604, 58, 0xead7b7, 0.88)
        .setStrokeStyle(1, 0x6d4a31, 0.6)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0)
        .setDepth(36.2);
      const heading = this.add
        .text(centerX - 286, y - 13, `[${index + 1}] ${option.label}`, {
          fontFamily: "Arial",
          fontSize: "24px",
          color: "#2e170d",
          stroke: "#f7e8cc",
          strokeThickness: 1
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(37);
      const detail = this.add
        .text(centerX - 286, y + 15, "", {
          fontFamily: "Arial",
          fontSize: "13px",
          color: "#6a4d36",
          stroke: "#f7e8cc",
          strokeThickness: 1
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(37);

      const refreshOption = () => {
        const unlocked = Boolean(this.weaponUnlocks[option.id]);
        if (unlocked) {
          detail.setText(`Unlocked · Tap to select`);
          detail.setColor("#56714b");
        } else {
          detail.setText(`Locked · Unlock Cost ${option.unlockCost} coins`);
          detail.setColor("#8b5d37");
        }
      };

      const choose = () => {
        const unlocked = Boolean(this.weaponUnlocks[option.id]);
        if (!unlocked) {
          const spent = this.trySpendMetaCoins(option.unlockCost);
          if (!spent) {
            statusText.setText("Not enough coins to unlock this weapon.");
            statusText.setColor("#ffb4b4");
            return;
          }
          this.weaponUnlocks[option.id] = true;
          this.saveWeaponUnlocks(this.weaponUnlocks);
          coinText.setText(`Coins: ${this.metaData.currency}`);
          refreshOption();
        }
        this.selectStartWeapon(option);
      };

      box.on("pointerdown", choose);
      boxInlay.on("pointerdown", choose);
      heading.setInteractive({ useHandCursor: true }).on("pointerdown", choose);
      detail.setInteractive({ useHandCursor: true }).on("pointerdown", choose);
      refreshOption();
      optionRows.push(box, boxInlay, heading, detail);
      this.weaponSelectionActions.push(choose);
    });

    this.weaponSelectionUi = [panel, panelInset, titleChip, title, coinText, subtitle, statusText, ...optionRows];
  }

  handleWeaponSelectionInput() {
    const indexes = [this.keys.meta1, this.keys.meta2, this.keys.meta3, this.keys.meta4];
    for (let i = 0; i < indexes.length; i += 1) {
      if (Phaser.Input.Keyboard.JustDown(indexes[i])) {
        const action = this.weaponSelectionActions[i];
        if (action) {
          action();
        }
      }
    }
  }

  selectStartWeapon(option) {
    if (!option || this.selectedStartWeaponId) {
      return;
    }

    const added = this.weaponSystem.addWeapon(option.weaponType);
    if (!added && this.player.weapons.length === 0) {
      this.weaponSystem.addWeapon("dagger");
    }
    this.selectedStartWeaponId = option.id;
    this.closeWeaponSelection();
    this.showHudAlert(`${option.label.toUpperCase()} READY`, 1000);
  }

  closeWeaponSelection() {
    this.weaponSelectionUi.forEach((obj) => obj.destroy());
    this.weaponSelectionUi = [];
    this.weaponSelectionActions = [];
    this.isWeaponSelecting = false;
    this.applyHudModalFocus(false);

    if (!this.isGameOver && !this.isLeveling) {
      this.physics.resume();
    }
  }

  applyLevelUpUpgrade(upgrade) {
    if (!upgrade) {
      return;
    }

    if (upgrade.id === "weapon_damage") {
      this.weaponSystem.addGlobalDamagePercent(upgrade.value);
      return;
    }
    if (upgrade.id === "attack_speed") {
      this.attackIntervalMs = Math.max(180, Math.floor(this.attackIntervalMs * (1 - upgrade.value)));
      this.weaponSystem.addAttackSpeedPercent(upgrade.value);
      return;
    }
    if (upgrade.id === "projectile_count") {
      this.weaponSystem.addProjectileCount(upgrade.value);
      return;
    }
    if (upgrade.id === "movement_speed") {
      this.player.speed += upgrade.value;
      return;
    }
    if (upgrade.id === "pickup_radius") {
      this.player.pickupRadius += upgrade.value;
    }
  }

  pullXpOrbsToPlayer() {
    const basePickupRadius = Math.max(0, this.player.pickupRadius || 0);
    const levelBonusRadius = Math.max(0, this.level - 1) * XP_MAGNET_RADIUS_PER_LEVEL;
    const pickupRadius = basePickupRadius + levelBonusRadius;
    if (pickupRadius <= 0) {
      return;
    }

    this.xpOrbs.getChildren().forEach((orb) => {
      if (!orb.active || !orb.body) {
        return;
      }

      const dx = this.player.x - orb.x;
      const dy = this.player.y - orb.y;
      const distance = Math.hypot(dx, dy);
      if (distance > pickupRadius) {
        orb.body.setVelocity(0, 0);
        return;
      }

      if (distance <= 120) {
        orb.x += dx * 0.05;
        orb.y += dy * 0.05;
      }

      const nx = distance > 0.0001 ? dx / distance : 0;
      const ny = distance > 0.0001 ? dy / distance : 0;
      const pullStrength = Phaser.Math.Linear(220, 480, 1 - Phaser.Math.Clamp(distance / pickupRadius, 0, 1));
      orb.body.setVelocity(nx * pullStrength, ny * pullStrength);
    });
  }

  closeLevelUpChoices() {
    this.levelUpUi.forEach((obj) => obj.destroy());
    this.levelUpUi = [];
    this.levelUpOptionActions = [];

    this.isLeveling = false;
    this.applyHudModalFocus(false);
    this.physics.resume();

    if (this.pendingLevelUps > 0) {
      this.openLevelUpChoices();
    }
  }

  applyMetaBonusesForRun() {
    const bonuses = this.metaSystem.getRunBonuses();
    const shopUpgrades = this.loadShopUpgradeLevels();
    this.metaXpMultiplier = bonuses.xpMultiplier;

    this.player.maxHp += bonuses.maxHpFlat;
    this.player.hp = this.player.maxHp;
    this.player.speed += bonuses.speedFlat;

    const moveSpeedMultiplier = 1 + shopUpgrades.movement_speed * 0.05;
    this.player.speed = Math.round(this.player.speed * moveSpeedMultiplier);

    const xpMultiplier = 1 + shopUpgrades.xp_gain * 0.1;
    this.metaXpMultiplier *= xpMultiplier;

    const dashCooldownMultiplier = Math.max(0.35, 1 - shopUpgrades.dash_cooldown * 0.05);
    this.player.dashCooldownMs = Math.max(700, Math.round(this.player.dashCooldownMs * dashCooldownMultiplier));
    this.player.dashChargeRate = this.player.dashGaugeMax / (this.player.dashCooldownMs / 1000);

    if (bonuses.startingWeaponBonus > 0) {
      this.weaponSystem.addWeapon("lightning");
    }
  }

  finalizeMetaRun() {
    if (this.metaSettled) {
      return;
    }

    this.metaSettled = true;
    this.lastRunMetaCurrency = this.calculateRunCoinReward();
    this.metaSystem.addCurrency(this.lastRunMetaCurrency);
    this.metaData = this.metaSystem.getData();
    this.saveCoinBank(this.metaData.currency);
    this.runMetaCurrency = 0;
  }

  triggerGameOver() {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.physics.pause();
    this.input.enabled = false;
    this.player.body?.setVelocity(0, 0);
    this.updateBestTimeRecord(this.runTimeMs);
    this.finalizeMetaRun();
    this.refreshGameOverText();
    this.gameOverText.setVisible(false);
    if (this.gameOverRestartButton && this.gameOverRestartLabel) {
      this.gameOverRestartButton.setVisible(false);
      this.gameOverRestartLabel.setVisible(false);
    }

    const summaryPayload = {
      timeSurvivedMs: this.runTimeMs,
      enemiesKilled: this.totalKills,
      maxCombo: this.maxKillCombo,
      levelReached: this.level,
      coinsEarned: this.lastRunMetaCurrency,
      totalCoins: this.metaData.currency
    };
    if (this.scene.isActive("RunSummaryScene")) {
      this.scene.stop("RunSummaryScene");
    }
    this.scene.launch("RunSummaryScene", summaryPayload);
    this.scene.bringToTop("RunSummaryScene");
  }

  handleGameOverInput() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta1)) {
      this.tryPurchaseMetaUpgrade("max_hp");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta2)) {
      this.tryPurchaseMetaUpgrade("move_speed");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta3)) {
      this.tryPurchaseMetaUpgrade("xp_gain");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.meta4)) {
      this.tryPurchaseMetaUpgrade("starting_weapon");
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
      this.restartRun();
    }
  }

  restartRun() {
    if (this.scene.isActive("RunSummaryScene")) {
      this.scene.stop("RunSummaryScene");
    }
    this.scene.restart();
  }

  tryPurchaseMetaUpgrade(upgradeKey) {
    const result = this.metaSystem.purchaseUpgrade(upgradeKey);
    if (!result.success) {
      return;
    }

    this.metaData = this.metaSystem.getData();
    this.saveCoinBank(this.metaData.currency);
    this.refreshGameOverText();
  }

  refreshGameOverText() {
    const options = this.metaSystem.getUpgradeOptions();
    const formatCost = (option) => (option.isMaxed ? "MAX" : `${option.cost}C`);

    this.gameOverText.setText(
      [
        "GAME OVER",
        `COINS +${this.lastRunMetaCurrency}   BANK ${this.metaData.currency}`,
        `[1] Max HP Lv${options.max_hp.level} (${formatCost(options.max_hp)})`,
        `[2] Move Speed Lv${options.move_speed.level} (${formatCost(options.move_speed)})`,
        `[3] XP Gain Lv${options.xp_gain.level} (${formatCost(options.xp_gain)})`,
        `[4] Start Lightning Lv${options.starting_weapon.level} (${formatCost(options.starting_weapon)})`,
        "Press R to restart"
      ].join("\n")
    );
  }

  getAliveEnemyCount() {
    return this.enemies.getChildren().filter((enemy) => enemy.active).length;
  }

  hasActiveMiniBoss() {
    return this.enemies
      .getChildren()
      .some((enemy) => enemy?.active && (enemy.getData("archetype") === "mini_boss" || enemy.getData("bossVariant") === "mini"));
  }

  loadCoinBank() {
    if (typeof window === "undefined" || !window.localStorage) {
      return 0;
    }

    const raw = window.localStorage.getItem(META_COINS_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return 0;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  updateBestTimeRecord(timeMs) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const safeTime = Math.max(0, Math.floor(Number(timeMs) || 0));
    try {
      const prev = Number(window.localStorage.getItem(BEST_TIME_STORAGE_KEY));
      const prevBest = Number.isFinite(prev) && prev > 0 ? Math.floor(prev) : 0;
      if (safeTime > prevBest) {
        window.localStorage.setItem(BEST_TIME_STORAGE_KEY, String(safeTime));
      }
    } catch (_error) {
      // Ignore storage failures to keep runtime stable.
    }
  }

  saveCoinBank(amount) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    try {
      window.localStorage.setItem(META_COINS_STORAGE_KEY, String(safeAmount));
      const rawMeta = window.localStorage.getItem(META_STORAGE_KEY);
      const parsedMeta = rawMeta ? JSON.parse(rawMeta) : {};
      const mergedMeta = {
        currency: safeAmount,
        maxHPBonus: Math.max(0, Math.floor(Number(parsedMeta?.maxHPBonus) || 0)),
        xpBonus: Math.max(0, Math.floor(Number(parsedMeta?.xpBonus) || 0)),
        speedBonus: Math.max(0, Math.floor(Number(parsedMeta?.speedBonus) || 0)),
        startingWeaponBonus: Math.max(0, Math.floor(Number(parsedMeta?.startingWeaponBonus) || 0))
      };
      window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(mergedMeta));
    } catch (_error) {
      // Ignore storage failures to keep runtime stable.
    }
  }

  syncCoinStorageWithMeta() {
    const storedCoins = this.loadCoinBank();
    const metaCoins = Math.max(0, Math.floor(this.metaData?.currency ?? 0));

    if (storedCoins > metaCoins) {
      this.metaSystem.addCurrency(storedCoins - metaCoins);
      this.metaData = this.metaSystem.getData();
      this.saveCoinBank(this.metaData.currency);
      return;
    }

    this.saveCoinBank(metaCoins);
  }

  trySpendMetaCoins(amount) {
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
    if (safeAmount <= 0) {
      return true;
    }
    const currentCoins = Math.max(0, Math.floor(this.metaData?.currency ?? 0));
    if (currentCoins < safeAmount) {
      return false;
    }

    const nextCoins = currentCoins - safeAmount;
    this.saveCoinBank(nextCoins);
    this.metaSystem = new MetaProgressionSystem();
    this.metaData = this.metaSystem.getData();
    return true;
  }

  calculateRunCoinReward() {
    const timeSurvivedSec = Math.max(0, Math.floor(this.runTimeMs / 1000));
    const timeReward = Math.floor(timeSurvivedSec / 10);
    const killReward = this.totalKills * 0.1;
    const bundleReward = Math.max(0, Math.floor(Number(this.runMetaCurrency) || 0));
    return Math.max(0, Math.round(timeReward + killReward + bundleReward));
  }

  recordPlayerDamage(amount) {
    const safeAmount = Math.max(0, Number(amount) || 0);
    if (safeAmount <= 0) {
      return;
    }
    const nowMs = this.time?.now ?? 0;
    this.performanceDamageEvents.push({ t: nowMs, amount: safeAmount });
    this.performanceDamageTotal += safeAmount;
    this.trimPerformanceMetrics(nowMs);
  }

  recordKillEvent() {
    const nowMs = this.time?.now ?? 0;
    this.performanceKillEvents.push(nowMs);
    this.performanceKillTotal += 1;
    this.trimPerformanceMetrics(nowMs);
  }

  trimPerformanceMetrics(nowMs) {
    const windowMs = this.director?.getAdaptiveWindowMs?.() ?? 10000;
    const threshold = nowMs - windowMs;

    while (this.performanceDamageEvents.length > 0 && this.performanceDamageEvents[0].t < threshold) {
      const expired = this.performanceDamageEvents.shift();
      this.performanceDamageTotal -= expired?.amount ?? 0;
    }
    while (this.performanceKillEvents.length > 0 && this.performanceKillEvents[0] < threshold) {
      this.performanceKillEvents.shift();
      this.performanceKillTotal -= 1;
    }

    this.performanceDamageTotal = Math.max(0, this.performanceDamageTotal);
    this.performanceKillTotal = Math.max(0, this.performanceKillTotal);
  }

  getPerformanceMetrics() {
    const nowMs = this.time?.now ?? 0;
    this.trimPerformanceMetrics(nowMs);
    const windowMs = this.director?.getAdaptiveWindowMs?.() ?? 10000;
    const windowSec = Math.max(1, windowMs / 1000);

    return {
      dps: this.performanceDamageTotal / windowSec,
      killRate: this.performanceKillTotal / windowSec
    };
  }

  loadWeaponUnlocks() {
    const defaults = {};
    START_WEAPON_OPTIONS.forEach((option) => {
      defaults[option.id] = Boolean(option.defaultUnlocked);
    });

    if (typeof window === "undefined" || !window.localStorage) {
      return defaults;
    }

    try {
      const raw = window.localStorage.getItem(WEAPON_UNLOCK_STORAGE_KEY);
      if (!raw) {
        this.saveWeaponUnlocks(defaults);
        return defaults;
      }

      const parsed = JSON.parse(raw);
      START_WEAPON_OPTIONS.forEach((option) => {
        const stored = parsed?.[option.id];
        if (typeof stored === "boolean") {
          defaults[option.id] = stored || option.defaultUnlocked;
        } else if (stored === 0 || stored === 1) {
          defaults[option.id] = Boolean(stored) || option.defaultUnlocked;
        }
      });
      return defaults;
    } catch (_error) {
      return defaults;
    }
  }

  saveWeaponUnlocks(unlocks) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const sanitized = {};
    START_WEAPON_OPTIONS.forEach((option) => {
      const unlocked = Boolean(unlocks?.[option.id]) || option.defaultUnlocked;
      sanitized[option.id] = unlocked;
    });

    try {
      window.localStorage.setItem(WEAPON_UNLOCK_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (_error) {
      // Ignore storage failures to keep runtime stable.
    }
  }

  loadShopUpgradeLevels() {
    const fallback = {
      dash_cooldown: 0,
      xp_gain: 0,
      movement_speed: 0
    };
    if (typeof window === "undefined" || !window.localStorage) {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(SHOP_UPGRADES_STORAGE_KEY);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return {
        dash_cooldown: Math.max(0, Math.floor(Number(parsed?.dash_cooldown) || 0)),
        xp_gain: Math.max(0, Math.floor(Number(parsed?.xp_gain) || 0)),
        movement_speed: Math.max(0, Math.floor(Number(parsed?.movement_speed) || 0))
      };
    } catch (_error) {
      return fallback;
    }
  }

  createGameplayHUD() {
    if (this.hud) {
      this.hud.destroy(true);
      this.hud = null;
    }

    const margin = 16;
    const lineSpacing = 18;
    const style = {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f7f3de",
      stroke: "#1c130e",
      strokeThickness: 3
    };

    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    this.hpText = this.add.text(margin, margin + lineSpacing * 0, "HP: 100/100", style).setOrigin(0, 0);
    this.expText = this.add.text(margin, margin + lineSpacing * 1, "LV 1 | EXP 0%", style).setOrigin(0, 0);
    this.expBarBg = this.add
      .rectangle(margin, margin + 36, 120, 6, 0x2b1f16, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x7b6047, 0.8);
    this.expBarFill = this.add
      .rectangle(margin, margin + 36, 120, 6, 0x6fd7ff, 0.95)
      .setOrigin(0, 0);
    this.timeText = this.add.text(margin, margin + lineSpacing * 2, "TIME: 00:00", style).setOrigin(0, 0);
    this.killText = this.add.text(margin, margin + lineSpacing * 3, "KILLS: 0", style).setOrigin(0, 0);
    this.hud.add([this.hpText, this.expText, this.expBarBg, this.expBarFill, this.timeText, this.killText]);
    this.layoutHUDToCamera();

    // Keep legacy references wired for existing UI effects.
    this.hudLevelText = this.hpText;
    this.hudStatsText = this.expText;
    this.hudTimerText = this.timeText;
    this.hudGoldText = this.killText;

    // Hide legacy HUD decorations to keep minimal gameplay panel.
    [
      this.hudPanelBack,
      this.hudSecondaryPanel,
      this.hudXpFrame,
      this.hudHeaderChip,
      this.hudSecondaryChip,
      this.hudCoreLabelText,
      this.hudSecondaryLabelText,
      this.hudXpLabelText,
      this.hudSecondaryText
    ]
      .filter(Boolean)
      .forEach((obj) => obj.setVisible(false));
    this.hudBarsGraphics?.clear();
    this.hudBarsGraphics?.setVisible(false);
    [...(this.hudWeaponSlotFrames ?? []), ...(this.hudWeaponSlotLabels ?? [])]
      .filter(Boolean)
      .forEach((obj) => obj.setVisible(false));
  }

  layoutHUDToCamera() {
    if (!this.hud || !this.hpText || !this.expText || !this.timeText || !this.killText || !this.expBarBg || !this.expBarFill) {
      return;
    }
    const cam = this.cameras?.main;
    if (!cam) {
      return;
    }

    const anchorX = (cam.x ?? 0) + 16;
    const anchorY = (cam.y ?? 0) + 16;
    this.hud.setPosition(anchorX, anchorY);
    this.hpText.setPosition(0, 0);
    this.expText.setPosition(0, 18);
    this.expBarBg.setPosition(0, 36);
    this.expBarFill.setPosition(0, 36);
    this.timeText.setPosition(0, 52);
    this.killText.setPosition(0, 70);
  }

  updateHUD() {
    if (!this.player || !this.hpText || !this.expText || !this.timeText || !this.killText || !this.expBarFill) {
      return;
    }

    const levelValue = Number.isFinite(this.player.level) ? this.player.level : this.level;
    const currentExp = Number.isFinite(this.player.exp) ? this.player.exp : this.currentXp;
    const expToNext = Number.isFinite(this.player.expToNext) ? this.player.expToNext : this.xpToNext;
    const xpRatio = expToNext > 0 ? Phaser.Math.Clamp(currentExp / expToNext, 0, 1) : 0;
    const xpPercent = Math.round(xpRatio * 100);
    const nowMs = this.time?.now ?? 0;
    const elapsedMs = Math.max(0, nowMs - this.runStartTimeMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    this.layoutHUDToCamera();

    this.hpText.setText(`HP: ${this.player.hp}/${this.player.maxHp}`);
    this.expText.setText(`LV ${levelValue} | EXP ${xpPercent}%`);
    this.expBarFill.displayWidth = 120 * xpRatio;
    if (elapsedSeconds !== this.hudElapsedSeconds) {
      this.hudElapsedSeconds = elapsedSeconds;
      this.timeText.setText(`TIME: ${this.formatRunTime(elapsedMs)}`);
    }
    this.killText.setText(`KILLS: ${this.totalKills}`);
  }

  updateHud() {
    this.updateHUD();
  }

  updateEnemyHealthBars() {
    if (!this.enemyHealthBarsGraphics) {
      return;
    }
    this.enemyHealthBarsGraphics.clear();
    const worldView = this.cameras?.main?.worldView;
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy?.active || enemy.hp <= 0) {
        return;
      }
      const maxHp = Math.max(1, Number(enemy.maxHp ?? enemy.hp));
      const hpRatio = Phaser.Math.Clamp(enemy.hp / maxHp, 0, 1);
      const isBoss = Boolean(enemy.getData?.("isBoss"));
      const isElite = Boolean(enemy.isElite);
      if (!isBoss && !isElite && hpRatio >= 0.999) {
        return;
      }
      if (worldView && !Phaser.Geom.Rectangle.Overlaps(worldView, enemy.getBounds())) {
        return;
      }

      const width = isBoss ? 96 : isElite ? 46 : 34;
      const height = isBoss ? 12 : 10;
      const innerHeight = isBoss ? 8 : 6;
      const x = Math.round(enemy.x - width / 2);
      const y = Math.round(enemy.y - Math.max(28, enemy.displayHeight * 0.58));
      const innerWidth = Math.max(2, Math.round((width - 4) * hpRatio));
      const fillColor = isBoss ? 0xff5959 : isElite ? 0xffb347 : 0xff7d7d;

      this.enemyHealthBarsGraphics.fillStyle(0x1b1010, 0.86);
      this.enemyHealthBarsGraphics.fillRect(x, y, width, height);
      this.enemyHealthBarsGraphics.fillStyle(fillColor, 0.96);
      this.enemyHealthBarsGraphics.fillRect(x + 2, y + 2, innerWidth, innerHeight);
      this.enemyHealthBarsGraphics.lineStyle(1, 0xf2d5b5, isBoss ? 0.92 : 0.78);
      this.enemyHealthBarsGraphics.strokeRect(x, y, width, height);
    });
  }

  createEdgeFogOverlay() {
    this.rebuildEdgeFogTexture();
    const width = Math.max(1, this.scale?.width ?? 1280);
    const height = Math.max(1, this.scale?.height ?? 720);
    if (this.edgeFogOverlay) {
      this.edgeFogOverlay.setTexture(EDGE_FOG_TEXTURE_KEY);
      this.edgeFogOverlay.setPosition(width * 0.5, height * 0.5);
      return;
    }

    this.edgeFogOverlay = this.add
      .image(width * 0.5, height * 0.5, EDGE_FOG_TEXTURE_KEY)
      .setScrollFactor(0)
      .setDepth(8.7)
      .setAlpha(EDGE_FOG_VIGNETTE_OPACITY);
  }

  rebuildEdgeFogTexture() {
    const width = Math.max(1, Math.round(this.scale?.width ?? 1280));
    const height = Math.max(1, Math.round(this.scale?.height ?? 720));
    const zoom = Number(this.cameras?.main?.zoom) || GAMEPLAY_CAMERA_ZOOM || 1;

    const prev = this.edgeFogRebuildState;
    if (prev.width === width && prev.height === height && Math.abs(prev.zoom - zoom) < 0.001) {
      return;
    }

    if (this.textures.exists(EDGE_FOG_TEXTURE_KEY)) {
      this.textures.remove(EDGE_FOG_TEXTURE_KEY);
    }

    const texture = this.textures.createCanvas(EDGE_FOG_TEXTURE_KEY, width, height);
    if (!texture) {
      return;
    }

    const ctx = texture.context;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const innerRadius = EDGE_FOG_INNER_RADIUS_TILES * DECK_TILE_SIZE * zoom;
    const outerRadius = Math.max(innerRadius + 1, EDGE_FOG_OUTER_RADIUS_TILES * DECK_TILE_SIZE * zoom);
    const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    gradient.addColorStop(0, "rgba(4, 10, 18, 0)");
    gradient.addColorStop(0.45, "rgba(4, 10, 18, 0.12)");
    gradient.addColorStop(1, "rgba(4, 10, 18, 0.62)");

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    texture.refresh();

    this.edgeFogRebuildState = { width, height, zoom };
  }

  updateEdgeFogOverlay() {
    if (!this.edgeFogOverlay) {
      return;
    }

    this.rebuildEdgeFogTexture();
    if (this.edgeFogOverlay.texture?.key !== EDGE_FOG_TEXTURE_KEY && this.textures.exists(EDGE_FOG_TEXTURE_KEY)) {
      this.edgeFogOverlay.setTexture(EDGE_FOG_TEXTURE_KEY);
    }

    const width = Math.max(1, this.scale?.width ?? 1280);
    const height = Math.max(1, this.scale?.height ?? 720);
    this.edgeFogOverlay.setPosition(width * 0.5, height * 0.5);
  }

  updateLowHealthVignette() {
    if (!this.lowHealthVignetteGraphics || !this.player?.active) {
      return;
    }
    this.lowHealthVignetteGraphics.clear();
    const hpRatio = Phaser.Math.Clamp(this.player.getHpRatio(), 0, 1);
    if (hpRatio > 0.55) {
      return;
    }

    const baseIntensity = hpRatio <= 0.2 ? 0.28 : hpRatio <= 0.35 ? 0.18 : 0.1;
    const pulse = (Math.sin((this.time?.now ?? 0) / 150) + 1) * 0.5;
    const modalDampen = this.isLeveling || this.isWeaponSelecting ? 0.65 : 1;
    const alpha = (baseIntensity + pulse * 0.08) * modalDampen;
    const width = this.scale?.width ?? 1280;
    const height = this.scale?.height ?? 720;
    const edge = Math.max(26, Math.round(Math.min(width, height) * 0.08));

    this.lowHealthVignetteGraphics.fillStyle(0x7d1010, alpha * 0.6);
    this.lowHealthVignetteGraphics.fillRect(0, 0, width, edge);
    this.lowHealthVignetteGraphics.fillRect(0, height - edge, width, edge);
    this.lowHealthVignetteGraphics.fillRect(0, 0, edge, height);
    this.lowHealthVignetteGraphics.fillRect(width - edge, 0, edge, height);
    this.lowHealthVignetteGraphics.lineStyle(2, 0xff4d4d, alpha * 0.75);
    this.lowHealthVignetteGraphics.strokeRect(1, 1, width - 2, height - 2);
  }
}
