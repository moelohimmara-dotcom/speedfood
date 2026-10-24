import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { chargerVueQuarts } from "@/lib/system-admin/quarts-service";
import { VueQuartsEcran } from "./VueQuarts";

export const metadata = { title: "Quarts et affectation (administration)" };
export const dynamic = "force-dynamic";

/**
 * Quarts et affectation (lot L2) : qui tient quel établissement.
 *
 * Trois files : « à moi » (les établissements dont je suis le titulaire), « non pris » (aucun
 * opérateur) et « tenus par un autre membre de l'équipe ». Au-dessus, l'alerte de relance : les
 * commandes qui attendent depuis plus longtemps que le délai de relance, sur un établissement que
 * personne ne tient.
 *
 * Les prises et les libérations se font SUR UNE COMMANDE : c'est la commande qui montre pourquoi
 * un établissement est repris. Un établissement sans commande en attente se prend depuis sa fiche.
 *
 * Ce qui reste hors de cet écran : le transfert d'une commande déjà en cours à un autre
 * opérateur (il déplace une commande en cours) et la suppression d'une trace d'affectation
 * (c'est l'historique). Les deux relèvent d'une décision de la responsable.
 *
 * Permission : `commande.support` (support et super administrateur), comme la page voisine
 * `/system/repartition` : c'est la même équipe qui tient les établissements de l'équipe.
 */
export default async function QuartsPage() {
  const contexte = await exigerPermissionPage("commande.support");
  const vue = await chargerVueQuarts(contexte);

  return <VueQuartsEcran vue={vue} moiId={contexte.utilisateurId} />;
}
