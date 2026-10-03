// Pur, sans dépendance : testable seul (npm run test:unit).

/**
 * Un abonné IPv6 reçoit un /64 entier : sans regroupement, il changerait d'adresse à
 * volonté pour contourner le plafond par IP (revue de sécurité, point 9). On ne garde que
 * les 64 premiers bits ; les adresses IPv4 sont inchangées.
 */
export function regrouperIpv6(adresse: string): string {
  if (!adresse.includes(":")) {
    return adresse;
  }
  const [hote] = adresse.split("%");
  const doubleDeuxPoints = hote.indexOf("::");
  let groupes: string[];
  if (doubleDeuxPoints === -1) {
    groupes = hote.split(":");
  } else {
    const avant = hote.slice(0, doubleDeuxPoints).split(":").filter((g) => g !== "");
    const apres = hote.slice(doubleDeuxPoints + 2).split(":").filter((g) => g !== "");
    const manquants = Math.max(0, 8 - avant.length - apres.length);
    groupes = [...avant, ...Array(manquants).fill("0"), ...apres];
  }
  if (groupes.length !== 8 || groupes.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) {
    return adresse;
  }
  return groupes
    .slice(0, 4)
    .map((g) => g.toLowerCase().padStart(4, "0"))
    .join(":") + "::/64";
}
