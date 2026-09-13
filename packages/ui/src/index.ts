/**
 * @refontiq/ui — Composants UI partagés
 * Package minimal pour le moment
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
