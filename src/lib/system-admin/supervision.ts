import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { lireCompteServiceFcm } from "@/lib/push/fcm";
import { compterAppareils } from "@/lib/push/annonce-version";
import {
  alertesDepuis,
  classerLatence,
  etatGlobal,
  libelleLatence,
  type AlerteSupervision,
  type EtatService,
  type MesuresOperationnelles,
  type ServiceSupervise,
} from "./supervision-regles";

/** Au-delà de ce délai sans réponse du restaurant, une commande est signalée (même ordre de grandeur que la proposition d'alternative). */
const DELAI_COMMANDE_MINUTES = 10;
const DELAI_APPEL_MS = 8000;

export interface RapportSupervision {
  mesureLe: string;
  global: EtatService;
  services: ServiceSupervise[];
  alertes: AlerteSupervision[];
  mesures: MesuresOperationnelles;
}

/** Chronomètre un appel : renvoie la durée en ms, ou `null` s'il a échoué ou dépassé le délai. Jamais d'exception. */
async function chronometrer(appel: () => Promise<boolean>): Promise<number | null> {
  const debut = Date.now();
  try {
    const ok = await Promise.race([appel(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DELAI_APPEL_MS))]);
    return ok ? Date.now() - debut : null;
  } catch {
    return null;
  }
}

function sansTypes(): SupabaseClient {
  return creerClientAdmin() as unknown as SupabaseClient;
}

async function compter(requete: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await requete;
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

/**
 * Prend le pouls des services et des files de travail, avec le client d'administration (réservé aux équipes autorisées : l'appelant a déjà exigé
 * la permission). Lecture seule : aucune écriture, aucun secret ni donnée personnelle dans le rapport (des états, des durées, des compteurs).
 */
export async function lireSupervision(): Promise<RapportSupervision> {
  const db = sansTypes();
  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const cleAnonyme = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const limite = new Date(Date.now() - DELAI_COMMANDE_MINUTES * 60_000).toISOString();
  // Au-delà de 24 h, une commande jamais traitée est abandonnée : elle ne se rattrape plus, elle se nettoie. Elle ne doit pas figer une alerte « urgente » éternelle.
  const abandon = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [msBase, msAuth, sansReponse, echoues, litiges, appareils, reglages] = await Promise.all([
    chronometrer(async () => !(await db.from("parametres_application").select("id").limit(1).maybeSingle()).error),
    chronometrer(async () => {
      if (!urlSupabase) return false;
      const r = await fetch(`${urlSupabase}/auth/v1/health`, { headers: { apikey: cleAnonyme }, cache: "no-store" });
      return r.ok;
    }),
    compter(db.from("orders").select("id", { count: "exact", head: true }).eq("statut", "en_attente").eq("est_test", false).lt("cree_le", limite).gte("cree_le", abandon)),
    compter(db.from("paiement_versements").select("id", { count: "exact", head: true }).eq("etat", "echoue")),
    compter(db.from("litiges_paiement").select("id", { count: "exact", head: true }).eq("etat", "a_humain")),
    compterAppareils().catch(() => null),
    db.from("parametres_paiement").select("paiement_en_ligne_actif, fournisseur, valeurs_validees_le").maybeSingle(),
  ]);

  const fcmConfigure = lireCompteServiceFcm(process.env.FCM_SERVICE_ACCOUNT) !== null;
  const r = (reglages.data ?? {}) as { paiement_en_ligne_actif?: boolean; fournisseur?: string; valeurs_validees_le?: string | null };
  const paiementActif = r.paiement_en_ligne_actif === true;
  const paiementValide = typeof r.valeurs_validees_le === "string";

  const services: ServiceSupervise[] = [
    { cle: "base", libelle: "Base de données (Supabase)", etat: classerLatence(msBase), detail: `La base ${libelleLatence(msBase)}.`, ...(msBase !== null ? { mesureMs: msBase } : {}) },
    { cle: "auth", libelle: "Authentification (Supabase)", etat: classerLatence(msAuth), detail: `Le service de connexion ${libelleLatence(msAuth)}.`, ...(msAuth !== null ? { mesureMs: msAuth } : {}) },
    {
      cle: "push",
      libelle: "Notifications poussées (Firebase)",
      etat: fcmConfigure ? "ok" : "degrade",
      detail: fcmConfigure
        ? `Le compte de service est configuré${appareils === null ? "." : ` ; ${appareils} téléphone(s) enregistré(s).`}`
        : "Le compte de service Firebase n'est pas configuré : aucune notification n'est envoyée.",
    },
    {
      cle: "paiement",
      libelle: "Paiement en ligne",
      etat: !paiementActif ? "inconnu" : paiementValide ? "ok" : "degrade",
      detail: !paiementActif
        ? "Désactivé : les commandes se règlent directement auprès du restaurant."
        : paiementValide
          ? `Actif avec le fournisseur « ${r.fournisseur ?? "simulation"} », barème validé.`
          : "Actif, mais le barème n'est pas validé.",
    },
    { cle: "site", libelle: "Site et API (Cloudflare)", etat: "ok", detail: "Cette page est servie par le site : il répond." },
  ];

  const mesures: MesuresOperationnelles = {
    commandesSansReponse: sansReponse ?? 0,
    delaiCommandeMinutes: DELAI_COMMANDE_MINUTES,
    versementsEchoues: echoues ?? 0,
    litigesAHumain: litiges ?? 0,
    fcmConfigure,
    appareilsPush: appareils ?? 0,
    paiementActif,
    paiementValide,
  };

  return { mesureLe: new Date().toISOString(), global: etatGlobal(services), services, alertes: alertesDepuis(mesures), mesures };
}
