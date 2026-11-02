/**
 * Garde du point d'entrée du Worker : aucune requête EXTERNE n'atteint `/api/v1/interne/*`. L'appel légitime (RPC `alerter` de `JetonsCommande`) appelle
 * le gestionnaire OpenNext directement, sans passer par `fetch` du Worker, donc sans cette garde.
 *
 * Le chemin est décodé en boucle (3 passes au plus : `%2569` devient `%69` puis `i`), les `\` deviennent `/`, puis il est re-normalisé par l'analyseur d'adresses
 * (les `..` décodés sont résolus). On refuse si le motif `/api/v1/interne` y figure, OU si, après les 3 passes, il reste un `%` ou un `;` ET le mot `interne` :
 * un encodage profond ou un séparateur insolite ne se déguise pas en chemin légitime. On préfère refuser trop que pas assez, mais seulement quand `interne` est en jeu.
 * Pourcentage mal formé (`/r/caf%`) : le décodage échoue, on ne refuse QUE si le chemin brut contient `interne` ; sinon Next répond comme d'habitude.
 */
export function cheminInterneRefuse(url: string): boolean {
  let brut: string;
  try {
    brut = new URL(url).pathname.toLowerCase();
  } catch {
    return true;
  }
  let chemin = brut;
  for (let passe = 0; passe < 3; passe++) {
    let decode: string;
    try {
      decode = decodeURIComponent(chemin);
    } catch {
      return brut.includes("interne");
    }
    if (decode === chemin) break;
    chemin = decode;
  }
  chemin = chemin.replace(/\\/g, "/");
  try {
    chemin = new URL(`http://x${chemin.startsWith("/") ? "" : "/"}${chemin}`).pathname.toLowerCase();
  } catch {
    return brut.includes("interne");
  }
  chemin = chemin.replace(/\/{2,}/g, "/");
  if (chemin.includes("/api/v1/interne")) return true;
  if (!/[%;]/.test(chemin)) return false;
  // Encodage plus profond que 3 niveaux, ou `;` : on regarde ce que donnerait un décodage jusqu'au bout et on refuse dès que `interne` y apparaît.
  let fond = chemin;
  for (let passe = 0; passe < 10; passe++) {
    try {
      const decode = decodeURIComponent(fond);
      if (decode === fond) break;
      fond = decode;
    } catch {
      break;
    }
  }
  return fond.includes("interne") || brut.includes("interne");
}
