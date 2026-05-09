const BLOCKED_INPUT_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function getSdk() {
  if (typeof globalThis === "undefined") {
    return null;
  }
  return globalThis.PokiSDK ?? null;
}

function callSdk(method, ...args) {
  const sdk = getSdk();
  const fn = sdk?.[method];
  if (typeof fn !== "function") {
    return null;
  }
  try {
    return fn.apply(sdk, args);
  } catch (_error) {
    return null;
  }
}

export const PokiAdapter = {
  initialized: false,
  loadingFinished: false,
  gameplayActive: false,

  installInputGuards() {
    if (typeof window === "undefined" || this.inputGuardsInstalled) {
      return;
    }

    window.addEventListener("keydown", (event) => {
      if (BLOCKED_INPUT_KEYS.has(event.key)) {
        event.preventDefault();
      }
    });
    window.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
    this.inputGuardsInstalled = true;
  },

  async init() {
    const result = callSdk("init");
    if (!result || typeof result.then !== "function") {
      this.initialized = true;
      return false;
    }

    try {
      await result;
    } catch (_error) {
      // Poki recommends loading the game anyway when initialization fails.
    }
    this.initialized = true;
    return true;
  },

  gameLoadingFinished() {
    if (this.loadingFinished) {
      return;
    }
    this.loadingFinished = true;
    callSdk("gameLoadingFinished");
  },

  gameplayStart() {
    if (this.gameplayActive) {
      return;
    }
    this.gameplayActive = true;
    callSdk("gameplayStart");
  },

  gameplayStop() {
    if (!this.gameplayActive) {
      return;
    }
    this.gameplayActive = false;
    callSdk("gameplayStop");
  },

  async commercialBreak(onStart) {
    this.gameplayStop();
    const result = callSdk("commercialBreak", onStart);
    if (!result || typeof result.then !== "function") {
      return false;
    }

    try {
      await result;
      return true;
    } catch (_error) {
      return false;
    }
  },

  async rewardedBreak(options = {}) {
    this.gameplayStop();
    const result = callSdk("rewardedBreak", options);
    if (!result || typeof result.then !== "function") {
      return false;
    }

    try {
      return Boolean(await result);
    } catch (_error) {
      return false;
    }
  }
};
