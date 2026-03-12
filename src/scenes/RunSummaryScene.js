export class RunSummaryScene extends Phaser.Scene {
  constructor() {
    super("RunSummaryScene");
  }

  create(data = {}) {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;
    const cardWidth = 400;
    const cardHeight = 430;
    const panelPadding = 32;
    const titleMarginBottom = 24;
    const statLineSpacing = 12;

    const stats = {
      timeSurvivedMs: data.timeSurvivedMs ?? 0,
      enemiesKilled: data.enemiesKilled ?? 0,
      maxCombo: data.maxCombo ?? 0,
      levelReached: data.levelReached ?? 1,
      coinsEarned: data.coinsEarned ?? 0,
      totalCoins: this.resolveTotalCoins(data.totalCoins)
    };

    this.add.rectangle(centerX, centerY, camera.width, camera.height, 0x000000, 0.72).setDepth(1);
    this.add.rectangle(centerX, centerY, cardWidth + 16, cardHeight + 16, 0x071120, 0.98).setDepth(2);
    this.add.rectangle(centerX, centerY, cardWidth, cardHeight, 0x111827, 0.98).setDepth(2);
    this.add.rectangle(centerX, centerY, cardWidth, cardHeight, 0, 0).setStrokeStyle(4, 0x5ca7ff, 1).setDepth(3);
    this.add.rectangle(centerX, centerY, cardWidth - 12, cardHeight - 12, 0, 0).setStrokeStyle(2, 0xb8e0ff, 0.95).setDepth(3);

    const panelTop = centerY - cardHeight * 0.5;
    const panelLeft = centerX - cardWidth * 0.5;
    const titleY = panelTop + panelPadding;
    const titleText = this.add
      .text(centerX, titleY, "RUN SUMMARY", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#ffffff",
        stroke: "#0b1220",
        strokeThickness: 5
      })
      .setOrigin(0.5, 0)
      .setDepth(3);

    const lines = [
      `Time Survived: ${this.formatTime(stats.timeSurvivedMs)}`,
      `Enemies Killed: ${stats.enemiesKilled}`,
      `Max Combo: x${Math.max(0, stats.maxCombo)}`,
      `Level Reached: ${stats.levelReached}`,
      `Coins Earned: +${stats.coinsEarned}`,
      `Coin Bank: ${stats.totalCoins}`
    ];
    const copyText = ["DashSurvivor Run Summary", ...lines].join("\n");

    const titleBottomY = titleY + titleText.height;
    const statsTopY = titleBottomY + titleMarginBottom;
    const statsContainerHeight = 168;
    const statsCenterY = statsTopY + statsContainerHeight * 0.5;
    this.add.rectangle(centerX, statsCenterY, 312, statsContainerHeight, 0x152947, 0.92).setDepth(3);
    this.add.rectangle(centerX, statsCenterY, 312, statsContainerHeight, 0, 0).setStrokeStyle(2, 0x7bc3ff, 1).setDepth(3);
    const statsText = this.add
      .text(centerX, statsCenterY, lines.join("\n"), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f3f7ff",
        align: "center",
        lineSpacing: statLineSpacing
      })
      .setOrigin(0.5)
      .setDepth(3);
    statsText.setY(statsCenterY - statsText.height * 0.5 + 2);

    const buttonsTopY = statsTopY + statsContainerHeight + panelPadding;
    this.copyStatusText = this.add
      .text(centerX, buttonsTopY + 4, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#c9e8ff",
        stroke: "#0f1d2e",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setVisible(false);

    this.createActionButton(centerX, buttonsTopY + 34, "COPY STATS", () => {
      this.copyRunSummaryStats(copyText);
    });

    this.createActionButton(centerX, buttonsTopY + 86, "RETRY", () => {
      this.scene.stop("RunSummaryScene");
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
    });

    this.createActionButton(centerX, buttonsTopY + 138, "MAIN MENU", () => {
      this.scene.stop("RunSummaryScene");
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

  copyRunSummaryStats(text) {
    if (!text) {
      return;
    }

    const showStatus = (message) => {
      if (!this.copyStatusText) {
        return;
      }
      this.copyStatusText.setText(message);
      this.copyStatusText.setVisible(true);
      const previousHideTimer = this.copyStatusText.getData("hideTimer");
      if (previousHideTimer) {
        previousHideTimer.remove(false);
      }
      const hideTimer = this.time.delayedCall(1200, () => {
        if (this.copyStatusText) {
          this.copyStatusText.setVisible(false);
          this.copyStatusText.setData("hideTimer", null);
        }
      });
      this.copyStatusText.setData("hideTimer", hideTimer);
    };

    const fallbackLog = () => {
      // Keep fallback available in non-secure contexts.
      console.log(`[RunSummary] COPY STATS\n${text}`);
      showStatus("Stats logged to console");
    };

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      fallbackLog();
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log(`[RunSummary] COPY STATS\n${text}`);
        showStatus("Stats copied");
      })
      .catch(() => {
        fallbackLog();
      });
  }

  createActionButton(x, y, label, onClick) {
    const shadow = this.add.rectangle(x, y + 3, 242, 48, 0x0b1423, 0.95).setDepth(3);
    const bg = this.add
      .rectangle(x, y, 230, 44, 0x1b2d45, 1)
      .setStrokeStyle(3, 0x6eb9ff, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(4);
    this.add.rectangle(x, y, 220, 34, 0, 0).setStrokeStyle(1, 0xb8e0ff, 0.9).setDepth(4);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#0e1a2a",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    const trigger = () => {
      if (typeof onClick === "function") {
        onClick();
      }
    };

    bg.on("pointerdown", trigger);
    text.on("pointerdown", trigger);
    shadow.setData("decorative", true);
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
