const META_STORAGE_KEY = "dashsurvivor_meta_v1";

const DEFAULT_META_DATA = Object.freeze({
  currency: 0,
  maxHPBonus: 0,
  xpBonus: 0,
  speedBonus: 0,
  startingWeaponBonus: 0
});

const UPGRADE_DEFINITIONS = {
  max_hp: {
    field: "maxHPBonus",
    label: "Max HP",
    maxLevel: 20,
    getCost: (level) => 24 + level * 12
  },
  move_speed: {
    field: "speedBonus",
    label: "Move Speed",
    maxLevel: 15,
    getCost: (level) => 24 + level * 12
  },
  xp_gain: {
    field: "xpBonus",
    label: "XP Gain",
    maxLevel: 12,
    getCost: (level) => 30 + level * 14
  },
  starting_weapon: {
    field: "startingWeaponBonus",
    label: "Start Lightning",
    maxLevel: 1,
    getCost: () => 120
  }
};

function toSafeInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export class MetaProgressionSystem {
  constructor(storageKey = META_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.data = this.loadData();
  }

  loadData() {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_META_DATA };
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return { ...DEFAULT_META_DATA };
      }

      const parsed = JSON.parse(raw);
      return this.sanitizeData(parsed);
    } catch (_error) {
      return { ...DEFAULT_META_DATA };
    }
  }

  sanitizeData(rawData) {
    const safeData = { ...DEFAULT_META_DATA };
    Object.keys(DEFAULT_META_DATA).forEach((key) => {
      safeData[key] = toSafeInt(rawData?.[key]);
    });
    return safeData;
  }

  saveData() {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (_error) {
      // Ignore storage quota/private mode failures to keep runtime stable.
    }
  }

  getData() {
    return { ...this.data };
  }

  getRunBonuses() {
    return {
      maxHpFlat: this.data.maxHPBonus * 8,
      speedFlat: this.data.speedBonus * 6,
      xpMultiplier: 1 + this.data.xpBonus * 0.05,
      startingWeaponBonus: this.data.startingWeaponBonus
    };
  }

  addCurrency(amount) {
    const safeAmount = toSafeInt(amount);
    if (safeAmount <= 0) {
      return this.data.currency;
    }

    this.data.currency += safeAmount;
    this.saveData();
    return this.data.currency;
  }

  getUpgradeOptions() {
    return Object.entries(UPGRADE_DEFINITIONS).reduce((acc, [upgradeKey, definition]) => {
      const level = this.data[definition.field];
      const isMaxed = level >= definition.maxLevel;
      const cost = isMaxed ? null : definition.getCost(level);

      acc[upgradeKey] = {
        key: upgradeKey,
        label: definition.label,
        level,
        cost,
        isMaxed
      };
      return acc;
    }, {});
  }

  purchaseUpgrade(upgradeKey) {
    const definition = UPGRADE_DEFINITIONS[upgradeKey];
    if (!definition) {
      return { success: false, reason: "invalid_upgrade" };
    }

    const currentLevel = this.data[definition.field];
    if (currentLevel >= definition.maxLevel) {
      return { success: false, reason: "maxed" };
    }

    const cost = definition.getCost(currentLevel);
    if (this.data.currency < cost) {
      return { success: false, reason: "insufficient_currency", cost };
    }

    this.data.currency -= cost;
    this.data[definition.field] = currentLevel + 1;
    this.saveData();

    return {
      success: true,
      upgradeKey,
      label: definition.label,
      newLevel: this.data[definition.field],
      cost,
      currency: this.data.currency
    };
  }
}

export { META_STORAGE_KEY, DEFAULT_META_DATA, UPGRADE_DEFINITIONS };
