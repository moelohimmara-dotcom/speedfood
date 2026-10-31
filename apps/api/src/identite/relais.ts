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

/**
 * Le site relaie des requêtes vers l'API : l'adresse vue par l'API serait celle du Worker du site, pas celle du visiteur. Le site transmet donc l'adresse d'origine dans
 * `x-relais-ip`, accompagnée du secret partagé `x-relais-secret`. L'API ne croit cette adresse QUE si le secret est exact ; sinon (appel direct, secret faux, secret non posé)
 * elle l'ignore. Dans tous les cas, les deux en-têtes de relais sont retirés de ce que voit le code du site (jamais journalisés, jamais rendus).
 */
export async function enteteRelaisDeConfiance(entetes: Headers, secretAttendu: string | undefined): Promise<Headers> {
  const copie = new Headers(entetes);
  const secretRecu = entetes.get("x-relais-secret");
  const adresse = entetes.get("x-relais-ip");
  copie.delete("x-relais-secret");
  copie.delete("x-relais-ip");
  if (secretAttendu && secretRecu && adresse && (await memeSecret(secretRecu, secretAttendu))) {
    copie.set("cf-connecting-ip", adresse);
  }
  return copie;
}
