/**
 * Masquage des coordonnées clients (bloc 8a, TDR.md §4 et ADR-010) :
 * téléphone et adresse sont MASQUÉS PAR DÉFAUT dans le CMS système, pour tout
 * rôle. Seule la permission `coordonees.voir` (support et super_admin) autorise
 * l'affichage en clair, avec un motif obligatoire et une trace d'audit — voir
 * `revelerCoordonneesCommande` dans `./audit`.
 *
 * Fichier volontairement sans `server-only` : fonctions pures, testables et
 * réutilisables aussi bien dans un Server Component que dans un composant
 * client d'affichage. Aucune donnée réelle n'est stockée ici.
 */

/** Valeurs affichées à l'écran, après application (ou non) du masquage. */
export interface CoordonneesAffichees {
  telephone: string;
  adresse: string;
  /** Vrai uniquement si la permission `coordonees.voir` a été vérifiée ET journalisée. */
  devoilees: boolean;
}

export interface CoordonneesBrutes {
  client_telephone: string;
  client_adresse: string | null;
}

/**
 * Masque un numéro de téléphone en gardant son contexte de lecture :
 * - l'indicatif international (`+` et 1 à 3 chiffres, ex. `+224`) reste visible ;
 * - dans le numéro local : le premier chiffre et les deux derniers restent
 *   visibles (ex. `+224 622 34 56 78` → `+224 6** ** ** 78`) ;
 * - si le numéro local compte moins de 5 chiffres, seul le dernier reste
 *   visible (assez de contexte pour identifier un appel, pas assez pour rappeler) ;
 * - les séparateurs d'origine (espaces, tirets, points) sont conservés.
 */
export function masquerTelephone(telephone: string): string {
  const valeur = telephone.trim();
  if (valeur === "") {
    return "";
  }

  const estChiffre = (caractere: string): boolean => caractere >= "0" && caractere <= "9";
  const positionsChiffres: number[] = [];
  for (let i = 0; i < valeur.length; i++) {
    if (estChiffre(valeur[i])) {
      positionsChiffres.push(i);
    }
  }
  if (positionsChiffres.length === 0) {
    return "***";
  }

  // Longueur de l'indicatif international : « + » suivi de 1 à 3 chiffres.
  let chiffresIndicatif = 0;
  if (valeur.startsWith("+")) {
    let i = 1;
    while (i < valeur.length && chiffresIndicatif < 3 && estChiffre(valeur[i])) {
      chiffresIndicatif++;
      i++;
    }
  }

  const positionsLocales = positionsChiffres.slice(chiffresIndicatif);
  const positionsVisibles = new Set<number>(positionsChiffres.slice(0, chiffresIndicatif));
  if (positionsLocales.length >= 5) {
    positionsVisibles.add(positionsLocales[0]);
    positionsVisibles.add(positionsLocales[positionsLocales.length - 1]);
    positionsVisibles.add(positionsLocales[positionsLocales.length - 2]);
  } else if (positionsLocales.length > 0) {
    positionsVisibles.add(positionsLocales[positionsLocales.length - 1]);
  }

  let resultat = "";
  for (let i = 0; i < valeur.length; i++) {
    const caractere = valeur[i];
    if (!estChiffre(caractere)) {
      resultat += caractere;
    } else if (positionsVisibles.has(i)) {
      resultat += caractere;
    } else {
      resultat += "*";
    }
  }
  return resultat;
}

/**
 * Masque une adresse en ne conservant que le quartier, c'est-à-dire le dernier
 * segment de l'adresse (après la dernière virgule), sans chiffres (un numéro de
 * rue ne doit pas survivre au masquage). Ex. `12 rue du Marché, Madina` →
 * `Quartier : Madina`. Sans quartier identifiable, l'adresse est masquée
 * entièrement.
 */
export function masquerAdresse(adresse: string | null): string {
  const valeur = adresse?.trim() ?? "";
  if (valeur === "") {
    return "Adresse non renseignée";
  }

  const segments = valeur
    .split(",")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "");
  const dernier = segments.length > 0 ? segments[segments.length - 1] : "";

  if (segments.length < 2) {
    return "Adresse masquée";
  }

  const quartier = dernier
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (quartier === "") {
    return "Adresse masquée";
  }

  return `Quartier : ${quartier.slice(0, 60)}`;
}

/**
 * Prépare les coordonnées à afficher. Par défaut (`devoilees = false`) tout est
 * masqué ; `devoilees = true` ne doit être passé qu'après vérification de la
 * permission `coordonees.voir` ET journalisation — voir
 * `revelerCoordonneesCommande` dans `./audit`, qui est le seul chemin normal de
 * dévoilement.
 */
export function afficherCoordonnees(
  donnees: CoordonneesBrutes,
  devoilees: boolean
): CoordonneesAffichees {
  if (devoilees) {
    return {
      telephone: donnees.client_telephone.trim() === "" ? "Téléphone non renseigné" : donnees.client_telephone,
      adresse: donnees.client_adresse?.trim() === "" || donnees.client_adresse === null
        ? "Adresse non renseignée"
        : donnees.client_adresse,
      devoilees: true,
    };
  }
  return {
    telephone: masquerTelephone(donnees.client_telephone),
    adresse: masquerAdresse(donnees.client_adresse),
    devoilees: false,
  };
}
