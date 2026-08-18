import { expect, test } from "@playwright/test";

test.describe("builder live preview fidelity (demo mode, no backend)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder");
  });

  test("product grid preview renders real product rows from block state", async ({ page }) => {
    const grid = page.getByRole("button", { name: /Choose your finish/ });
    await expect(grid).toBeVisible();
    await expect(grid.getByText("Orbit / Lilac")).toBeVisible();
    await expect(grid.getByText("Orbit / Ink")).toBeVisible();
    await expect(grid.getByText("₹2,499")).toHaveCount(2);
    await expect(grid.locator('img[alt="Lilac Orbit bottle"]')).toBeVisible();
    await expect(grid.locator('img[alt="Ink Orbit bottle"]')).toBeVisible();
  });

  test("editing a product image URL updates the live grid preview", async ({ page }) => {
    await page.getByRole("button", { name: /⋮⋮ 04 Product grid/ }).click();
    const urlInput = page.getByRole("textbox", { name: "Image URL" }).first();
    await urlInput.fill("https://cdn.northstargoods.in/orbit-lilac.jpg");
    await expect(
      page.getByRole("button", { name: /Choose your finish/ }).locator('img[alt="Lilac Orbit bottle"]'),
    ).toHaveAttribute("src", "https://cdn.northstargoods.in/orbit-lilac.jpg");
  });

  test("hero image URL edits render in the canvas immediately", async ({ page }) => {
    await page.getByRole("button", { name: /Hydration, minus the bulk/ }).click();
    await page.getByRole("textbox", { name: "Image URL" }).fill("https://cdn.northstargoods.in/orbit-hero.jpg");
    const hero = page.getByRole("button", { name: /Hydration, minus the bulk/ });
    await expect(hero.locator("img")).toHaveAttribute("src", "https://cdn.northstargoods.in/orbit-hero.jpg");
    await expect(hero).not.toContainText("FEATURE");
  });

  test("images-off mode hides images and preserves alt text from state", async ({ page }) => {
    await page.getByRole("button", { name: "Images off" }).click();
    await expect(page.locator("canvas img, .emailCanvas img, img[src]")).toHaveCount(0);
    const grid = page.getByRole("button", { name: /Choose your finish/ });
    await expect(grid.getByText("Alt: Lilac Orbit bottle")).toBeVisible();
    await expect(grid.getByText("Alt: Ink Orbit bottle")).toBeVisible();
  });

  test("new product grids show data-driven cards and no fake body summary", async ({ page }) => {
    await page.getByRole("button", { name: /Products/ }).click();
    const grid = page.getByRole("button", { name: /Featured products/ });
    await expect(grid.getByText("Featured product one")).toBeVisible();
    await expect(grid.getByText("Featured product two")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Body" })).toHaveCount(0);
    await expect(page.getByText("Product one · ₹1,999")).toHaveCount(0);
  });

  test("placeholder product hosts are warned and release render fails closed", async ({ page }) => {
    await page.getByRole("button", { name: /⋮⋮ 04 Product grid/ }).click();
    const warning = page.getByText(/Development\/placeholder image URLs are blocked at release/);
    await expect(warning.first()).toBeVisible();
    await page.getByRole("button", { name: "Render HTML" }).click();
    await expect(page.getByRole("button", { name: "Render HTML" })).toBeEnabled({ timeout: 30000 });
    await expect(page.getByText(/Release blocked by QA: IMAGE_PLACEHOLDER/)).toBeVisible();
  });
});
