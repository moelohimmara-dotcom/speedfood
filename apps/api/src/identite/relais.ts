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

/** Longueur minimale du secret de relais attendu : en dessous, l'API ne fait jamais confiance au relais (même si l'appelant envoie le même secret). */
export const LONGUEUR_MIN_SECRET_RELAIS = 32;

/** L'adresse transmise a l'allure d'une adresse IP : 45 caractères au plus, `[0-9a-fA-F:.]` seulement (ni espace, ni retour à la ligne, ni texte libre). Ne prouve pas la validité. */
export function adresseRelaisPlausible(valeur: string | null | undefined): valeur is string {
  return typeof valeur === "string" && valeur.length > 0 && valeur.length <= 45 && /^[0-9a-fA-F:.]+$/.test(valeur);
}

/**
 * Le site relaie des requêtes vers l'API : l'adresse vue par l'API serait celle du Worker du site, pas celle du visiteur. Le site transmet donc l'adresse d'origine dans
 * `x-relais-ip`, accompagnée du secret partagé `x-relais-secret`. L'API ne croit cette adresse QUE si le secret est exact ; sinon (appel direct, secret faux, secret non posé)
 * elle l'ignore ; elle l'ignore aussi si le secret attendu fait moins de 32 caractères ou si l'adresse n'a pas l'allure d'une IP. Dans tous les cas, les deux en-têtes de relais sont retirés de ce que voit le code du site (jamais journalisés, jamais rendus).
 */
export async function enteteRelaisDeConfiance(entetes: Headers, secretAttendu: string | undefined): Promise<Headers> {
  const copie = new Headers(entetes);
  const secretRecu = entetes.get("x-relais-secret");
  const adresse = entetes.get("x-relais-ip");
  copie.delete("x-relais-secret");
  copie.delete("x-relais-ip");
  if (secretAttendu && secretAttendu.length >= LONGUEUR_MIN_SECRET_RELAIS && secretRecu && adresseRelaisPlausible(adresse) && (await memeSecret(secretRecu, secretAttendu))) {
    copie.set("cf-connecting-ip", adresse);
  }
  return copie;
}
