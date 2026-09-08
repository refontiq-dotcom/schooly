import type { UserRole } from "@/types";

export const DASHBOARD_ROLES: readonly UserRole[] = [
  "admin",
  "professeur",
  "secretariat",
  "censeur",
  "parent",
];

export function dashboardHomeForRole(role: UserRole): string {
  return `/dashboard/${role}`;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;

  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  if (!match) return false;

  if (role === "admin") return true;
  return match[1] === role;
}
