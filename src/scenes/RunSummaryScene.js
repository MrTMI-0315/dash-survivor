const UI_LAYER_ORDER = Object.freeze({
  GAME_WORLD: 0,
  COMBAT_UI: 20,
  HUD: 40,
  OVERLAY: 60,
  RUN_SUMMARY: 80
});

export class RunSummaryScene extends Phaser.Scene {
  constructor() {
    super("RunSummaryScene");
  }

  create(data = {}) {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;
    const cardWidth = 400;
    const cardHeight = 500;
    const panelPadding = 32;
    const titleMarginBottom = 24;
    const statLineSpacing = 12;
    const buttonGap = 14;
    const primaryButtonWidth = 260;
    const primaryButtonHeight = 56;
    const secondaryButtonWidth = 220;
    const secondaryButtonHeight = 48;

    const stats = {
      timeSurvivedMs: data.timeSurvivedMs ?? 0,
      enemiesKilled: data.enemiesKilled ?? 0,
      maxCombo: data.maxCombo ?? 0,
      levelReached: data.levelReached ?? 1,
      coinsEarned: data.coinsEarned ?? 0,
      totalCoins: this.resolveTotalCoins(data.totalCoins)
    };

    this.add
      .rectangle(centerX, centerY, camera.width, camera.height, 0x000000, 0.65)
      .setDepth(UI_LAYER_ORDER.OVERLAY);
    this.add
      .rectangle(centerX, centerY, cardWidth + 16, cardHeight + 16, 0x071120, 0.98)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY);
    this.add
      .rectangle(centerX, centerY, cardWidth, cardHeight, 0x111827, 0.98)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY);
    this.add
      .rectangle(centerX, centerY, cardWidth, cardHeight, 0, 0)
      .setStrokeStyle(4, 0x5ca7ff, 1)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 1);
    this.add
      .rectangle(centerX, centerY, cardWidth - 12, cardHeight - 12, 0, 0)
      .setStrokeStyle(2, 0xb8e0ff, 0.95)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 1);

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
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 2);

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
    this.add
      .rectangle(centerX, statsCenterY, 312, statsContainerHeight, 0x152947, 0.92)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 1);
    this.add
      .rectangle(centerX, statsCenterY, 312, statsContainerHeight, 0, 0)
      .setStrokeStyle(2, 0x7bc3ff, 1)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 1);
    const statsText = this.add
      .text(centerX, statsCenterY, lines.join("\n"), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#f3f7ff",
        align: "center",
        lineSpacing: statLineSpacing
      })
      .setOrigin(0.5)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 2);
    statsText.setY(statsCenterY - statsText.height * 0.5 + 2);

    const panelBottom = panelTop + cardHeight;
    const buttonStackHeight = primaryButtonHeight + secondaryButtonHeight * 2 + buttonGap * 2;
    const buttonsContainerTop = panelBottom - panelPadding - buttonStackHeight;
    const retryY = buttonsContainerTop + primaryButtonHeight * 0.5;
    const copyY = retryY + primaryButtonHeight * 0.5 + buttonGap + secondaryButtonHeight * 0.5;
    const menuY = copyY + secondaryButtonHeight + buttonGap;
    this.copyStatusText = this.add
      .text(centerX, buttonsContainerTop - 18, "", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#c9e8ff",
        stroke: "#0f1d2e",
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 2)
      .setVisible(false);

    this.createActionButton(centerX, retryY, "RETRY", () => {
      this.scene.stop("RunSummaryScene");
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
    }, { variant: "primary", width: primaryButtonWidth, height: primaryButtonHeight });

    this.createActionButton(centerX, copyY, "COPY STATS", () => {
      this.copyRunSummaryStats(copyText);
    }, { variant: "secondary", width: secondaryButtonWidth, height: secondaryButtonHeight });

    this.createActionButton(centerX, menuY, "MAIN MENU", () => {
      this.scene.stop("RunSummaryScene");
      const hasMainMenuScene = Boolean(this.scene.manager?.keys?.MainMenuScene);
      if (hasMainMenuScene) {
        this.scene.stop("GameScene");
        this.scene.start("MainMenuScene");
        return;
      }
      this.scene.stop("GameScene");
      this.scene.start("GameScene");
    }, { variant: "secondary", width: secondaryButtonWidth, height: secondaryButtonHeight });
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

  createActionButton(x, y, label, onClick, options = {}) {
    const variant = options.variant === "primary" ? "primary" : "secondary";
    const width = Number.isFinite(options.width) ? options.width : variant === "primary" ? 260 : 220;
    const height = Number.isFinite(options.height) ? options.height : variant === "primary" ? 56 : 48;
    const baseFill = variant === "primary" ? 0x255283 : 0x1b2d45;
    const baseStroke = variant === "primary" ? 0x8ccfff : 0x6eb9ff;
    const hoverFill = this.adjustHexBrightness(baseFill, variant === "primary" ? 0.08 : 0.06);
    const hoverStroke = this.adjustHexBrightness(baseStroke, variant === "primary" ? 0.08 : 0.06);

    const shadow = this.add
      .rectangle(x, y + 3, width + 12, height + 8, 0x0b1423, 0.95)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 1);
    const bg = this.add
      .rectangle(x, y, width, height, baseFill, 1)
      .setStrokeStyle(3, baseStroke, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 2);
    this.add
      .rectangle(x, y, width - 10, height - 10, 0, 0)
      .setStrokeStyle(1, 0xb8e0ff, 0.9)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 2);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Arial",
        fontSize: variant === "primary" ? "26px" : "22px",
        color: "#ffffff",
        stroke: "#0e1a2a",
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(UI_LAYER_ORDER.RUN_SUMMARY + 3);

    const trigger = () => {
      if (typeof onClick === "function") {
        onClick();
      }
    };

    bg.on("pointerover", () => {
      bg.setFillStyle(hoverFill, 1);
      bg.setStrokeStyle(3, hoverStroke, 1);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(baseFill, 1);
      bg.setStrokeStyle(3, baseStroke, 1);
    });
    bg.on("pointerdown", trigger);
    shadow.setData("decorative", true);
  }

  adjustHexBrightness(hexColor, ratio) {
    const color = Number.isFinite(hexColor) ? hexColor : 0x000000;
    const factor = Math.max(0, Number(ratio) || 0);
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const nr = Math.min(255, Math.round(r * (1 + factor)));
    const ng = Math.min(255, Math.round(g * (1 + factor)));
    const nb = Math.min(255, Math.round(b * (1 + factor)));
    return (nr << 16) | (ng << 8) | nb;
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
