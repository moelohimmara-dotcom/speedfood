/**
 * Repère les comptes qui ressemblent à des comptes de test (aide au nettoyage, jamais une décision automatique : la
 * personne qui administre coche elle-même les comptes à supprimer, puis confirme). Critères volontairement étroits :
 * un mot « test » ou « essai » délimité dans la partie locale de l'adresse, un préfixe de bloc de développement
 * (`bloc8b-…`), ou un domaine réservé aux exemples (`@example.com`).
 */
export function estCompteDeTest(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const adresse = email.trim().toLowerCase();
  if (/@example\.(com|org|net)$/.test(adresse)) {
    return true;
  }
  const partieLocale = adresse.split("@")[0] ?? "";
  return /(^|[._+-])(test|essai|bloc\d+[a-z]?)($|[._+-])/.test(partieLocale);
}
