import { expect, test } from "@playwright/test";

test("loads game shell and creates Phaser canvas without fatal errors", async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];

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

  // Give the first render tick a brief window so startup failures can surface.
  await page.waitForTimeout(1_000);

  const filteredConsoleErrors = consoleErrors.filter((entry) => !entry.includes("favicon.ico"));

  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(filteredConsoleErrors, `Unexpected console errors:\n${filteredConsoleErrors.join("\n")}`).toEqual([]);
});
