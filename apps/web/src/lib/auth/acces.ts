// Pur, sans dépendance serveur : testable seul (npm run test:unit). Deux pistes à l'entrée : « client » et « restaurateur ».

/** Ce que la personne a choisi au début (« Je suis client » ou « Je suis restaurateur »). */
export type RoleChoisi = "client" | "restaurateur";

/** Ce qu'est réellement le compte, d'après la base. */
export type TypeDeCompte =
  | "systeme" // rôle d'administration, sans restaurant
  | "restaurateur" // membre d'un restaurant
  | "client" // profil client existant
  | "nouveau"; // ni restaurant ni profil : compte tout juste confirmé, encore sans piste

export function lireRoleChoisi(brut: unknown): RoleChoisi | null {
  return brut === "client" || brut === "restaurateur" ? brut : null;
}

/** La piste d'une page protégée d'après sa destination (lien « suite ») : utile quand on arrive sans avoir choisi. */
export function roleDepuisSuite(suite: string): RoleChoisi | "systeme" | null {
  if (suite.startsWith("/system")) return "systeme";
  if (suite.startsWith("/restaurant") && !suite.startsWith("/restaurants")) return "restaurateur";
  // /commande, /suivi, /panier restent ouverts à tous (un restaurateur peut commander) : aucune piste imposée.
  if (suite.startsWith("/compte")) return "client";
  return null;
}

export function typeDeCompte(entree: { roleSysteme: boolean; membreRestaurant: boolean; profilClient: boolean }): TypeDeCompte {
  if (entree.membreRestaurant) return "restaurateur";
  if (entree.roleSysteme) return "systeme";
  if (entree.profilClient) return "client";
  return "nouveau";
}

export type VerdictAcces = { ok: true } | { ok: false; message: string; versLaBonnePiste: "/connexion?role=restaurateur" | "/connexion?role=client" };

/**
 * Filtre d'entrée : la personne a dit qui elle est ; le compte doit correspondre. Un compte « nouveau » (pas encore de restaurant ni de profil)
 * suit la piste choisie. Un compte d'administration n'est jamais bloqué sur la piste restaurateur.
 */
export function verifierPiste(choisi: RoleChoisi | null, reel: TypeDeCompte): VerdictAcces {
  if (choisi === null) return { ok: true };
  if (choisi === "client" && (reel === "restaurateur" || reel === "systeme")) {
    return {
      ok: false,
      message: "Ce compte est un compte restaurateur. Choisissez « Je suis restaurateur » pour vous connecter. Pour commander comme client, utilisez une autre adresse e-mail.",
      versLaBonnePiste: "/connexion?role=restaurateur",
    };
  }
  if (choisi === "restaurateur" && reel === "client") {
    return {
      ok: false,
      message: "Ce compte est un compte client. Choisissez « Je suis client » pour vous connecter. Pour gérer un restaurant, utilisez une autre adresse e-mail.",
      versLaBonnePiste: "/connexion?role=client",
    };
  }
  return { ok: true };
}

/** Où aller après une connexion réussie quand la piste est connue ; `null` = laisser le routage habituel (par type de compte). */
export function destinationSelonPiste(choisi: RoleChoisi | null, reel: TypeDeCompte): string | null {
  if (choisi === "restaurateur" && (reel === "nouveau" || reel === "restaurateur")) return "/restaurant";
  if (choisi === "client" && (reel === "nouveau" || reel === "client")) return "/compte";
  return null;
}
