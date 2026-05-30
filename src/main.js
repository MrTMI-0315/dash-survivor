import PhaserModule from "phaser";
import { PokiAdapter } from "./platform/PokiAdapter.js";

const Phaser = PhaserModule?.default ?? PhaserModule;
globalThis.Phaser = Phaser;

async function bootstrap() {
  PokiAdapter.installInputGuards();
  await PokiAdapter.init();

  const [{ GameScene }, { RunSummaryScene }, { UpgradeScene }, { MainMenuScene }] = await Promise.all([
    import("./scenes/GameScene.js"),
    import("./scenes/RunSummaryScene.js"),
    import("./scenes/UpgradeScene.js"),
    import("./scenes/MainMenuScene.js")
  ]);

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

  const game = new Phaser.Game(config);
  globalThis.__DASH_SURVIVOR_GAME__ = game;
}

bootstrap();
