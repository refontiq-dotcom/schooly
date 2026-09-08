import { test, expect } from "@playwright/test";

test("la page d'accueil affiche Schooly", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Schooly/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("School");
});

test("la page de connexion parent est accessible", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion parent");
});
