import { repondre, repondreErreur } from "@/lib/api/v1";
import { compteursPaiements } from "@/lib/api/bilans";
import { equipeAuthentifiee } from "@/lib/api/v1-equipe";
import { listerPaiementsAdmin, lireReglagesAdmin } from "@/lib/paiement/en-ligne/admin-lectures";

/**
 * Paiements en ligne dans l'application de l'équipe : **lecture seule**. L'état du paiement en ligne (allumé ou non, fournisseur), les chiffres de tête et la liste des
 * paiements avec leurs versements et litiges, comme `/system/paiements`. Les décisions qui déplacent de l'argent (reprendre un versement, trancher un litige) restent sur le
 * site : elles ne sont volontairement PAS exposées ici. Les numéros de téléphone de versement (même masqués) ne sont pas envoyés. Permission `commande.support`.
 */
export async function GET(request: Request) {
  const auth = await equipeAuthentifiee(request, "commande.support");
  if (!auth.ok) return auth.reponse;
  try {
    const [paiements, reglages] = await Promise.all([listerPaiementsAdmin(), lireReglagesAdmin()]);
    return repondre({
      ok: true,
      reglages: { actif: reglages.actif, fournisseur: reglages.fournisseur, valeursValidees: reglages.valeursValideesLe !== null },
      compteurs: compteursPaiements(paiements),
      paiements: paiements.slice(0, 100).map((p) => ({
        id: p.id,
        commandeReference: p.commandeReference,
        restaurantNom: p.restaurantNom,
        etat: p.etat,
        operateur: p.operateur,
        fournisseur: p.fournisseur,
        totalGnf: p.totalGnf,
        restaurantGnf: p.restaurantGnf,
        livreurGnf: p.livreurGnf,
        speedfoodBrutGnf: p.speedfoodBrutGnf,
        fraisMobileGnf: p.fraisMobileGnf,
        rembourseGnf: p.rembourseGnf,
        creeLe: p.creeLe,
        versements: p.versements.map((v) => ({ beneficiaire: v.beneficiaire, etat: v.etat, montantGnf: v.montantGnf, erreurCode: v.erreurCode })),
        litiges: p.litiges.map((l) => ({ situation: l.situation, etat: l.etat, regle: l.regle })),
      })),
    });
  } catch {
    return repondreErreur({ code: "ERREUR_SERVEUR", message: "Les paiements n'ont pas pu être chargés. Réessayez dans un instant." });
  }
}

export const dynamic = "force-dynamic";
