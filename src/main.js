import { GameScene } from "./scenes/GameScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  backgroundColor: "#0c1424",
  render: {
    powerPreference: "high-performance"
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
  scene: [GameScene]
};

new Phaser.Game(config);
