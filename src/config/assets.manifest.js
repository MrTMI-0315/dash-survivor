export const CHARACTER_DIRECTIONS = Object.freeze([
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west"
]);

export const CHARACTER_ASSET_MANIFEST = Object.freeze([
  Object.freeze({
    keyPrefix: "char_player_pirate",
    basePath: "assets/sprites/player/pirate"
  }),
  Object.freeze({
    keyPrefix: "char_enemy_chaser",
    basePath: "assets/sprites/enemies/chaser"
  }),
  Object.freeze({
    keyPrefix: "char_enemy_swarm",
    basePath: "assets/sprites/enemies/swarm"
  }),
  Object.freeze({
    keyPrefix: "char_enemy_tank",
    basePath: "assets/sprites/enemies/tank"
  }),
  Object.freeze({
    keyPrefix: "char_enemy_hunter",
    basePath: "assets/sprites/enemies/hunter"
  }),
  Object.freeze({
    keyPrefix: "char_enemy_miniboss_davy",
    basePath: "assets/sprites/enemies/miniboss_davy"
  })
]);
