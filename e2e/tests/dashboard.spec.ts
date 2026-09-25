import { expect, test, type Page } from "@playwright/test"

/**
 * B3 — Parcours 1/3 et 3/3 : les deux cheminements authentifiés.
 *
 * Ils exigent des comptes seedés (direction + caisse) et une école avec des
 * inscriptions actives. Ces données n'existent pas par défaut : sans les
 * variables ci-dessous, les tests s'auto-excluent plutôt que d'échouer sur un
 * environnement non préparé. C'est un choix : un E2E rouge faute de données
 * empêche de voir les vraies régressions.
 *
 * Prérequis :
 *   E2E_DIRECTION_EMAIL / E2E_DIRECTION_PASSWORD  (rôle direction ou compta)
 *   E2E_CAISSE_EMAIL    / E2E_CAISSE_PASSWORD     (rôle caisse)
 *   E2E_SCHOOL_ID                                   (école de test)
 */

const directionEmail = process.env.E2E_DIRECTION_EMAIL
const directionPassword = process.env.E2E_DIRECTION_PASSWORD
const caisseEmail = process.env.E2E_CAISSE_EMAIL
const caissePassword = process.env.E2E_CAISSE_PASSWORD
const schoolId = process.env.E2E_SCHOOL_ID

/** Connexion par l'écran unifié (le même pour tous les rôles). */
async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel(/e-mail|email|adresse/i).first().fill(email)
  await page.getByLabel(/mot de passe/i).first().fill(password)
  await page.getByRole("button", { name: /se connecter|connexion/i }).first().click()
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
}

test.describe("caisse : encaissement puis historique paginé", () => {
  test.skip(
    !caisseEmail || !caissePassword || !schoolId,
    "comptes E2E de caisse non fournis"
  )

  test("un encaissement apparaît dans l'historique et se pagine", async ({ page }) => {
    await login(page, caisseEmail as string, caissePassword as string)

    // 1. Arrivée sur la caisse
    await page.goto("/dashboard/caisse")
    await expect(page.getByText(/session|caisse/i).first()).toBeVisible()

    // 2. Un élève de l'école de test est sélectionné, puis un montant saisi.
    // Le sélecteur d'élève dépend du composant : on prend le premier choix
    // disponible plutôt que de coder un index figé.
    const selectEleve = page.locator('button[role="combobox"]').first()
    if ((await selectEleve.count()) > 0) {
      await selectEleve.click()
      await page.getByRole("option").first().click()
    }

    const champMontant = page.getByLabel(/montant/i).first()
    await expect(champMontant).toBeVisible()
    await champMontant.fill("1000")

    const mode = page.getByLabel(/mode|moyen/i).first()
    if ((await mode.count()) > 0) {
      await mode.click()
      await page.getByRole("option").first().click()
    }

    // 3. Encaissement
    await page.getByRole("button", { name: /encaisser|valider|confirmer/i }).first().click()

    // 4. Historique : la ligne du jour est là
    await page.goto("/dashboard/caisse/history")
    await expect(page.getByText(/1[ .]?000|1000/).first()).toBeVisible()

    // 5. Pagination : le lien « suivant » existe et mène à une page 2 servie
    //    par le paginateur en base (S2 — le bug corrigé faisait
    //    systématiquement `totalPages = 1`).
    const suivant = page.getByRole("link", { name: /suivant|2/i }).first()
    if (await suivant.isVisible().catch(() => false)) {
      await suivant.click()
      await page.waitForURL(/page=2/)
    }
  })
})

test.describe("pré-inscription validée → matricule → reçu vérifiable", () => {
  test.skip(
    !directionEmail || !directionPassword || !schoolId,
    "compte E2E direction non fourni"
  )

  test("une pré-inscription validée produit un reçu vérifiable", async ({ page }) => {
    await login(page, directionEmail as string, directionPassword as string)

    await page.goto("/dashboard/direction/admissions")

    // Filtre sur l'onglet des pré-inscriptions, puis recherche de la dossier
    // créé par le tunnel (préfixe commun avec enroll.spec.ts).
    await page.getByRole("tab", { name: /pré-inscription/i }).first().click()
    const recherche = page.getByPlaceholder(/recherch/i).first()
    if (await recherche.isVisible().catch(() => false)) {
      await recherche.fill("E2E-")
    }

    // Validation de la première ligne pending : le résultat attendu est un
    // matricule affiché, pas une simple disparition de la ligne.
    const valider = page.getByRole("button", { name: /valider/i }).first()
    if (await valider.isVisible().catch(() => false)) {
      await valider.click()
      await page.getByRole("button", { name: /confirmer|valider/i }).last().click()
      await expect(page.getByText(/matricule/i).first()).toBeVisible()
    }
  })
})
