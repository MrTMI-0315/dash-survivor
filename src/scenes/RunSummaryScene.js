export class RunSummaryScene extends Phaser.Scene {
  constructor() {
    super("RunSummaryScene");
  }

  create(data = {}) {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;
    const cardWidth = 400;
    const cardHeight = 380;

    const stats = {
      timeSurvivedMs: data.timeSurvivedMs ?? 0,
      enemiesKilled: data.enemiesKilled ?? 0,
      maxCombo: data.maxCombo ?? 0,
      levelReached: data.levelReached ?? 1,
      coinsEarned: data.coinsEarned ?? 0,
      totalCoins: this.resolveTotalCoins(data.totalCoins)
    };

    this.add.rectangle(centerX, centerY, camera.width, camera.height, 0x000000, 0.64).setDepth(1);
    this.add
      .rectangle(centerX, centerY, cardWidth, cardHeight, 0x111827, 0.96)
      .setStrokeStyle(2, 0x3a4558, 1)
      .setDepth(2);

    this.add
      .text(centerX, centerY - 142, "RUN SUMMARY", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#ffffff",
        stroke: "#0b1220",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(3);

    const lines = [
      `Time Survived: ${this.formatTime(stats.timeSurvivedMs)}`,
      `Enemies Killed: ${stats.enemiesKilled}`,
      `Max Combo: x${Math.max(0, stats.maxCombo)}`,
      `Level Reached: ${stats.levelReached}`,
      `Coins Earned: +${stats.coinsEarned}`,
      `Coin Bank: ${stats.totalCoins}`
    ];

    this.add
      .text(centerX, centerY - 46, lines.join("\n"), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f3f7ff",
        align: "center",
        lineSpacing: 12
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.createActionButton(centerX, centerY + 94, "RETRY", () => {
      this.scene.stop("RunSummaryScene");
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
    });

    this.createActionButton(centerX, centerY + 152, "MAIN MENU", () => {
      this.scene.stop("RunSummaryScene");
      const hasUpgradeScene = Boolean(this.scene.manager?.keys?.UpgradeScene);
      if (hasUpgradeScene) {
        this.scene.stop("GameScene");
        this.scene.start("UpgradeScene");
        return;
      }
      const hasMainMenuScene = Boolean(this.scene.manager?.keys?.MainMenuScene);
      if (hasMainMenuScene) {
        this.scene.stop("GameScene");
        this.scene.start("MainMenuScene");
        return;
      }
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
    });
  }

  createActionButton(x, y, label, onClick) {
    const bg = this.add
      .rectangle(x, y, 230, 44, 0x1b2d45, 1)
      .setStrokeStyle(2, 0x6eb9ff, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(3);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#0e1a2a",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });

    const trigger = () => {
      if (typeof onClick === "function") {
        onClick();
      }
    };

    bg.on("pointerdown", trigger);
    text.on("pointerdown", trigger);
  }

  formatTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  resolveTotalCoins(payloadCoins) {
    if (Number.isFinite(payloadCoins) && payloadCoins >= 0) {
      return Math.floor(payloadCoins);
    }
    if (typeof window === "undefined" || !window.localStorage) {
      return 0;
    }

    const raw = window.localStorage.getItem("dashsurvivor_coins");
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }
}
