import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creerClientAdmin } from "@/lib/db/admin";
import { appliquerTransitionStatut } from "@/lib/commande/transitions";
import { notifierUtilisateursFcm } from "@/lib/push/appareils";
import { clientLivraison, lireReglagesLivraison, pointDuRestaurant } from "./lecture";
import { ESSAIS_CODE_MAX, codeRemiseCorrect, genererCodeRemise } from "./code";
import { OPTIONS_PAR_DEFAUT, choisirLivreur, echeanceOffre, type CandidatLivreur } from "./dispatch";
import { acteurPeut, estFinal, estStatutLivraison, type ActeurLivraison, type ModeLivraison, type StatutLivraison } from "./statuts";

/**
 * Service de livraison (voir docs/LIVRAISON.md) : création d'une livraison quand une commande est acceptée, répartition des
 * courses par offres, réponse du livreur, avancement des statuts, code de remise. Tout passe par la clé de service : les tables
 * ne sont pas écrivables par l'API. L'appelant (action serveur) a déjà vérifié QUI agit ; ce module vérifie CE QUI est permis
 * (machine à états, commande prête, code de remise) et reste atomique par des mises à jour conditionnelles.
 */

export type ResultatService = { ok: true } | { ok: false; message: string };

const refuser = (message: string): ResultatService => ({ ok: false, message });
const maintenant = () => new Date();

interface LigneLivraison {
  id: string;
  order_id: string;
  restaurant_id: string;
  mode: string;
  statut: string;
  livreur_id: string | null;
  depart_latitude: number | null;
  depart_longitude: number | null;
  essais_code: number;
}

const COLONNES_LIVRAISON = "id, order_id, restaurant_id, mode, statut, livreur_id, depart_latitude, depart_longitude, essais_code";

async function lireLivraison(db: SupabaseClient, id: string): Promise<LigneLivraison | null> {
  const { data } = await db.from("livraisons").select(COLONNES_LIVRAISON).eq("id", id).maybeSingle();
  return (data as LigneLivraison | null) ?? null;
}

/** Crée la livraison d'une commande de livraison qui vient d'être acceptée. Sans effet pour un retrait ou si elle existe déjà. */
export async function creerLivraisonPourCommande(commandeId: string): Promise<{ livraisonId: string } | null> {
  const db = clientLivraison();
  const { data: o } = await db
    .from("orders")
    .select("id, mode, restaurant_id, frais_livraison_estime, livraison_latitude, livraison_longitude, livraison_distance_m")
    .eq("id", commandeId)
    .maybeSingle();
  if (!o || o.mode !== "livraison") return null;

  const depart = await pointDuRestaurant(db, o.restaurant_id);
  if (depart.mode === "aucune") return null; // le restaurant ne livre plus : rien à organiser
  const mode: ModeLivraison = depart.mode === "speedfood" ? "speedfood" : "propre";

  const { data: existante } = await db.from("livraisons").select("id").eq("order_id", commandeId).maybeSingle();
  if (existante) return { livraisonId: existante.id as string };

  const { data: creee, error } = await db
    .from("livraisons")
    .insert({
      order_id: commandeId,
      restaurant_id: o.restaurant_id,
      mode,
      statut: mode === "propre" ? "assignee" : "a_assigner",
      depart_latitude: depart.point?.latitude ?? null,
      depart_longitude: depart.point?.longitude ?? null,
      arrivee_latitude: o.livraison_latitude,
      arrivee_longitude: o.livraison_longitude,
      distance_m: o.livraison_distance_m,
      frais_gnf: o.frais_livraison_estime ?? 0,
    })
    .select("id")
    .single();
  if (error || !creee) return null;

  await db.from("livraison_codes").insert({ livraison_id: creee.id, code: genererCodeRemise() });
  if (mode === "speedfood") await repartir(creee.id as string);
  return { livraisonId: creee.id as string };
}

/** Propose la course au meilleur livreur disponible. Renvoie `true` si une offre est partie. */
export async function repartir(livraisonId: string): Promise<boolean> {
  const db = clientLivraison();
  const l = await lireLivraison(db, livraisonId);
  if (!l || l.statut !== "a_assigner" || l.mode !== "speedfood") return false;
  if (l.depart_latitude === null || l.depart_longitude === null) return false;

  const [reglages, { data: dejaSollicites }, { data: livreurs }] = await Promise.all([
    lireReglagesLivraison(db),
    db.from("livraison_offres").select("livreur_id").eq("livraison_id", livraisonId),
    // Les livreurs d'un restaurant ne reçoivent pas d'offre du groupe Speedfood (restaurant_id nul = groupe).
    db.from("livreurs").select("id, statut, latitude, longitude, position_le, derniere_course_le").eq("statut", "disponible").eq("cycle", "actif").is("restaurant_id", null),
  ]);
  const candidats: CandidatLivreur[] = ((livreurs ?? []) as Array<{
    id: string;
    statut: CandidatLivreur["statut"];
    latitude: number | null;
    longitude: number | null;
    position_le: string | null;
    derniere_course_le: string | null;
  }>).map((r) => ({ id: r.id, statut: r.statut, latitude: r.latitude, longitude: r.longitude, positionLe: r.position_le, derniereCourseLe: r.derniere_course_le }));
  const choix = choisirLivreur(candidats, { latitude: l.depart_latitude, longitude: l.depart_longitude }, {
    exclus: new Set(((dejaSollicites ?? []) as Array<{ livreur_id: string }>).map((o) => o.livreur_id)),
    rayonKm: OPTIONS_PAR_DEFAUT.rayonKm,
    positionMaxMinutes: OPTIONS_PAR_DEFAUT.positionMaxMinutes,
    maintenant: maintenant(),
  });
  if (!choix) return false;

  // D'abord la livraison (conditionnelle : une seule offre à la fois), puis l'offre ; échec = on remet à « à assigner ».
  const { data: prise } = await db
    .from("livraisons")
    .update({ statut: "offre_envoyee", mis_a_jour_le: maintenant().toISOString() })
    .eq("id", livraisonId)
    .eq("statut", "a_assigner")
    .select("id");
  if (!prise || prise.length === 0) return false;
  const { error } = await db
    .from("livraison_offres")
    .insert({ livraison_id: livraisonId, livreur_id: choix.livreurId, expire_le: echeanceOffre(maintenant(), reglages.delaiOffreSecondes) });
  if (error) {
    await db.from("livraisons").update({ statut: "a_assigner" }).eq("id", livraisonId).eq("statut", "offre_envoyee");
    return false;
  }
  // Alerte du livreur (application native) : meilleur effort, sans jamais retarder ni faire échouer la répartition.
  const { data: fiche } = await db.from("livreurs").select("utilisateur_id").eq("id", choix.livreurId).maybeSingle();
  const utilisateurId = (fiche as { utilisateur_id: string | null } | null)?.utilisateur_id;
  if (utilisateurId) await notifierUtilisateursFcm([utilisateurId], "course_offre").catch(() => undefined);
  return true;
}

/** Réponse d'un livreur à une offre. Atomique : une offre périmée ou déjà traitée est refusée. */
export async function repondreOffre(offreId: string, livreurId: string, reponse: "acceptee" | "refusee"): Promise<ResultatService> {
  const db = clientLivraison();
  const maintenantIso = maintenant().toISOString();
  const { data: offre } = await db
    .from("livraison_offres")
    .update({ statut: reponse, repondu_le: maintenantIso })
    .eq("id", offreId)
    .eq("livreur_id", livreurId)
    .eq("statut", "en_attente")
    .gt("expire_le", maintenantIso)
    .select("id, livraison_id")
    .maybeSingle();
  if (!offre) return refuser("Cette offre n'est plus disponible.");

  if (reponse === "refusee") {
    await db.from("livraisons").update({ statut: "a_assigner", mis_a_jour_le: maintenantIso }).eq("id", offre.livraison_id).eq("statut", "offre_envoyee");
    await repartir(offre.livraison_id as string);
    return { ok: true };
  }

  const { data: prise } = await db
    .from("livraisons")
    .update({ statut: "assignee", livreur_id: livreurId, assignee_le: maintenantIso, mis_a_jour_le: maintenantIso })
    .eq("id", offre.livraison_id)
    .eq("statut", "offre_envoyee")
    .select("id");
  if (!prise || prise.length === 0) {
    await db.from("livraison_offres").update({ statut: "expiree" }).eq("id", offreId);
    return refuser("Cette course n'est plus disponible.");
  }
  await db.from("livreurs").update({ statut: "en_course" }).eq("id", livreurId);
  return { ok: true };
}

/**
 * Passe en revue les offres : expire celles dont l'échéance est passée (la course repart au livreur suivant), fait accepter
 * les offres des livreurs SIMULÉS après un court délai, garde leur position « fraîche » et relance les livraisons restées sans
 * livreur. Appelée à chaque lecture des écrans de livraison (pas de tâche planifiée dans le Worker).
 */
export async function traiterOffres(delaiSimulationSecondes = 3): Promise<void> {
  const db = clientLivraison();
  const maintenantIso = maintenant().toISOString();

  const { data: expirees } = await db
    .from("livraison_offres")
    .update({ statut: "expiree", repondu_le: maintenantIso })
    .eq("statut", "en_attente")
    .lte("expire_le", maintenantIso)
    .select("id, livraison_id");
  for (const o of (expirees ?? []) as Array<{ livraison_id: string }>) {
    await db.from("livraisons").update({ statut: "a_assigner", mis_a_jour_le: maintenantIso }).eq("id", o.livraison_id).eq("statut", "offre_envoyee");
    await repartir(o.livraison_id);
  }

  const { data: attente } = await db
    .from("livraison_offres")
    .select("id, livreur_id, cree_le, livreurs!inner(simule)")
    .eq("statut", "en_attente");
  const limite = Date.now() - delaiSimulationSecondes * 1000;
  for (const o of (attente ?? []) as unknown as Array<{ id: string; livreur_id: string; cree_le: string; livreurs: { simule: boolean } | { simule: boolean }[] }>) {
    const simule = Array.isArray(o.livreurs) ? o.livreurs[0]?.simule : o.livreurs?.simule;
    if (simule && new Date(o.cree_le).getTime() <= limite) await repondreOffre(o.id, o.livreur_id, "acceptee");
  }

  // Un livreur simulé « en ligne » reste joignable : sa position est rafraîchie (sinon elle vieillirait au-delà de 10 minutes).
  await db.from("livreurs").update({ position_le: maintenantIso }).eq("simule", true).eq("statut", "disponible");

  const { data: sansLivreur } = await db.from("livraisons").select("id").eq("statut", "a_assigner").eq("mode", "speedfood").limit(20);
  for (const l of (sansLivreur ?? []) as Array<{ id: string }>) await repartir(l.id);

  // Les livreurs de démonstration roulent et enchaînent leurs étapes (import dynamique : la simulation utilise ce service).
  const { avancerSimulation } = await import("./simulation");
  await avancerSimulation();
}

export interface DemandeAvancement {
  livraisonId: string;
  acteur: ActeurLivraison;
  vers: StatutLivraison;
  /** Livreur qui agit (acteur « livreur ») : doit être celui de la course. */
  livreurId?: string;
  /** Code de remise saisi (obligatoire pour « livrée », sauf reprise en main par l'exploitation). */
  code?: string;
  raison?: string;
}

async function libererLivreur(db: SupabaseClient, livreurId: string | null, courseTerminee: boolean): Promise<void> {
  if (!livreurId) return;
  // Un livreur de restaurant ne reçoit pas d'offre : à la fin de sa course il retombe hors ligne (sa position cesse d'être envoyée).
  const { data: fiche } = await db.from("livreurs").select("restaurant_id").eq("id", livreurId).maybeSingle();
  const statut = fiche?.restaurant_id ? "hors_ligne" : "disponible";
  await db
    .from("livreurs")
    .update(courseTerminee ? { statut, derniere_course_le: maintenant().toISOString() } : { statut })
    .eq("id", livreurId)
    .eq("statut", "en_course");
}

/** Fait avancer une livraison d'un statut à un autre, avec toutes les vérifications. */
export async function avancerLivraison(d: DemandeAvancement): Promise<ResultatService> {
  const db = clientLivraison();
  const l = await lireLivraison(db, d.livraisonId);
  if (!l || !estStatutLivraison(l.statut) || (l.mode !== "propre" && l.mode !== "speedfood")) return refuser("Livraison introuvable.");
  const mode = l.mode as ModeLivraison;
  const de = l.statut as StatutLivraison;
  if (estFinal(de)) return refuser("Cette livraison est terminée.");
  if (d.acteur === "livreur" && (!d.livreurId || l.livreur_id !== d.livreurId)) return refuser("Cette course ne vous est pas attribuée.");
  if (!acteurPeut(d.acteur, de, d.vers, mode)) return refuser("Ce changement d'étape n'est pas possible maintenant.");

  const { data: commande } = await db.from("orders").select("id, statut").eq("id", l.order_id).maybeSingle();
  if (!commande) return refuser("Commande introuvable.");

  if (d.vers === "recuperee" && d.acteur !== "admin" && commande.statut !== "prete") {
    return refuser("La commande n'est pas encore prête : attendez que le restaurant la déclare prête.");
  }
  if (d.vers === "vers_client" && mode === "propre" && !["acceptee", "prete"].includes(commande.statut as string)) {
    return refuser("La commande doit être acceptée avant de partir livrer.");
  }
  // Un livreur du restaurant ne part qu'avec la commande en main : le restaurant l'a déclarée prête.
  if (d.vers === "vers_client" && mode === "propre" && d.acteur === "livreur" && commande.statut !== "prete") {
    return refuser("La commande n'est pas encore prête : attendez que le restaurant la déclare prête.");
  }

  if (d.vers === "livree" && d.acteur !== "admin") {
    if (l.essais_code >= ESSAIS_CODE_MAX) return refuser("Trop d'essais de code. Contactez l'assistance.");
    const { data: ligneCode } = await db.from("livraison_codes").select("code").eq("livraison_id", l.id).maybeSingle();
    if (!ligneCode || !codeRemiseCorrect(ligneCode.code as string, d.code ?? "")) {
      await db.from("livraisons").update({ essais_code: l.essais_code + 1 }).eq("id", l.id);
      return refuser(`Code incorrect. Demandez au client le code à 4 chiffres affiché sur son suivi (${ESSAIS_CODE_MAX - l.essais_code - 1} essai(s) restant(s)).`);
    }
  }

  const horodatage = maintenant().toISOString();
  const patch: Record<string, unknown> = { statut: d.vers, mis_a_jour_le: horodatage };
  if (d.vers === "recuperee") patch.recuperee_le = horodatage;
  if (d.vers === "livree") patch.livree_le = horodatage;
  if (d.vers === "a_assigner") patch.livreur_id = null;
  if ((d.vers === "echec" || d.vers === "annulee") && d.raison) patch.raison = d.raison.slice(0, 300);

  const { data: changee } = await db.from("livraisons").update(patch).eq("id", l.id).eq("statut", de).select("id");
  if (!changee || changee.length === 0) return refuser("La livraison a changé d'état entre-temps. Rechargez la page.");

  // Livraison par le personnel du restaurant avec un livreur du registre : « en course » dès le départ (sa position est alors partagée au client).
  if (d.vers === "vers_client" && mode === "propre" && l.livreur_id) await db.from("livreurs").update({ statut: "en_course" }).eq("id", l.livreur_id).neq("statut", "en_course");

  if (d.vers === "livree") {
    await libererLivreur(db, l.livreur_id, true);
    // La commande se clôt avec la remise : prête → terminée.
    if (commande.statut === "prete") {
      try {
        await appliquerTransitionStatut(creerClientAdmin(), { id: l.order_id, statut: "prete" }, "terminee", "systeme:livraison");
      } catch {
        console.error("livraison_cloture_commande_echec");
      }
    }
  } else if (d.vers === "echec" || d.vers === "annulee") {
    await libererLivreur(db, l.livreur_id, false);
    await db.from("livraison_offres").update({ statut: "expiree", repondu_le: horodatage }).eq("livraison_id", l.id).eq("statut", "en_attente");
  } else if (d.vers === "a_assigner") {
    await libererLivreur(db, l.livreur_id, false);
    await db.from("livraison_offres").update({ statut: "expiree", repondu_le: horodatage }).eq("livraison_id", l.id).eq("statut", "en_attente");
    if (mode === "speedfood") await repartir(l.id);
  }
  return { ok: true };
}

/** Reprise en main par l'exploitation : affecte la course à un livreur précis (annule une offre en cours). */
export async function assignerManuellement(livraisonId: string, livreurId: string): Promise<ResultatService> {
  const db = clientLivraison();
  const l = await lireLivraison(db, livraisonId);
  if (!l || l.mode !== "speedfood") return refuser("Livraison introuvable ou gérée par le restaurant.");
  if (l.statut !== "a_assigner" && l.statut !== "offre_envoyee") return refuser("Cette livraison a déjà un livreur ou est terminée.");
  const { data: livreur } = await db.from("livreurs").select("id, statut").eq("id", livreurId).maybeSingle();
  if (!livreur || livreur.statut !== "disponible") return refuser("Ce livreur n'est pas disponible.");

  const horodatage = maintenant().toISOString();
  const { data: prise } = await db
    .from("livraisons")
    .update({ statut: "assignee", livreur_id: livreurId, assignee_le: horodatage, mis_a_jour_le: horodatage })
    .eq("id", livraisonId)
    .eq("statut", l.statut)
    .select("id");
  if (!prise || prise.length === 0) return refuser("La livraison a changé d'état entre-temps.");
  await db.from("livraison_offres").update({ statut: "expiree", repondu_le: horodatage }).eq("livraison_id", livraisonId).eq("statut", "en_attente");
  await db.from("livreurs").update({ statut: "en_course" }).eq("id", livreurId);
  return { ok: true };
}

/** Une commande refusée ou annulée annule sa livraison (et libère le livreur). */
export async function annulerLivraisonDeCommande(commandeId: string): Promise<void> {
  const db = clientLivraison();
  const { data: l } = await db.from("livraisons").select(COLONNES_LIVRAISON).eq("order_id", commandeId).maybeSingle();
  if (!l) return;
  const ligne = l as LigneLivraison;
  if (!estStatutLivraison(ligne.statut) || estFinal(ligne.statut)) return;
  const horodatage = maintenant().toISOString();
  await db.from("livraisons").update({ statut: "annulee", raison: "Commande annulée", mis_a_jour_le: horodatage }).eq("id", ligne.id).eq("statut", ligne.statut);
  await libererLivreur(db, ligne.livreur_id, false);
  await db.from("livraison_offres").update({ statut: "expiree", repondu_le: horodatage }).eq("livraison_id", ligne.id).eq("statut", "en_attente");
}
