// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Entrée de navigation active : celle dont l'adresse est la plus PRÉCISE parmi celles qui correspondent à la page.
 * Avec une simple recherche par préfixe, `/system/livraisons/livreurs` allumait aussi `/system/livraisons` (le menu latéral et
 * les onglets montraient deux entrées actives à la fois).
 */
export function entreeActive(chemin: string, adresses: readonly string[]): string | null {
  let meilleure: string | null = null;
  for (const adresse of adresses) {
    const correspond = chemin === adresse || chemin.startsWith(`${adresse}/`);
    if (correspond && (meilleure === null || adresse.length > meilleure.length)) meilleure = adresse;
  }
  return meilleure;
}
