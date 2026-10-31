const encodeur = new TextEncoder();

async function empreinte(valeur: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encodeur.encode(valeur)));
}

/** Comparaison à temps constant : on compare les EMPREINTES (longueur fixe), octet par octet, sans sortie anticipée. */
async function memeSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([empreinte(a), empreinte(b)]);
  let ecart = 0;
  for (let i = 0; i < ha.length; i++) ecart |= ha[i] ^ hb[i];
  return ecart === 0;
}

/** Forme du secret de relais attendu : 32 caractères au moins, ASCII visible seulement (ni espace, ni retour à la ligne, ni accent). Hors de cette forme, l'API ne fait jamais confiance au relais, même si l'appelant envoie la même valeur. */
export const SECRET_RELAIS_VALIDE = /^[\x21-\x7E]{32,}$/;

/** L'adresse transmise a l'allure d'une adresse IP : 45 caractères au plus, `[0-9a-fA-F:.]` seulement (ni espace, ni retour à la ligne, ni texte libre). Ne prouve pas la validité. */
export function adresseRelaisPlausible(valeur: string | null | undefined): valeur is string {
  return typeof valeur === "string" && valeur.length > 0 && valeur.length <= 45 && /^[0-9a-fA-F:.]+$/.test(valeur);
}

/**
 * Le site relaie des requêtes vers l'API : l'adresse vue par l'API serait celle du Worker du site, pas celle du visiteur. Le site transmet donc l'adresse d'origine dans
 * `x-relais-ip`, accompagnée du secret partagé `x-relais-secret`. L'API ne croit cette adresse QUE si le secret est exact ; sinon (appel direct, secret faux, secret non posé)
 * elle l'ignore ; elle l'ignore aussi si le secret attendu n'a pas la forme requise (32 caractères ASCII visibles au moins) ou si l'adresse n'a pas l'allure d'une IP. Dans tous les cas, les deux en-têtes de relais sont retirés de ce que voit le code du site (jamais journalisés, jamais rendus).
 */
export async function enteteRelaisDeConfiance(entetes: Headers, secretAttendu: string | undefined): Promise<Headers> {
  const copie = new Headers(entetes);
  const secretRecu = entetes.get("x-relais-secret");
  const adresse = entetes.get("x-relais-ip");
  copie.delete("x-relais-secret");
  copie.delete("x-relais-ip");
  if (secretAttendu && SECRET_RELAIS_VALIDE.test(secretAttendu) && secretRecu && adresseRelaisPlausible(adresse) && (await memeSecret(secretRecu, secretAttendu))) {
    copie.set("cf-connecting-ip", adresse);
  }
  return copie;
}
