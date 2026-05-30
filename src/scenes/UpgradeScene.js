const COIN_STORAGE_KEY = "dashsurvivor_coins";
const META_STORAGE_KEY = "dashsurvivor_meta_v1";
const UPGRADE_STORAGE_KEY = "dashsurvivor_shop_upgrades_v1";

const DEFAULT_UPGRADES = Object.freeze({
  dash_cooldown: 0,
  xp_gain: 0,
  movement_speed: 0
});

const UPGRADE_DEFINITIONS = [
  {
    key: "dash_cooldown",
    label: "Dash Cooldown",
    effectLabel: "-5%",
    baseCost: 45,
    costStep: 20,
    maxLevel: 10
  },
  {
    key: "xp_gain",
    label: "XP Gain",
    effectLabel: "+10%",
    baseCost: 55,
    costStep: 24,
    maxLevel: 10
  },
  {
    key: "movement_speed",
    label: "Movement Speed",
    effectLabel: "+5%",
    baseCost: 40,
    costStep: 18,
    maxLevel: 10
  }
];

function toSafeInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export class UpgradeScene extends Phaser.Scene {
  constructor() {
    super("UpgradeScene");
    this.coins = 0;
    this.upgrades = { ...DEFAULT_UPGRADES };
    this.coinsText = null;
    this.statusText = null;
  }

  create() {
    const camera = this.cameras.main;
    const centerX = camera.width * 0.5;
    const centerY = camera.height * 0.5;
    const margin = Phaser.Math.Clamp(camera.width * 0.045, 34, 58);
    const panelWidth = Math.min(1040, camera.width - margin * 2);
    const panelHeight = Math.min(610, camera.height - 54);
    const panelTop = centerY - panelHeight * 0.5;
    const contentWidth = Math.min(900, panelWidth - 84);
    const contentLeft = centerX - contentWidth * 0.5;
    const headerY = panelTop + 142;
    const rowTop = headerY + 58;
    const rowGap = Math.max(72, (panelHeight - 320) / UPGRADE_DEFINITIONS.length);
    const statusY = panelTop + panelHeight - 92;
    const startY = panelTop + panelHeight - 38;
    const layout = {
      centerX,
      contentWidth,
      contentLeft,
      rowWidth: contentWidth,
      rowHeight: 58,
      rowTop,
      rowGap,
      labelX: contentLeft + 28,
      levelX: contentLeft + contentWidth * 0.38,
      costX: contentLeft + contentWidth * 0.52,
      effectX: contentLeft + contentWidth * 0.66,
      buttonX: contentLeft + contentWidth - 62
    };

    this.coins = this.loadCoins();
    this.upgrades = this.loadUpgrades();

    this.add.rectangle(centerX, centerY, camera.width, camera.height, 0x071120, 1);
    for (let y = 0; y < camera.height; y += 32) {
      const color = Math.floor(y / 32) % 2 === 0 ? 0x0d1a31 : 0x11213d;
      this.add.rectangle(centerX, y + 16, camera.width, 30, color, 1).setOrigin(0.5);
    }
    this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x0b1830, 0.92).setStrokeStyle(4, 0x5ca7ff, 1);
    this.add.rectangle(centerX, centerY, panelWidth - 14, panelHeight - 14, 0, 0).setStrokeStyle(2, 0xb8e0ff, 0.92);
    this.add
      .text(centerX, panelTop + 46, "UPGRADE SHOP", {
        fontFamily: "Arial",
        fontSize: "32px",
        color: "#ffffff",
        stroke: "#0b1220",
        strokeThickness: 6
      })
      .setOrigin(0.5);

    this.coinsText = this.add
      .text(centerX, panelTop + 90, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffe08a",
        stroke: "#2a1a06",
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.add.rectangle(centerX, headerY + 6, contentWidth, 42, 0x152947, 0.95).setStrokeStyle(2, 0x7bc3ff, 1);
    this.add.text(layout.labelX, headerY, "Upgrade", { fontFamily: "Arial", fontSize: "19px", color: "#cfe9ff" });
    this.add.text(layout.levelX, headerY, "Level", { fontFamily: "Arial", fontSize: "19px", color: "#cfe9ff" });
    this.add.text(layout.costX, headerY, "Cost", { fontFamily: "Arial", fontSize: "19px", color: "#cfe9ff" });
    this.add.text(layout.effectX, headerY, "Effect", { fontFamily: "Arial", fontSize: "19px", color: "#cfe9ff" });

    UPGRADE_DEFINITIONS.forEach((definition, index) => {
      this.createUpgradeRow(definition, index, layout);
    });

    this.statusText = this.add
      .text(centerX, statusY, "", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#cde5ff",
        stroke: "#0e1a2a",
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.createButton(centerX, startY, "START RUN", () => {
      this.scene.start("GameScene");
    }, 220, 46, 21);

    this.refreshCoinsText();
  }

  createUpgradeRow(definition, index, layout) {
    const y = layout.rowTop + index * layout.rowGap;
    this.add
      .rectangle(layout.centerX, y + 15, layout.rowWidth, layout.rowHeight, 0x13233d, 0.9)
      .setStrokeStyle(2, 0x345c87, 0.95);
    const levelText = this.add.text(layout.levelX, y, "", { fontFamily: "Arial", fontSize: "20px", color: "#f2f8ff" });
    const costText = this.add.text(layout.costX, y, "", { fontFamily: "Arial", fontSize: "20px", color: "#ffe08a" });
    const effectText = this.add.text(layout.effectX, y, definition.effectLabel, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9ff0b6"
    });

    this.add.text(layout.labelX, y, definition.label, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#f2f8ff",
      wordWrap: { width: Math.max(190, layout.contentWidth * 0.3) }
    });

    const buyButton = this.createButton(layout.buttonX, y + 14, "BUY", () => {
      this.purchaseUpgrade(definition, levelText, costText);
    }, 116, 40, 18);

    buyButton.setDepth(3);
    levelText.setDepth(3);
    costText.setDepth(3);
    effectText.setDepth(3);
    this.refreshUpgradeRow(definition, levelText, costText);
  }

  refreshUpgradeRow(definition, levelText, costText) {
    const level = this.upgrades[definition.key] ?? 0;
    const isMaxed = level >= definition.maxLevel;
    levelText.setText(`Lv ${level}`);
    if (isMaxed) {
      costText.setText("MAX");
      costText.setColor("#89f5a6");
      return;
    }
    const cost = this.getUpgradeCost(definition, level);
    costText.setText(`${cost}`);
    costText.setColor("#ffe08a");
  }

  purchaseUpgrade(definition, levelText, costText) {
    const level = this.upgrades[definition.key] ?? 0;
    if (level >= definition.maxLevel) {
      this.setStatus("이미 최대 레벨입니다.", "#9ff0b6");
      return;
    }

    const cost = this.getUpgradeCost(definition, level);
    if (this.coins < cost) {
      this.setStatus("코인이 부족합니다.", "#ffb4b4");
      return;
    }

    this.coins -= cost;
    this.upgrades[definition.key] = level + 1;
    this.saveCoins(this.coins);
    this.saveUpgrades(this.upgrades);

    this.refreshCoinsText();
    this.refreshUpgradeRow(definition, levelText, costText);
    this.setStatus(`${definition.label} 업그레이드 구매 완료`, "#9ff0b6");
  }

  getUpgradeCost(definition, level) {
    return definition.baseCost + level * definition.costStep;
  }

  createButton(x, y, label, onClick, width = 240, height = 50, fontSize = 24) {
    const shadow = this.add
      .rectangle(x, y + 4, width + 12, height + 8, 0x0b1423, 0.95)
      .setOrigin(0.5);
    const button = this.add
      .rectangle(x, y, width, height, 0x1c324d, 1)
      .setStrokeStyle(3, 0x67b8ff, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add.rectangle(x, y, width - 12, height - 12, 0, 0).setStrokeStyle(1, 0xb8e0ff, 0.9).setOrigin(0.5);
    const text = this.add
      .text(x, y, label, {
        fontFamily: "Arial",
        fontSize: `${fontSize}px`,
        color: "#ffffff",
        stroke: "#0e1a2a",
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
    shadow.setData("decorative", true);
    return button;
  }

  refreshCoinsText() {
    if (!this.coinsText) {
      return;
    }
    this.coinsText.setText(`Coins: ${this.coins}`);
  }

  setStatus(message, color = "#cde5ff") {
    if (!this.statusText) {
      return;
    }
    this.statusText.setText(message);
    this.statusText.setColor(color);
  }

  loadCoins() {
    if (typeof window === "undefined" || !window.localStorage) {
      return 0;
    }
    return toSafeInt(window.localStorage.getItem(COIN_STORAGE_KEY));
  }

  saveCoins(coins) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    const safeCoins = toSafeInt(coins);
    try {
      window.localStorage.setItem(COIN_STORAGE_KEY, String(safeCoins));
      const metaRaw = window.localStorage.getItem(META_STORAGE_KEY);
      const metaParsed = metaRaw ? JSON.parse(metaRaw) : {};
      const mergedMeta = {
        currency: safeCoins,
        maxHPBonus: toSafeInt(metaParsed?.maxHPBonus),
        xpBonus: toSafeInt(metaParsed?.xpBonus),
        speedBonus: toSafeInt(metaParsed?.speedBonus),
        startingWeaponBonus: toSafeInt(metaParsed?.startingWeaponBonus)
      };
      window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(mergedMeta));
    } catch (_error) {
      // Ignore storage failures to keep runtime stable.
    }
  }

  loadUpgrades() {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_UPGRADES };
    }
    try {
      const raw = window.localStorage.getItem(UPGRADE_STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_UPGRADES };
      }
      const parsed = JSON.parse(raw);
      return {
        dash_cooldown: toSafeInt(parsed?.dash_cooldown),
        xp_gain: toSafeInt(parsed?.xp_gain),
        movement_speed: toSafeInt(parsed?.movement_speed)
      };
    } catch (_error) {
      return { ...DEFAULT_UPGRADES };
    }
  }

  saveUpgrades(upgrades) {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    const sanitized = {
      dash_cooldown: toSafeInt(upgrades?.dash_cooldown),
      xp_gain: toSafeInt(upgrades?.xp_gain),
      movement_speed: toSafeInt(upgrades?.movement_speed)
    };
    try {
      window.localStorage.setItem(UPGRADE_STORAGE_KEY, JSON.stringify(sanitized));
    } catch (_error) {
      // Ignore storage failures to keep runtime stable.
    }
  }
}
