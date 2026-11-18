import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { type SQLiteBindParams } from 'expo-sqlite';
import { ouvrirBaseEnSerie } from './ouverture-serie';
import { creerDepotPanier } from './panier-reel-depot';
import { initialiserPanierReel } from './migrations/0001-panier-reel';
import {
  COMMANDES_APPAREIL_MAX, cleCoffreSuivi, decoderMetadonnees, encoderMetadonnees, fusionnerCommandes, jetonSuiviValide, type CommandeAppareil, type MemoireAppareil,
} from '../connexion/commandes-appareil';

/**
 * Commandes de cet appareil (écart G12) : les métadonnées (référence, restaurant, date, total, mode) dans une base à part (`speedfood-client-appareil.db`, même forme qu'un panier),
 * les jetons de suivi UN PAR UN dans le coffre du téléphone (jamais dans la base). Écritures strictement l'une après l'autre. Une lecture ne rend que les commandes dont le jeton est
 * encore dans le coffre et de forme valable ; une écriture qui échoue ne gêne jamais l'envoi d'une commande (l'appelant l'ignore). En aperçu web : en mémoire seulement.
 */
let ouverture: Promise<MemoireAppareil> | null = null;

function enMemoire(): MemoireAppareil {
  let liste: CommandeAppareil[] = [];
  return {
    lire: async () => [...liste],
    enregistrer: async nouvelles => { liste = fusionnerCommandes(liste, nouvelles); },
    oublier: async () => { liste = []; },
  };
}

async function ouvrir(): Promise<MemoireAppareil> {
  if (Platform.OS === 'web') return enMemoire();
  const db = await ouvrirBaseEnSerie('speedfood-client-appareil.db');
  try {
    await initialiserPanierReel(db);
    const depot = creerDepotPanier(async (sql, params, lecture) => {
      const requete = await db.prepareAsync(sql);
      try {
        if (lecture) return await (await requete.executeForRawResultAsync(params as SQLiteBindParams)).getAllAsync();
        await requete.executeAsync(params as SQLiteBindParams); return [];
      } finally { await requete.finalizeAsync(); }
    });
    let file: Promise<unknown> = Promise.resolve();
    const enfiler = <T,>(tache: () => Promise<T>): Promise<T> => { const suite = file.then(tache, tache); file = suite.catch(() => undefined); return suite; };

    async function lireTout(): Promise<CommandeAppareil[]> {
      const sortie: CommandeAppareil[] = [];
      for (const m of decoderMetadonnees(await depot.lire())) {
        let jeton: string | null = null;
        try { jeton = await SecureStore.getItemAsync(cleCoffreSuivi(m.reference)); } catch { jeton = null; }
        if (jetonSuiviValide(jeton)) sortie.push({ ...m, jeton });
      }
      return sortie;
    }
    return {
      lire: () => enfiler(lireTout),
      enregistrer: nouvelles => enfiler(async () => {
        const avant = await lireTout();
        const apres = fusionnerCommandes(avant, nouvelles);
        const connus = new Map(avant.map(c => [c.reference, c.jeton]));
        // Jetons d'abord (une valeur inchangée n'est pas réécrite), métadonnées ensuite : jamais une ligne sans son jeton.
        for (const c of apres) if (connus.get(c.reference) !== c.jeton) await SecureStore.setItemAsync(cleCoffreSuivi(c.reference), c.jeton);
        await depot.ecrire(encoderMetadonnees(apres));
        const gardees = new Set(apres.map(c => c.reference));
        for (const c of avant) if (!gardees.has(c.reference)) { try { await SecureStore.deleteItemAsync(cleCoffreSuivi(c.reference)); } catch { /* meilleur effort */ } }
      }),
      oublier: () => enfiler(async () => {
        // Les jetons effacés sont ceux des références lisibles dans les métadonnées ; une ligne devenue illisible n'a plus de référence connue et son jeton, s'il existe, reste dans le coffre (limite connue).
        const references = decoderMetadonnees(await depot.lire()).map(m => m.reference);
        await depot.ecrire(encoderMetadonnees([]));
        for (const r of references.slice(0, COMMANDES_APPAREIL_MAX)) { try { await SecureStore.deleteItemAsync(cleCoffreSuivi(r)); } catch { /* meilleur effort */ } }
      }),
    };
  } catch (e) { await db.closeAsync().catch(() => undefined); throw e; }
}

function ouvrirMemoire(): Promise<MemoireAppareil> { ouverture ??= ouvrir().catch(e => { ouverture = null; throw e; }); return ouverture; }

/** Ouverture paresseuse : rien n'est ouvert avant la première lecture ou écriture. */
export const memoireCommandesAppareil: MemoireAppareil = {
  lire: async () => (await ouvrirMemoire()).lire(),
  enregistrer: async nouvelles => (await ouvrirMemoire()).enregistrer(nouvelles),
  oublier: async () => (await ouvrirMemoire()).oublier(),
};
