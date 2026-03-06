import { GameScene } from "./scenes/GameScene.js";
import { RunSummaryScene } from "./scenes/RunSummaryScene.js";
import { UpgradeScene } from "./scenes/UpgradeScene.js";
import { MainMenuScene } from "./scenes/MainMenuScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  backgroundColor: "#0c1424",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  render: {
    powerPreference: "high-performance",
    antialias: false
  },
  fps: {
    target: 60,
    forceSetTimeOut: false
  },
  input: {
    activePointers: 3,
    touch: {
      capture: true
    }
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: 1280,
    height: 720
  },
  scene: [MainMenuScene, GameScene, RunSummaryScene, UpgradeScene]
};

new Phaser.Game(config);
