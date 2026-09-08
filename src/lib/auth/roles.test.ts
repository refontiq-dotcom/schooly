import { describe, expect, it } from "vitest";
import { canAccessPath, dashboardHomeForRole } from "./roles";

describe("dashboardHomeForRole", () => {
  it.each([
    ["admin", "/dashboard/admin"],
    ["professeur", "/dashboard/professeur"],
    ["secretariat", "/dashboard/secretariat"],
    ["censeur", "/dashboard/censeur"],
    ["parent", "/dashboard/parent"],
  ] as const)("renvoie le tableau de bord du rôle %s", (role, expected) => {
    expect(dashboardHomeForRole(role)).toBe(expected);
  });
});

describe("canAccessPath", () => {
  it("autorise l'accueil dashboard pour tous les rôles", () => {
    expect(canAccessPath("parent", "/dashboard")).toBe(true);
    expect(canAccessPath("professeur", "/dashboard")).toBe(true);
  });

  it("autorise chaque rôle sur sa propre section", () => {
    expect(canAccessPath("parent", "/dashboard/parent")).toBe(true);
    expect(canAccessPath("professeur", "/dashboard/professeur/notes")).toBe(true);
    expect(canAccessPath("secretariat", "/dashboard/secretariat/scan")).toBe(true);
  });

  it("autorise l'admin sur toutes les sections", () => {
    expect(canAccessPath("admin", "/dashboard/parent")).toBe(true);
    expect(canAccessPath("admin", "/dashboard/professeur")).toBe(true);
  });

  it("refuse les sections d'un autre rôle", () => {
    expect(canAccessPath("parent", "/dashboard/admin")).toBe(false);
    expect(canAccessPath("professeur", "/dashboard/secretariat")).toBe(false);
    expect(canAccessPath("censeur", "/dashboard/parent/suivi")).toBe(false);
  });

  it("refuse les chemins hors dashboard", () => {
    expect(canAccessPath("admin", "/etablissement/123")).toBe(false);
  });
});
