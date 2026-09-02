import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "./auth-form";

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSignUp = vi.hoisted(() => vi.fn());
const mockSignIn = vi.hoisted(() => vi.fn());
const mockSignInWithGoogle = vi.hoisted(() => vi.fn());
const mockSearchParamsGet = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

vi.mock("@/lib/auth/actions", () => ({
  signUp: mockSignUp,
  signIn: mockSignIn,
  signInWithGoogle: mockSignInWithGoogle,
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function switchToRegister() {
  render(<AuthForm />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "S'inscrire" }));
  return user;
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides?: Partial<Record<string, string>>
) {
  const data: Record<string, string> = {
    full_name: "Jean Dupont",
    phone: "0612345678",
    email: "jean.dupont@example.com",
    password: "motdepasse123",
    ...overrides,
  };

  await user.type(screen.getByPlaceholderText("Nom complet"), data.full_name);
  await user.type(screen.getByPlaceholderText("Téléphone (optionnel)"), data.phone);
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

describe("AuthForm – formulaire d'inscription (test DOM)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockSignUp.mockResolvedValue(null);
    mockSignIn.mockResolvedValue(null);
  });

  describe("état initial (mode connexion)", () => {
    it("affiche le titre 'Connexion'", () => {
      render(<AuthForm />);
      expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
    });

    it("affiche les champs email et mot de passe mais PAS les champs inscription", () => {
      render(<AuthForm />);
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Nom complet")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Téléphone (optionnel)")).not.toBeInTheDocument();
    });

    it('affiche le bouton "Se connecter"', () => {
      render(<AuthForm />);
      expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
    });

    it("affiche le lien pour passer à l'inscription", () => {
      render(<AuthForm />);
      expect(screen.getByRole("button", { name: "S'inscrire" })).toBeInTheDocument();
    });
  });

  describe("basculement login → inscription", () => {
    it("passe en mode inscription et affiche les champs supplémentaires", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "S'inscrire" }));

      expect(screen.getByRole("heading", { name: "Inscription" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Nom complet")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Téléphone (optionnel)")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Mot de passe")).toBeInTheDocument();
    });

    it("affiche le bandeau info parent en mode inscription", async () => {
      const { container } = render(<AuthForm />);
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "S'inscrire" }));

      expect(container.textContent).toMatch(
        /inscription publique crée un compte parent/i
      );
    });

    it("change le texte du bouton de soumission en 'Créer mon compte parent'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "S'inscrire" }));

      expect(
        screen.getByRole("button", { name: "Créer mon compte parent" })
      ).toBeInTheDocument();
    });

    it("affiche le lien 'Déjà un compte ?' pour revenir à la connexion", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "S'inscrire" }));

      expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
    });
  });

  describe("soumission du formulaire d'inscription", () => {
    it("appelle signUp avec le FormData contenant tous les champs", async () => {
      const user = await switchToRegister();
      const expectedData = await fillRegisterForm(user);

      await user.click(screen.getByRole("button", { name: "Créer mon compte parent" }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignUp.mock.calls[0][1] as FormData;
      expect(formData.get("email")).toBe(expectedData.email);
      expect(formData.get("full_name")).toBe(expectedData.full_name);
      expect(formData.get("phone")).toBe(expectedData.phone);
      expect(formData.get("password")).toBe(expectedData.password);
    });

    it("le champ email est required et de type email", () => {
      render(<AuthForm />);
      const emailInput = screen.getByPlaceholderText("Email") as HTMLInputElement;
      expect(emailInput.required).toBe(true);
      expect(emailInput.type).toBe("email");
    });

    it("le champ mot de passe est required avec minLength de 6", () => {
      render(<AuthForm />);
      const passwordInput = screen.getByPlaceholderText("Mot de passe") as HTMLInputElement;
      expect(passwordInput.required).toBe(true);
      expect(passwordInput.minLength).toBe(6);
    });

    it("transmet returnTo dans le FormData quand le paramètre est présent", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "returnTo" ? "/dashboard/parent" : null
      );

      const user = await switchToRegister();
      await fillRegisterForm(user);

      await user.click(screen.getByRole("button", { name: "Créer mon compte parent" }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignUp.mock.calls[0][1] as FormData;
      expect(formData.get("returnTo")).toBe("/dashboard/parent");
    });

    it("n'envoie pas de returnTo dans le FormData quand le paramètre est absent", async () => {
      mockSearchParamsGet.mockReturnValue(null);

      const user = await switchToRegister();
      await fillRegisterForm(user);

      await user.click(screen.getByRole("button", { name: "Créer mon compte parent" }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignUp.mock.calls[0][1] as FormData;
      expect(formData.get("returnTo")).toBeNull();
    });
  });

  describe("affichage des erreurs", () => {
    it("affiche l'erreur retournée par signUp", async () => {
      mockSignUp.mockResolvedValue("Email déjà utilisé");

      const user = await switchToRegister();
      await fillRegisterForm(user);

      await user.click(screen.getByRole("button", { name: "Créer mon compte parent" }));

      await waitFor(() => {
        expect(screen.getByText("Email déjà utilisé")).toBeInTheDocument();
      });
    });

    it("n'affiche pas de message d'erreur quand signUp réussit", async () => {
      mockSignUp.mockResolvedValue(null);

      const user = await switchToRegister();
      await fillRegisterForm(user);

      await user.click(screen.getByRole("button", { name: "Créer mon compte parent" }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledTimes(1);
      });

      expect(document.querySelector(".bg-red-50")).toBeNull();
    });

    it("affiche l'erreur OAuth depuis les paramètres d'URL", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "error" ? "Erreur Google" : null
      );

      render(<AuthForm />);

      expect(screen.getByText("Erreur Google")).toBeInTheDocument();
    });
  });

  describe("toggle visibilité du mot de passe", () => {
    it("affiche le mot de passe en texte clair quand on clique sur 'Afficher'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      const passwordInput = screen.getByPlaceholderText("Mot de passe") as HTMLInputElement;
      expect(passwordInput.type).toBe("password");

      await user.click(screen.getByRole("button", { name: "Afficher" }));
      expect(passwordInput.type).toBe("text");
    });

    it("masque le mot de passe quand on clique sur 'Masquer'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      const passwordInput = screen.getByPlaceholderText("Mot de passe") as HTMLInputElement;
      await user.click(screen.getByRole("button", { name: "Afficher" }));
      expect(passwordInput.type).toBe("text");

      await user.click(screen.getByRole("button", { name: "Masquer" }));
      expect(passwordInput.type).toBe("password");
    });

    it("fonctionne aussi en mode inscription", async () => {
      const user = await switchToRegister();

      const passwordInput = screen.getByPlaceholderText("Mot de passe") as HTMLInputElement;
      await user.click(screen.getByRole("button", { name: "Afficher" }));
      expect(passwordInput.type).toBe("text");
      expect(passwordInput.autocomplete).toBe("new-password");

      await user.click(screen.getByRole("button", { name: "Masquer" }));
      expect(passwordInput.type).toBe("password");
    });
  });

  describe("bouton Google", () => {
    it("affiche le bouton 'Continuer avec Google'", () => {
      render(<AuthForm />);
      expect(
        screen.getByRole("button", { name: "Continuer avec Google" })
      ).toBeInTheDocument();
    });

    it("appelle signInWithGoogle au clic sur 'Continuer avec Google'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "Continuer avec Google" }));

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("revenir au mode connexion depuis l'inscription", () => {
    it("revient au formulaire de connexion quand on clique sur 'Se connecter'", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "S'inscrire" }));
      expect(screen.getByRole("heading", { name: "Inscription" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Se connecter" }));
      expect(screen.getByRole("heading", { name: "Connexion" })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Nom complet")).not.toBeInTheDocument();
    });
  });

  describe("mode connexion – soumission du formulaire", () => {
    it("appelle signIn avec le FormData contenant email et mot de passe", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await fillLoginForm(user);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignIn.mock.calls[0][1] as FormData;
      expect(formData.get("email")).toBe("jean.dupont@example.com");
      expect(formData.get("password")).toBe("motdepasse123");
      expect(formData.get("returnTo")).toBeNull();
    });

    it("transmet returnTo dans le FormData en mode connexion aussi", async () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === "returnTo" ? "/dashboard/parent" : null
      );

      const user = userEvent.setup();
      render(<AuthForm />);
      await fillLoginForm(user);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledTimes(1);
      });

      const formData = mockSignIn.mock.calls[0][1] as FormData;
      expect(formData.get("returnTo")).toBe("/dashboard/parent");
    });

    it("affiche l'erreur retournée par signIn", async () => {
      mockSignIn.mockResolvedValue("Identifiants incorrects");

      const user = userEvent.setup();
      render(<AuthForm />);
      await fillLoginForm(user);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      await waitFor(() => {
        expect(screen.getByText("Identifiants incorrects")).toBeInTheDocument();
      });
    });

    it("désactive le bouton et affiche 'Chargement…' pendant la soumission", async () => {
      // Promesse qui ne se résout jamais => pending reste true.
      mockSignIn.mockReturnValue(new Promise(() => {}));

      const user = userEvent.setup();
      render(<AuthForm />);
      await fillLoginForm(user);

      await user.click(screen.getByRole("button", { name: "Se connecter" }));

      const loadingButton = await screen.findByRole("button", { name: "Chargement…" });
      expect(loadingButton).toBeDisabled();
    });
  });
});

