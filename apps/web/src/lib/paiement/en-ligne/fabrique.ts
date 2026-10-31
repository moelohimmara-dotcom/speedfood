import "server-only";
import { creerPasserelleChapChap } from "./chapchap";
import { creerDepotSupabase } from "./depot-supabase";
import { ErreurPasserelle, type NomFournisseur, type PasserelleDePaiement } from "./fournisseur";
import { creerServicePaiement, type ServicePaiement } from "./service";
import { creerPasserelleSimulation } from "./simulation";

/**
 * Assemblage du service de paiement en ligne avec la vraie base et la passerelle choisie dans les réglages. Les clés viennent de
 * l'ENVIRONNEMENT (secrets du Worker), jamais du dépôt : celui-ci est public.
 *
 *  - `PAIEMENT_SIMULATION_CLE` : clé de signature des notifications SIMULÉES. Sans elle, la simulation refuse de démarrer : une clé par
 *    défaut, lisible dans le dépôt public, permettrait à n'importe qui de fabriquer une notification de paiement.
 *  - `CHAPCHAP_CLE_API`, `CHAPCHAP_CLE_SIGNATURE` : clés du prestataire (test d'abord). Tant que l'adaptateur n'est pas implémenté
 *    (lot P5), il refuse de fonctionner.
 */
export function creerPasserelle(nom: NomFournisseur): PasserelleDePaiement {
  if (nom === "chapchap") {
    return creerPasserelleChapChap({
      cleApi: process.env.CHAPCHAP_CLE_API ?? null,
      cleSignature: process.env.CHAPCHAP_CLE_SIGNATURE ?? null,
      // Le service « API Push » (versement direct) n'est pas activé sur le compte : versement manuel. À passer à vrai quand il le sera.
      pushActif: process.env.CHAPCHAP_PUSH_ACTIF === "1",
    });
  }
  const cle = process.env.PAIEMENT_SIMULATION_CLE;
  if (!cle || cle.length < 16) throw new ErreurPasserelle("non_configuree", "PAIEMENT_SIMULATION_CLE (16 caractères au moins) doit être définie pour la simulation.");
  return creerPasserelleSimulation({ cle });
}

/** Service configuré selon le fournisseur ACTIF des réglages (ou celui qu'impose l'appelant, pour une notification entrante). */
export async function obtenirServicePaiement(fournisseur?: NomFournisseur): Promise<ServicePaiement> {
  const depot = creerDepotSupabase();
  const nom = fournisseur ?? (await depot.lireReglages()).fournisseur;
  return creerServicePaiement({ depot, passerelle: creerPasserelle(nom), urls: adressesPubliques(nom) });
}

/**
 * Adresses publiques communiquées au prestataire : webhook (HTTPS obligatoire chez Chap Chap Pay), retour et annulation du client. L'origine
 * est `PAIEMENT_URL_PUBLIQUE` (sans barre finale), à défaut l'adresse de production actuelle.
 */
export function adressesPubliques(fournisseur: NomFournisseur): { notification: string; retour: string; annulation: string } {
  const origine = (process.env.PAIEMENT_URL_PUBLIQUE ?? "https://speedfood-app.moelohimmara.workers.dev").replace(/\/+$/, "");
  return { notification: `${origine}/api/paiement/notification/${fournisseur}`, retour: `${origine}/suivi`, annulation: `${origine}/suivi` };
}

/**
 * Service pour une commande donnée, ou `null` si elle n'a pas de paiement en ligne (le cas général : une seule lecture légère, sans
 * lire les réglages ni exiger de clé). Le fournisseur est celui DU PAIEMENT, pas celui des réglages du jour.
 */
export async function obtenirServicePourCommande(orderId: string): Promise<ServicePaiement | null> {
  const depot = creerDepotSupabase();
  const paiement = await depot.paiementParCommande(orderId);
  if (!paiement) return null;
  return creerServicePaiement({ depot, passerelle: creerPasserelle(paiement.fournisseur), urls: adressesPubliques(paiement.fournisseur) });
}
