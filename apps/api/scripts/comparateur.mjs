// Compare ce que répondent deux adresses (par exemple l'ancienne route du site et la nouvelle de l'API) : statut, type de contenu, cache et corps JSON.
// Le corps est comparé indépendamment de l'ordre des clés.

async function lire(base, chemin, envoyer) {
  const reponse = await envoyer(base.replace(/\/+$/, "") + chemin, { redirect: "manual" });
  const texte = await reponse.text();
  let corps;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = texte;
  }
  return {
    statut: reponse.status,
    typeContenu: (reponse.headers.get("content-type") ?? "").split(";")[0].trim(),
    cache: reponse.headers.get("cache-control") ?? "",
    corps,
  };
}

function trier(valeur) {
  if (Array.isArray(valeur)) return valeur.map(trier);
  if (valeur && typeof valeur === "object") return Object.fromEntries(Object.keys(valeur).sort().map((cle) => [cle, trier(valeur[cle])]));
  return valeur;
}

/** Liste des écarts entre les deux adresses, pour chaque chemin. Vide si tout est identique. */
// Par défaut, une réponse hors 2xx (d'un côté ou des deux) est un écart : deux erreurs identiques ne doivent pas passer pour « 0 écart ».
// `options.tolererNon2xx` permet de comparer volontairement des erreurs.
export async function comparerRoutes(base1, base2, chemins, envoyer = fetch, options = {}) {
  const ecarts = [];
  for (const chemin of chemins) {
    const [a, b] = await Promise.all([lire(base1, chemin, envoyer), lire(base2, chemin, envoyer)]);
    if (!options.tolererNon2xx) {
      if (a.statut < 200 || a.statut > 299) ecarts.push(`${chemin} : statut ${a.statut} hors 2xx (référence)`);
      if (b.statut < 200 || b.statut > 299) ecarts.push(`${chemin} : statut ${b.statut} hors 2xx (candidate)`);
    }
    const champs = [["statut", "statut"], ["typeContenu", "type de contenu"], ["cache", "cache"]];
    for (const [champ, nom] of champs) {
      if (a[champ] !== b[champ]) ecarts.push(`${chemin} : ${nom} ${JSON.stringify(a[champ])} ≠ ${JSON.stringify(b[champ])}`);
    }
    if (JSON.stringify(trier(a.corps)) !== JSON.stringify(trier(b.corps))) ecarts.push(`${chemin} : corps différent`);
  }
  return ecarts;
}
