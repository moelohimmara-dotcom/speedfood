import "server-only";
import { clientLivraison } from "./lecture";
import { pointValide, type Point } from "./frais";
import { VITESSE_DEMO_KMH, pasVers } from "./mouvement";
import { avancerLivraison } from "./service";

/**
 * Livreurs de démonstration : ils « roulent » vraiment vers le restaurant puis vers le client, et enchaînent les étapes d'une course.
 * Ce module est exécuté à chaque passage de la répartition (lecture d'un écran de livraison ou du suivi) : il n'y a pas de tâche
 * planifiée dans le Worker. Chaque pas calcule le temps écoulé depuis la dernière position enregistrée du livreur ; les changements
 * d'étape passent par le MÊME service que ceux d'un vrai livreur (machine à états, commande prête, code de remise).
 */

const ATTENTE_DEPART_SECONDES = 4;
const ATTENTE_RECUPERATION_SECONDES = 4;
const DUREE_SANS_POINT_SECONDES = 15;

interface LigneCourse {
  id: string;
  statut: string;
  mis_a_jour_le: string;
  livreur_id: string;
  depart_latitude: number | null;
  depart_longitude: number | null;
  arrivee_latitude: number | null;
  arrivee_longitude: number | null;
  orders: { statut: string } | { statut: string }[] | null;
  livreurs: { simule: boolean; latitude: number | null; longitude: number | null; position_le: string | null } | { simule: boolean; latitude: number | null; longitude: number | null; position_le: string | null }[] | null;
}

const un = <T>(r: T | T[] | null): T | null => (Array.isArray(r) ? (r[0] ?? null) : r);

function point(lat: number | null, lon: number | null): Point | null {
  if (lat === null || lon === null) return null;
  const p = { latitude: lat, longitude: lon };
  return pointValide(p) ? p : null;
}

export async function avancerSimulation(): Promise<void> {
  const db = clientLivraison();
  const { data } = await db
    .from("livraisons")
    .select("id, statut, mis_a_jour_le, livreur_id, depart_latitude, depart_longitude, arrivee_latitude, arrivee_longitude, orders(statut), livreurs!inner(simule, latitude, longitude, position_le)")
    .in("statut", ["assignee", "vers_restaurant", "recuperee", "vers_client"])
    .eq("mode", "speedfood")
    .eq("livreurs.simule", true)
    .limit(20);
  const maintenant = Date.now();

  for (const c of (data ?? []) as unknown as LigneCourse[]) {
    const livreur = un(c.livreurs);
    const commande = un(c.orders);
    if (!livreur?.simule || !commande) continue;
    const depuisEtape = (maintenant - new Date(c.mis_a_jour_le).getTime()) / 1000;
    const agir = (vers: "vers_restaurant" | "recuperee" | "vers_client" | "livree", code?: string) =>
      avancerLivraison({ livraisonId: c.id, acteur: "livreur", livreurId: c.livreur_id, vers, code });

    if (c.statut === "assignee") {
      if (depuisEtape >= ATTENTE_DEPART_SECONDES) await agir("vers_restaurant");
      continue;
    }
    if (c.statut === "recuperee") {
      if (depuisEtape >= ATTENTE_RECUPERATION_SECONDES) await agir("vers_client");
      continue;
    }

    // Déplacement vers la cible de l'étape (restaurant, puis client).
    const cible = c.statut === "vers_restaurant" ? point(c.depart_latitude, c.depart_longitude) : point(c.arrivee_latitude, c.arrivee_longitude);
    const ici = point(livreur.latitude, livreur.longitude);
    const derniere = livreur.position_le ? new Date(livreur.position_le).getTime() : maintenant;
    let arrive: boolean;
    if (cible && ici) {
      const pas = pasVers(ici, cible, VITESSE_DEMO_KMH, (maintenant - derniere) / 1000);
      arrive = pas.arrive;
      await db
        .from("livreurs")
        .update({ latitude: Math.round(pas.position.latitude * 1e5) / 1e5, longitude: Math.round(pas.position.longitude * 1e5) / 1e5, position_le: new Date(maintenant).toISOString() })
        .eq("id", c.livreur_id);
    } else {
      // Pas de point connu : le trajet dure un temps fixe.
      arrive = depuisEtape >= DUREE_SANS_POINT_SECONDES;
    }
    if (!arrive) continue;

    if (c.statut === "vers_restaurant") {
      // Arrivé : il attend que le restaurant déclare la commande prête, puis la récupère.
      if (commande.statut === "prete") await agir("recuperee");
    } else if (c.statut === "vers_client") {
      const { data: ligneCode } = await db.from("livraison_codes").select("code").eq("livraison_id", c.id).maybeSingle();
      if (ligneCode?.code) await agir("livree", ligneCode.code as string);
    }
  }
}
