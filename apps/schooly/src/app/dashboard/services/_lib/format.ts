// Formatage monétaire partagé par les écrans services (transport, cantine,
// internat). L'existant affichait « 12 500 FCFA » avec l'espace fine
// d'Intl : cette fonction est la seule source de vérité.
export function fmtCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}
