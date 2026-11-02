import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const SITE = 'https://speedfood-app.moelohimmara.workers.dev';
const API = 'https://speedfood-api.moelohimmara.workers.dev';
const AUTH = 'https://ggldjdizqrtpetdiohxy.supabase.co';
const RESTAURANT = '73bd8244-71ed-445c-862b-53b9b07ff207';
const PLAT = '51323984-4262-4116-82f9-06a01fc3f96f';
export const CIBLES_ESSAI = Object.freeze({
  restaurant: RESTAURANT, plat: PLAT,
  moi: `${SITE}/api/v1/moi`, liste: `${SITE}/api/v1/commandes`,
  menu: `${AUTH}/rest/v1/menu_items?select=id,restaurant_id,prix,prix_promo,disponible,archive_le&id=eq.${PLAT}&restaurant_id=eq.${RESTAURANT}&limit=1`,
  creationSite: `${SITE}/api/v1/commandes`, creationApi: `${API}/api/v1/commandes`,
});
const ROLES_EQUIPE = ['super_admin', 'operations', 'content_editor', 'support'];
const referenceValide = r => typeof r === 'string' && /^SF-[A-Z0-9]{5}$/.test(r);
const jetonValide = j => typeof j === 'string' && /^[A-Za-z0-9_-]{40}$/.test(j);
export function creerEtatEssai(fichier) {
  let reserve = false;
  return {
    reserver() {
      if (reserve) return false;
      try {
        writeFileSync(fichier, JSON.stringify({ phase: 'reserve', date: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
        reserve = true;
        return true;
      } catch (erreur) {
        if (erreur?.code === 'EEXIST') return false;
        throw new Error('Reservation impossible');
      }
    },
    noter(note) {
      if (!reserve || !note || Object.keys(note).some(k => !['phase', 'reference', 'referenceApi'].includes(k))) throw new Error('Etat refuse');
      if (!['envoi-site', 'site-auditer', 'site-cree', 'test-non-confirme', 'envoi-api', 'seconde-creation-auditer', 'rejeu-api-auditer', 'termine', 'envoi-api-seule', 'api-creee', 'api-a-auditer', 'termine-api-seule'].includes(note.phase)) throw new Error('Etat refuse');
      for (const nom of ['reference', 'referenceApi']) if (note[nom] !== undefined && note[nom] !== null && !referenceValide(note[nom])) throw new Error('Etat refuse');
      writeFileSync(fichier, JSON.stringify({ ...note, date: new Date().toISOString() }), { mode: 0o600 });
    },
  };
}
function commandeTest(liste, reference) {
  const trouvees = liste?.ok === true && Array.isArray(liste.commandes) ? liste.commandes.filter(c => c.reference === reference) : [];
  return trouvees.length === 1 && trouvees[0].restaurantId === RESTAURANT && trouvees[0].estTest === true;
}

/**
 * Outil operationnel, jamais branche au Worker et sans execution au chargement.
 * Deux POST au maximum, aucun retry. Les jetons et le corps ne quittent pas la memoire.
 * etat.reserver doit poser un verrou durable exclusif AVANT le premier POST.
 * etat.noter ne recoit que des phases et references publiques, aucun secret.
 */
export async function essayerIdempotence(config, envoyer = fetch, etat) {
  const refuse = { code: 2, message: 'Essai refuse ou interrompu. Aucune relance automatique ; details sensibles non affiches.' };
  if (config.autoriserEcriture !== true || typeof config.acces !== 'string' || !config.acces || !config.clePublique || typeof etat?.reserver !== 'function' || typeof etat?.noter !== 'function') return refuse;
  const entetes = { authorization: `Bearer ${config.acces}` };
  const statuts = [];
  const requete = (url, options) => envoyer(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const lire = async (url, headers = entetes) => {
    const rep = await requete(url, { method: 'GET', headers });
    if (!rep.ok) throw new Error();
    return rep.json();
  };
  const estEquipe = async () => {
    const moi = await lire(CIBLES_ESSAI.moi);
    return moi?.ok === true && ROLES_EQUIPE.includes(moi.roles?.equipe);
  };
  try {
    // Le marquage TEST reste decide par le serveur ; aucun est_test dans le payload.
    if (!(await estEquipe())) return refuse;
    if (!commandeTest(await lire(CIBLES_ESSAI.liste), 'SF-G8V6H')) return refuse;
    const plats = await lire(CIBLES_ESSAI.menu, { ...entetes, apikey: config.clePublique });
    const p = Array.isArray(plats) && plats.length === 1 ? plats[0] : null;
    if (!p || p.id !== PLAT || p.restaurant_id !== RESTAURANT || p.disponible !== true || p.archive_le !== null || !Number.isSafeInteger(p.prix) || p.prix < 0 || p.prix > 5000000) return refuse;
    if (p.prix_promo !== null && (!Number.isSafeInteger(p.prix_promo) || p.prix_promo < 0 || p.prix_promo > p.prix)) return refuse;
    const corps = JSON.stringify({
      cleIdempotence: randomUUID(), restaurantId: RESTAURANT,
      client: { nom: 'ESSAI IDEMPOTENCE - NE PAS PREPARER', telephone: '600000000', adresse: null },
      mode: 'retrait', lignes: [{ menuItemId: PLAT, quantite: 1, optionIds: [] }],
      sousTotalAffiche: p.prix_promo ?? p.prix, consentementReglement: true,
    });
    if (etat.reserver() !== true) return { code: 2, message: 'Un essai est deja reserve. Aucun POST commandes envoye. Audit requis avant une nouvelle execution.' };
    const poster = async (url, serveur) => {
      const debut = performance.now();
      const rep = await requete(url, { method: 'POST', headers: { ...entetes, 'content-type': 'application/json' }, body: corps });
      const donnees = await rep.json();
      statuts.push({ serveur, statut: rep.status, dureeMs: Math.round(performance.now() - debut) });
      return { statut: rep.status, donnees };
    };
    etat.noter({ phase: 'envoi-site' });
    const site = await poster(CIBLES_ESSAI.creationSite, 'site');
    if (site.statut !== 201 || site.donnees?.ok !== true || site.donnees.idempotent !== false || !referenceValide(site.donnees.reference) || !jetonValide(site.donnees.jeton)) {
      etat.noter({ phase: 'site-auditer' });
      return { code: 1, message: 'Reponse site inattendue. Aucun POST API envoye ; verifier le resultat avant toute autre ecriture.', statuts };
    }
    const reference = site.donnees.reference;
    etat.noter({ phase: 'site-cree', reference });
    if (!commandeTest(await lire(CIBLES_ESSAI.liste), reference)) {
      etat.noter({ phase: 'test-non-confirme', reference });
      return { code: 1, message: 'Marquage TEST non confirme. Aucun POST API envoye ; controle manuel requis.', reference, statuts };
    }
    if (!(await estEquipe())) return { code: 1, message: 'Role equipe non reconfirme. Aucun POST API envoye.', reference, statuts };
    etat.noter({ phase: 'envoi-api', reference });
    const api = await poster(CIBLES_ESSAI.creationApi, 'API');
    const memeJeton = jetonValide(api.donnees?.jeton) && api.donnees.jeton === site.donnees.jeton;
    if (api.statut === 201) {
      const referenceApi = referenceValide(api.donnees?.reference) ? api.donnees.reference : null;
      etat.noter({ phase: 'seconde-creation-auditer', reference, referenceApi });
      let apiEstTest = null;
      try { apiEstTest = referenceApi !== null && commandeTest(await lire(CIBLES_ESSAI.liste), referenceApi); } catch { /* Une panne de lecture ne doit pas masquer la seconde creation possible. */ }
      return { code: 1, message: 'ECHEC : API HTTP 201, seconde creation possible. Aucun nouvel envoi ni annulation automatique.', creationSupplementaire: true, reference, referenceApi, apiEstTest, memeJeton, statuts };
    }
    if (api.statut !== 200 || api.donnees?.ok !== true || api.donnees.idempotent !== true || api.donnees.reference !== reference || !memeJeton) {
      etat.noter({ phase: 'rejeu-api-auditer', reference });
      return { code: 1, message: 'ECHEC : rejeu idempotent non prouve. Aucune relance automatique.', reference, memeJeton, statuts };
    }
    if (!commandeTest(await lire(CIBLES_ESSAI.liste), reference)) return { code: 1, message: 'Controle final de la commande TEST impossible.', reference, memeJeton, statuts };
    etat.noter({ phase: 'termine', reference });
    return { code: 0, message: 'Idempotence croisee verifiee : meme reference, meme jeton, API HTTP 200 et idempotent true.', reference, estTest: true, memeJeton: true, idempotent: true, statuts };
  } catch {
    // Une panne peut survenir APRES l'insertion : jamais de nouvelle tentative automatique.
    return { ...refuse, statuts };
  }
}

/**
 * Second outil : UNE creation neuve envoyee a l'API SEULE (aucun POST vers le site),
 * pour constater l'alerte du restaurateur d'essai et mesurer la duree.
 * Un seul POST, jamais de retry. etat.reserver pose le verrou durable AVANT ce POST.
 * Ni jeton, ni corps, ni cle d'idempotence, ni acces ne sont renvoyes ou notes.
 */
export async function essayerCreationApiSeule(config, envoyer = fetch, etat) {
  const refuse = { code: 2, message: 'Essai refuse ou interrompu avant tout envoi. Aucune commande creee par cet outil ; details sensibles non affiches.' };
  if (config.autoriserEcriture !== true || typeof config.acces !== 'string' || !config.acces || !config.clePublique || typeof etat?.reserver !== 'function' || typeof etat?.noter !== 'function') return refuse;
  const entetes = { authorization: `Bearer ${config.acces}` };
  const statuts = [];
  const requete = (url, options) => envoyer(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const lire = async (url, headers = entetes) => {
    const rep = await requete(url, { method: 'GET', headers });
    if (!rep.ok) throw new Error();
    return rep.json();
  };
  const estEquipe = async () => {
    const moi = await lire(CIBLES_ESSAI.moi);
    return moi?.ok === true && ROLES_EQUIPE.includes(moi.roles?.equipe);
  };
  let envoiTente = false;
  try {
    // Le marquage TEST reste decide par le serveur ; aucun est_test dans le payload.
    if (!(await estEquipe())) return refuse;
    if (!commandeTest(await lire(CIBLES_ESSAI.liste), 'SF-G8V6H')) return refuse;
    const plats = await lire(CIBLES_ESSAI.menu, { ...entetes, apikey: config.clePublique });
    const p = Array.isArray(plats) && plats.length === 1 ? plats[0] : null;
    if (!p || p.id !== PLAT || p.restaurant_id !== RESTAURANT || p.disponible !== true || p.archive_le !== null || !Number.isSafeInteger(p.prix) || p.prix < 0 || p.prix > 5000000) return refuse;
    if (p.prix_promo !== null && (!Number.isSafeInteger(p.prix_promo) || p.prix_promo < 0 || p.prix_promo > p.prix)) return refuse;
    const corps = JSON.stringify({
      cleIdempotence: randomUUID(), restaurantId: RESTAURANT,
      client: { nom: 'ESSAI ALERTE API - NE PAS PREPARER', telephone: '600000000', adresse: null },
      mode: 'retrait', lignes: [{ menuItemId: PLAT, quantite: 1, optionIds: [] }],
      sousTotalAffiche: p.prix_promo ?? p.prix, consentementReglement: true,
    });
    if (etat.reserver() !== true) return { code: 2, message: 'Un essai est deja reserve. Aucun POST commandes envoye. Audit requis avant une nouvelle execution.' };
    etat.noter({ phase: 'envoi-api-seule' });
    envoiTente = true;
    const debut = performance.now();
    const rep = await requete(CIBLES_ESSAI.creationApi, { method: 'POST', headers: { ...entetes, 'content-type': 'application/json' }, body: corps });
    let donnees = null;
    try { donnees = await rep.json(); } catch { /* corps illisible : traite comme reponse inattendue */ }
    const dureeMs = Math.round(performance.now() - debut);
    statuts.push({ serveur: 'API', statut: rep.status, dureeMs });
    if (rep.status !== 201 || donnees?.ok !== true || donnees.idempotent !== false || !referenceValide(donnees.reference) || !jetonValide(donnees.jeton)) {
      const referenceInconnue = referenceValide(donnees?.reference) ? donnees.reference : undefined;
      etat.noter(referenceInconnue ? { phase: 'api-a-auditer', referenceApi: referenceInconnue } : { phase: 'api-a-auditer' });
      return { code: 1, message: 'ECHEC : reponse API inattendue, une commande a peut-etre ete creee. Aucune relance automatique ; auditer avant toute autre ecriture.', statuts };
    }
    const reference = donnees.reference;
    etat.noter({ phase: 'api-creee', referenceApi: reference });
    let confirmee = false;
    try { confirmee = commandeTest(await lire(CIBLES_ESSAI.liste), reference); } catch { /* lecture en panne : marquage non confirme */ }
    if (!confirmee) {
      etat.noter({ phase: 'api-a-auditer', referenceApi: reference });
      return { code: 1, message: 'Marquage TEST non confirme pour la commande creee par l API. Controle manuel requis, aucune relance.', referenceApi: reference, statuts };
    }
    etat.noter({ phase: 'termine-api-seule', referenceApi: reference });
    return { code: 0, message: `Creation neuve par l API seule verifiee (HTTP 201, idempotent false, commande TEST). Duree reseau ${dureeMs} ms. Constatez l alerte sur le telephone du restaurateur ; mesurez le CPU dans Cloudflare (speedfood-api, Metrics).`, referenceApi: reference, estTest: true, dureeMs, statuts };
  } catch {
    if (envoiTente) {
      // Panne ou delai apres l'envoi : l'ecriture a peut-etre abouti. Verrou conserve, jamais de retry.
      try { etat.noter({ phase: 'api-a-auditer' }); } catch { /* le verrou reste de toute facon */ }
      return { code: 2, message: 'Envoi interrompu (panne ou delai) : la commande a peut-etre ete creee. Aucune relance ; verrou conserve ; auditer avant toute nouvelle execution.', statuts };
    }
    return refuse;
  }
}
