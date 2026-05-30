import { expect, test } from "@playwright/test";

async function clickCanvasAtDesignPoint(page, designX, designY) {
  const canvas = page.locator("#game-root canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + (box.width * designX) / 1280, box.y + (box.height * designY) / 720);
}

async function getQaSnapshot(page) {
  return page.evaluate(() => {
    const qa = globalThis.__DASH_SURVIVOR_QA__;
    if (!qa) {
      return null;
    }
    try {
      return qa.getSnapshot();
    } catch (error) {
      return { error: error?.message ?? String(error) };
    }
  });
}

async function getGameSceneState(page) {
  return page.evaluate(() => {
    const scene = globalThis.__DASH_SURVIVOR_GAME__?.scene?.getScene("GameScene");
    if (!scene) {
      return null;
    }
    return {
      active: scene.scene?.isActive?.() ?? false,
      isWeaponSelecting: Boolean(scene.isWeaponSelecting),
      selectedStartWeaponId: scene.selectedStartWeaponId,
      weaponSelectionError: scene.weaponSelectionError,
      weaponCount: scene.player?.weapons?.length ?? 0
    };
  });
}

test("loads game shell and creates Phaser canvas without fatal errors", async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];

  await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", async (route) => {
    await route.fulfill({
      contentType: "text/javascript",
      body: `
        globalThis.PokiSDK = {
          init: () => Promise.resolve(),
          gameLoadingFinished: () => {},
          gameplayStart: () => {},
          gameplayStop: () => {},
          commercialBreak: () => Promise.resolve(),
          rewardedBreak: () => Promise.resolve(false)
        };
      `
    });
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("#game-root")).toBeVisible();
  await expect(page.locator("#game-root canvas").first()).toBeVisible({ timeout: 20_000 });

  await clickCanvasAtDesignPoint(page, 640, 352);
  await page.waitForFunction(() => {
    const scene = globalThis.__DASH_SURVIVOR_GAME__?.scene?.getScene("GameScene");
    return scene?.scene?.isActive?.() ?? false;
  });
  const weaponModalState = await getGameSceneState(page);
  expect(weaponModalState.weaponSelectionError).toBeNull();
  if (weaponModalState.isWeaponSelecting) {
    await clickCanvasAtDesignPoint(page, 640, 300);
  }
  await page.waitForFunction(() => {
    const scene = globalThis.__DASH_SURVIVOR_GAME__?.scene?.getScene("GameScene");
    return scene?.player?.weapons?.length > 0 && !scene.isWeaponSelecting;
  });
  await page.waitForTimeout(150);

  const preDash = await getQaSnapshot(page);
  expect(preDash).not.toBeNull();
  expect(preDash.run.selectedStartWeaponId).toBeTruthy();
  expect(preDash.run.isWeaponSelecting).toBe(false);
  expect(preDash.run.isLeveling).toBe(false);
  expect(preDash.player.dashGauge).toBe(preDash.player.dashGaugeMax);
  expect(preDash.player.insideShipDeck).toBe(true);
  expect(preDash.map.clampedCornerInsideDeck).toBe(true);
  expect(preDash.map.playerSpawnIsInvalidEnemySpawn).toBe(true);
  expect(preDash.source.path).toContain("v2_environment_source.png");
  expect(preDash.source.scaleX).toBeGreaterThan(1);
  expect(preDash.source.scaleY).toBeGreaterThan(1);

  await clickCanvasAtDesignPoint(page, 640, 360);
  await page.keyboard.down("KeyD");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.up("KeyD");

  const postDash = await getQaSnapshot(page);
  expect(postDash.player.dashGauge).toBeLessThan(postDash.player.dashGaugeMax);
  expect(postDash.player.insideShipDeck).toBe(true);

  // Give the first render tick a brief window so startup failures can surface.
  await page.waitForTimeout(2_000);

  const filteredConsoleErrors = consoleErrors.filter((entry) => !entry.includes("favicon.ico"));

  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(filteredConsoleErrors, `Unexpected console errors:\n${filteredConsoleErrors.join("\n")}`).toEqual([]);
});
