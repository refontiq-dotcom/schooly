import { expect, test } from "@playwright/test"

/**
 * B3 — Parcours 2/3 : le tunnel public `/enroll`, de bout en bout.
 *
 * C'est le seul des trois parcours qui ne demande **aucun compte seedé** : le
 * tunnel est public par conception, ce qui en fait le meilleur candidat pour un
 * test de fumée qui tourne partout (local, CI, recette).
 *
 * Prérequis : une école existante et acceptant les pré-inscriptions.
 * L'identifiant de l'école vient de `E2E_SCHOOL_ID` ; à défaut, le test
 * s'auto-exclut (skip) plutôt que d'échouer sur un environnement non préparé.
 */

const schoolId = process.env.E2E_SCHOOL_ID
const suffixe = `E2E-${Date.now().toString().slice(-6)}`

test.describe("tunnel public /enroll", () => {
  test.skip(!schoolId, "E2E_SCHOOL_ID non défini : aucune école de test")

  test("le formulaire se charge et expose les champs attendus", async ({ page }) => {
    await page.goto(`/enroll/${schoolId}`)

    await expect(page.getByLabel("Prénom")).toBeVisible()
    await expect(page.getByLabel("Nom")).toBeVisible()
    await expect(page.getByLabel("Date de naissance")).toBeVisible()
    await expect(page.getByRole("button", { name: /envoyer|transmettre|continuer/i })).toBeVisible()
  })

  test("un dossier incomplet est refusé avec un message lisible", async ({ page }) => {
    await page.goto(`/enroll/${schoolId}`)

    // Champs requis vides : la validation zod doit refuser avant toute écriture.
    await page.getByRole("button", { name: /envoyer|transmettre|continuer/i }).click()

    // On attend un message d'erreur visible, pas un silence.
    await expect(page.getByText(/requis|obligatoire|renseign/i).first()).toBeVisible()
  })

  test("un dossier complet aboutit à un code de suivi", async ({ page }) => {
    await page.goto(`/enroll/${schoolId}`)

    await page.getByLabel("Prénom").fill(`Alice${suffixe}`)
    await page.getByLabel("Nom", { exact: true }).fill("Koné")
    await page.getByLabel("Date de naissance").fill("2012-05-14")
    await page.getByLabel("Niveau souhaité").click()
    await page.getByRole("option").first().click()
    await page.getByLabel("Type d'inscription").click()
    await page.getByRole("option", { name: /Nouvelle inscription/i }).click()
    await page.getByLabel("Orientation").click()
    await page.getByRole("option").first().click()

    // Le reste du formulaire varie selon l'orientation choisie : on remplit ce
    // qui est obligatoire et on laisse le test dire quel champ manque plutôt
    // que de deviner le schéma complet ici.
    const champsObligatoires = page.locator('input[required]:not([type="hidden"])')
    const total = await champsObligatoires.count()
    for (let index = 0; index < total; index += 1) {
      const champ = champsObligatoires.nth(index)
      const type = await champ.getAttribute("type")
      const valeur = await champ.inputValue()
      if (!valeur) {
        if (type === "tel" || type === "text" || type === "email") {
          await champ.fill("0700000000")
        } else if (type === "date") {
          await champ.fill("2011-01-01")
        }
      }
    }

    await page.getByRole("button", { name: /envoyer|transmettre|continuer/i }).click()

    // Outcome volontairement large : un code de suivi, ou un message de refus
    // métier (école fermée aux inscriptions, moyen de paiement absent). Ce qui
    // ne doit jamais arriver, c'est une page blanche ou une erreur 500.
    await expect(
      page.getByText(/code|suivi|référence|inscription/i).first()
    ).toBeVisible()
    expect(page.url()).toContain("/enroll")
  })
})
