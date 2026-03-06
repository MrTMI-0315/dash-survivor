const COIN_STORAGE_KEY = "dashsurvivor_coins";
const BEST_TIME_STORAGE_KEY = "dashsurvivor_best_time_ms";
const MENU_ATLAS_KEY = "ui_atlas";
const MENU_ATLAS_IMAGE = "assets/atlas/ui_atlas.png";
const MENU_ATLAS_DATA = "assets/atlas/ui_atlas.json";
const SHARED_AUDIO_FILES = {
  dash: "assets/audio/dash.wav",
  enemy_hit: "assets/audio/enemy_hit.wav",
  enemy_death: "assets/audio/enemy_die.wav",
  level_up: "assets/audio/level_up.wav",
  boss_warning: "assets/audio/boss_warning.wav"
};

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  preload() {
    this.bindLoadingScreenProgress();

    if (!this.textures.exists(MENU_ATLAS_KEY)) {
      this.load.atlas(MENU_ATLAS_KEY, MENU_ATLAS_IMAGE, MENU_ATLAS_DATA);
    }

    Object.entries(SHARED_AUDIO_FILES).forEach(([key, path]) => {
      if (this.cache?.audio?.exists(key)) {
        return;
      }
      this.load.audio(key, path);
    });
  }

  create() {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;

    this.add.rectangle(centerX, centerY, camera.width, camera.height, 0x071120, 1);
    for (let y = 0; y < camera.height; y += 32) {
      const color = Math.floor(y / 32) % 2 === 0 ? 0x0d1a31 : 0x11213d;
      this.add.rectangle(centerX, y + 16, camera.width, 30, color, 1).setOrigin(0.5);
    }
    this.add.rectangle(centerX, centerY, camera.width - 84, camera.height - 92, 0x10203a, 0.9).setStrokeStyle(4, 0x5ca7ff, 1);
    this.add.rectangle(centerX, centerY, camera.width - 96, camera.height - 104, 0x0b1830, 0).setStrokeStyle(2, 0x9bd3ff, 0.9);
    if (this.textures.exists(MENU_ATLAS_KEY)) {
      this.add.image(centerX, 62, MENU_ATLAS_KEY, "dot").setScale(18, 18).setTint(0x78c7ff).setAlpha(0.75);
    }

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
    this.add.rectangle(centerX, 226, 420, 54, 0x152947, 0.95).setStrokeStyle(2, 0x7bc3ff, 1);
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

    this.hideLoadingScreen();
  }

  createButton(x, y, label, onClick) {
    const button = this.add
      .rectangle(x, y + 4, 292, 62, 0x0b1423, 0.95)
      .setStrokeStyle(2, 0x0b1423, 1)
      .setOrigin(0.5);
    const plate = this.add
      .rectangle(x, y, 280, 58, 0x1a324f, 1)
      .setStrokeStyle(3, 0x6ab8ff, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add.rectangle(x, y, 268, 46, 0, 0).setStrokeStyle(1, 0xb8e0ff, 0.9).setOrigin(0.5);

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
    plate.on("pointerdown", trigger);
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

  bindLoadingScreenProgress() {
    if (typeof document === "undefined") {
      return;
    }

    const subtitle = document.getElementById("loading-subtitle");
    const fill = document.getElementById("loading-bar-fill");
    this.load.on("progress", (value) => {
      if (fill) {
        fill.style.width = `${Math.round(value * 100)}%`;
      }
      if (subtitle) {
        subtitle.textContent = `Loading assets... ${Math.round(value * 100)}%`;
      }
    });
  }

  hideLoadingScreen() {
    if (typeof document === "undefined") {
      return;
    }

    const loadingScreen = document.getElementById("loading-screen");
    const fill = document.getElementById("loading-bar-fill");
    const subtitle = document.getElementById("loading-subtitle");
    if (fill) {
      fill.style.width = "100%";
    }
    if (subtitle) {
      subtitle.textContent = "Ready";
    }
    if (!loadingScreen) {
      return;
    }

    loadingScreen.classList.add("hidden");
    window.setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 260);
  }
}
