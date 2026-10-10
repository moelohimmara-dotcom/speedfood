/**
 * Profil client (compte facultatif) : avatar choisi dans une liste fermée et pseudo amusant. Aucune photo, aucune donnée
 * issue de Facebook n'est reprise ici : le profil Speedfood est un simple pseudo et un avatar. La liste des avatars doit
 * rester identique à la contrainte de la table `client_profils` (migration `profils_clients`).
 */
export const AVATARS = [
  { cle: "burger", emoji: "🍔", libelle: "Burger" },
  { cle: "pizza", emoji: "🍕", libelle: "Pizza" },
  { cle: "riz", emoji: "🍚", libelle: "Riz" },
  { cle: "poulet", emoji: "🍗", libelle: "Poulet" },
  { cle: "poisson", emoji: "🐟", libelle: "Poisson" },
  { cle: "cafe", emoji: "☕", libelle: "Café" },
  { cle: "pain", emoji: "🥖", libelle: "Pain" },
  { cle: "salade", emoji: "🥗", libelle: "Salade" },
  { cle: "brochette", emoji: "🍢", libelle: "Brochette" },
  { cle: "glace", emoji: "🍦", libelle: "Glace" },
] as const;

export type CleAvatar = (typeof AVATARS)[number]["cle"];

export function estAvatarValide(valeur: unknown): valeur is CleAvatar {
  return typeof valeur === "string" && AVATARS.some((a) => a.cle === valeur);
}

export function emojiAvatar(cle: string): string {
  return AVATARS.find((a) => a.cle === cle)?.emoji ?? "🍽️";
}

// Mots courts : « nom adjectif nombre » reste sous les 24 caractères de la contrainte (9 + 1 + 8 + 1 + 2 = 21 au plus).
const NOMS = ["Gourmand", "Croqueur", "Festin", "Piment", "Marmite", "Braise", "Savoureux", "Dégustant", "Appétit", "Délice"];
const ADJECTIFS = ["Rapide", "Malin", "Joyeux", "Épicé", "Doré", "Croustillant", "Affamé", "Chanceux", "Curieux", "Futé"];

/** Pseudo amusant, par exemple « Piment Malin 42 ». `alea` est injectable pour les tests. */
export function genererPseudo(alea: () => number = Math.random): string {
  const choisir = <T,>(liste: readonly T[]) => liste[Math.min(liste.length - 1, Math.floor(alea() * liste.length))];
  const nombre = 10 + Math.min(89, Math.floor(alea() * 90));
  return `${choisir(NOMS)} ${choisir(ADJECTIFS)} ${nombre}`;
}

const PSEUDO_AUTORISE = /^[A-Za-zÀ-ÿ0-9 _.-]+$/;

export type ResultatPseudo = { ok: true; pseudo: string } | { ok: false; erreur: string };

/** Nettoie (espaces) puis vérifie : 3 à 24 caractères, lettres, chiffres, espace, point, tiret, tiret bas. */
export function validerPseudo(brut: string): ResultatPseudo {
  const pseudo = brut.replace(/\s+/g, " ").trim();
  if (pseudo.length < 3 || pseudo.length > 24) {
    return { ok: false, erreur: "Le pseudo doit contenir entre 3 et 24 caractères." };
  }
  if (!PSEUDO_AUTORISE.test(pseudo)) {
    return { ok: false, erreur: "Le pseudo peut contenir des lettres, des chiffres, des espaces, des points et des tirets." };
  }
  return { ok: true, pseudo };
}

/**
 * Pseudo d'un compte inscrit par le formulaire : le nom saisi quand il respecte la contrainte (3 à 24 caractères,
 * caractères autorisés), sinon un pseudo amusant. `alea` est injectable pour les tests.
 */
export function pseudoPourCompte(nom: string, alea: () => number = Math.random): string {
  const depuisNom = validerPseudo(nom);
  return depuisNom.ok ? depuisNom.pseudo : genererPseudo(alea);
}

/**
 * Avatar de la liste fermée, choisi de façon STABLE à partir d'une graine (l'identifiant du compte) : le même compte
 * retrouve toujours le même avatar, et la valeur reste dans la contrainte de la table `client_profils`.
 */
export function avatarPourGraine(graine: string): CleAvatar {
  let total = 0;
  for (let i = 0; i < graine.length; i++) {
    total = (total * 31 + graine.charCodeAt(i)) % 100000;
  }
  return AVATARS[total % AVATARS.length].cle;
}
