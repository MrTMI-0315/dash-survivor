import { expect, test } from "@playwright/test";

async function clickCanvasAtDesignPoint(page, designX, designY) {
  const canvas = page.locator("#game-root canvas").first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + (box.width * designX) / 1280, box.y + (box.height * designY) / 720);
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
  await page.waitForTimeout(300);
  await clickCanvasAtDesignPoint(page, 640, 300);

  // Give the first render tick a brief window so startup failures can surface.
  await page.waitForTimeout(2_000);

  const filteredConsoleErrors = consoleErrors.filter((entry) => !entry.includes("favicon.ico"));

  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(filteredConsoleErrors, `Unexpected console errors:\n${filteredConsoleErrors.join("\n")}`).toEqual([]);
});
