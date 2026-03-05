const COIN_STORAGE_KEY = "dashsurvivor_coins";
const BEST_TIME_STORAGE_KEY = "dashsurvivor_best_time_ms";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create() {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;

    this.add.rectangle(centerX, centerY, camera.width, camera.height, 0x0b1220, 1);

    this.add
      .text(centerX, 132, "DashSurvivor", {
        fontFamily: "Arial",
        fontSize: "64px",
        color: "#f8fbff",
        stroke: "#102640",
        strokeThickness: 8
      })
      .setOrigin(0.5);

    const bestTimeMs = this.loadBestTimeMs();
    const coins = this.loadCoins();
    this.add
      .text(centerX, 226, `Best Time: ${this.formatTime(bestTimeMs)}   Coins: ${coins}`, {
        fontFamily: "Arial",
        fontSize: "28px",
        color: "#cfe9ff",
        stroke: "#0d1a2d",
        strokeThickness: 5
      })
      .setOrigin(0.5);

    this.createButton(centerX, 352, "START RUN", () => {
      this.scene.start("GameScene");
    });

    this.createButton(centerX, 432, "UPGRADES", () => {
      this.scene.start("UpgradeScene");
    });
  }

  createButton(x, y, label, onClick) {
    const button = this.add
      .rectangle(x, y, 280, 58, 0x1a324f, 1)
      .setStrokeStyle(2, 0x6ab8ff, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const text = this.add
      .text(x, y, label, {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ffffff",
        stroke: "#0f1c2f",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const trigger = () => {
      if (typeof onClick === "function") {
        onClick();
      }
    };
    button.on("pointerdown", trigger);
    text.on("pointerdown", trigger);
  }

  loadCoins() {
    if (typeof window === "undefined" || !window.localStorage) {
      return 0;
    }
    const parsed = Number(window.localStorage.getItem(COIN_STORAGE_KEY));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  loadBestTimeMs() {
    if (typeof window === "undefined" || !window.localStorage) {
      return 0;
    }
    const parsed = Number(window.localStorage.getItem(BEST_TIME_STORAGE_KEY));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  formatTime(ms) {
    if (!ms || ms <= 0) {
      return "--:--";
    }
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
}

