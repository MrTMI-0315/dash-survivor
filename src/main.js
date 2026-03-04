import { GameScene } from "./scenes/GameScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: 1280,
  height: 720,
  backgroundColor: "#0c1424",
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
    width: 1280,
    height: 720
  },
  scene: [GameScene]
};

new Phaser.Game(config);
