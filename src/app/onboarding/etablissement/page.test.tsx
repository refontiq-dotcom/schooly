import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CreateEstablishmentPage from "./page";

vi.mock("@/lib/auth/actions", () => ({
  createEstablishment: vi.fn(),
}));

describe("Onboarding – création d'établissement", () => {
  it("n'affiche aucune option de publication Trouvetou", () => {
    render(<CreateEstablishmentPage />);

    expect(
      document.querySelector('input[name="publish_to_trouvetou"]')
    ).toBeNull();
    expect(screen.queryByText(/Trouvetou/i)).toBeNull();
  });

  it("exige la sélection d'un type avant soumission", async () => {
    const user = userEvent.setup();
    render(<CreateEstablishmentPage />);

    const submit = screen.getByRole("button", {
      name: /Créer et devenir administrateur/i,
    });
    expect(submit).toBeDisabled();
    expect(document.querySelector('input[name="school_type"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: /Lycée/ }));

    const schoolType = document.querySelector('input[name="school_type"]');
    expect(schoolType).not.toBeNull();
    expect(schoolType).toHaveValue("lycee");
    expect(submit).toBeEnabled();
  });

  it("affiche les niveaux prédéfinis du type choisi", async () => {
    const user = userEvent.setup();
    render(<CreateEstablishmentPage />);

    await user.click(screen.getByRole("button", { name: /Collège/ }));

    expect(screen.getByText("6ème")).toBeInTheDocument();
    expect(screen.getByText(/Niveaux prédéfinis/i)).toBeInTheDocument();
  });
});
