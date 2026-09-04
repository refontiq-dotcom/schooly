import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "./auth-form";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockSignInParent = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

vi.mock("@/lib/auth/actions", () => ({
  signUp: (...args: unknown[]) => mockSignUp(...args),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInParent: (...args: unknown[]) => mockSignInParent(...args),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function navigateToEstablishmentLogin() {
  render(<AuthForm />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /établissement/i }));
  return user;
}

async function navigateToEstablishmentRegister() {
  const user = await navigateToEstablishmentLogin();
  await user.click(screen.getByRole("button", { name: "S'inscrire" }));
  return user;
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides?: Partial<Record<string, string>>
) {
  const data: Record<string, string> = {
    full_name: "Jean Dupont",
    email: "jean.dupont@example.com",
    password: "motdepasse123",
    ...overrides,
  };

  await user.type(screen.getByPlaceholderText("Nom complet"), data.full_name);
  await user.type(screen.getByPlaceholderText("Email"), data.email);
  await user.type(screen.getByPlaceholderText("Mot de passe"), data.password);

  return data;
}

async function fillLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Email"), "jean.dupont@example.com");
  await user.type(screen.getByPlaceholderText("Mot de passe"), "motdepasse123");
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe("AuthForm – rôle selecteur et formulaire", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockSignUp.mockResolvedValue(null);
    mockSignIn.mockResolvedValue(null);
  });

  describe("écran de sélection du rôle", () => {
    it("affiche le titre de bienvenue", () => {
      render(<AuthForm />);
      expect(screen.getByRole("heading", { name: /Bienvenue sur Schooly/ })).toBeInTheDocument();
    });

    it("affiche les deux options : parent et établissement", () => {
      render(<AuthForm />);
      expect(screen.getByRole("button", { name: /Je suis parent/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Établissement scolaire/ })).toBeInTheDocument();
    });
  });

  describe("flux parent – connexion par téléphone", () => {
    it("affiche le formulaire de téléphone après avoir cliqué 'Je suis parent'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: /Je suis parent/ }));

      expect(screen.getByRole("heading", { name: /Connexion parent/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/\+225/)).toBeInTheDocument();
    });

    it("appelle signInParent avec le FormData contenant le téléphone", async () => {
      mockSignInParent.mockResolvedValue(null);

      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: /Je suis parent/ }));
      await user.type(screen.getByPlaceholderText(/\+225/), "+2250700000001");
      await user.click(screen.getByRole("button", { name: /Recevoir le lien/ }));

      await waitFor(() => {
        expect(mockSignInParent).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignInParent.mock.calls[0][1] as FormData;
      expect(formData.get("phone")).toBe("+2250700000001");
    });

    it("affiche un message de succès quand signInParent renvoie un succès", async () => {
      mockSignInParent.mockResolvedValue("__SUCCESS__Lien envoyé !");

      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: /Je suis parent/ }));
      await user.type(screen.getByPlaceholderText(/\+225/), "+2250700000001");
      await user.click(screen.getByRole("button", { name: /Recevoir le lien/ }));

      await waitFor(() => {
        expect(screen.getByText(/Lien envoyé/)).toBeInTheDocument();
      });
    });
  });

  describe("flux établissement – formulaire email/mot de passe", () => {
    it("affiche le formulaire de connexion après avoir cliqué 'Établissement'", async () => {
      const user = await navigateToEstablishmentLogin();

      expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
    });

    it("appelle signIn avec email et mot de passe", async () => {
      const user = await navigateToEstablishmentLogin();
      await fillLoginForm(user);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignIn.mock.calls[0][1] as FormData;
      expect(formData.get("email")).toBe("jean.dupont@example.com");
      expect(formData.get("password")).toBe("motdepasse123");
    });

    it("passe en mode inscription et affiche les champs", async () => {
      const user = await navigateToEstablishmentRegister();

      expect(screen.getByRole("heading", { name: /Inscription établissement/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Nom complet")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
    });

    it("affiche le lien 'Changer de compte' pour revenir au sélecteur", async () => {
      const user = await navigateToEstablishmentLogin();

      await user.click(screen.getByRole("button", { name: /Changer de compte/ }));
      expect(screen.getByRole("heading", { name: /Bienvenue sur Schooly/ })).toBeInTheDocument();
    });
  });
});
