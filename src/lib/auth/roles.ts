import type { UserRole } from "@/types";

export const DASHBOARD_HOME: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  professeur: "/dashboard/professeur",
  secretariat: "/dashboard/secretariat",
  censeur: "/dashboard/secretariat",
  parent: "/dashboard/parent",
};

export function dashboardHomeForRole(role: UserRole | null | undefined): string {
  if (!role) return "/dashboard/parent";
  return DASHBOARD_HOME[role] ?? "/dashboard/parent";
}

export function canAccessPath(
  role: UserRole | null | undefined,
  pathname: string
): boolean {
  if (!role) return false;

  if (pathname.startsWith("/onboarding")) {
    return role === "parent" || role === "admin";
  }

  if (pathname.startsWith("/auth/invitation")) {
    return true;
  }

  if (pathname.startsWith("/dashboard/admin")) {
    return role === "admin";
  }
  if (pathname.startsWith("/dashboard/professeur")) {
    return role === "professeur" || role === "admin";
  }
  if (pathname.startsWith("/dashboard/secretariat")) {
    return role === "secretariat" || role === "censeur" || role === "admin";
  }
  if (pathname.startsWith("/dashboard/parent")) {
    return role === "parent";
  }

  return false;
}

export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return null;
  }
  return value;
}
