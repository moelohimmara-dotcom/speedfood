import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { listerCommandesARepartir, type CommandeARepartir } from "@/lib/system-admin/repartition-lecture";
import { traiterCommandeEquipeAction } from "@/lib/system-admin/repartition";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { ActualisationAuto } from "./ActualisationAuto";
import { AlerteEquipe } from "./AlerteEquipe";

export const metadata = { title: "Poste de répartition (administration)" };
export const dynamic = "force-dynamic";

const LIBELLES_MODE: Record<string, string> = { livraison: "Livraison", retrait: "Retrait", sur_place: "Sur place", table: "À table" };

function formaterGnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

function BoutonAction({ commandeId, action, libelle, variante = "secondary" }: { commandeId: string; action: string; libelle: string; variante?: "primary" | "secondary" | "danger" }) {
  return (
    <form action={traiterCommandeEquipeAction}>
      <input type="hidden" name="commande_id" value={commandeId} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={`btn btn-${variante} btn-compact`}>
        {libelle}
      </button>
    </form>
  );
}

function CarteCommande({ c, maintenant }: { c: CommandeARepartir; maintenant: Date }) {
  const attente = ancienneteLisible(new Date(c.creeLe), maintenant);
  const chiffres = c.telephoneRestaurant?.replace(/\D/g, "") ?? "";
  return (
    <li className="repartition-commande">
      <div className="repartition-entete">
        <strong>{c.reference}</strong>
        <span>{c.restaurantNom}</span>
        <span className="ad-aide-champ">{LIBELLES_MODE[c.mode] ?? c.mode} · reçue {attente}</span>
        {c.estTest ? <Pastille ton="neutre">Test</Pastille> : null}
      </div>
      <ul className="repartition-lignes">
        {c.lignes.map((l, i) => (
          <li key={`${l.nom}-${i}`}>
            {l.quantite} × {l.nom}
          </li>
        ))}
      </ul>
      <p className="repartition-total">
        Plats {formaterGnf(c.sousTotal)}
        {c.fraisLivraison > 0 ? ` + livraison estimée ${formaterGnf(c.fraisLivraison)}` : ""}
      </p>
      <div className="repartition-contact">
        {c.telephoneRestaurant ? (
          <>
            <span>{c.telephoneRestaurant}</span>
            <a className="lien-texte" href={`tel:${c.telephoneRestaurant}`}>
              Appeler
            </a>
            <a className="lien-texte" href={`https://wa.me/${chiffres}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </>
        ) : (
          <span className="repartition-alerte">Aucun numéro à joindre pour cet établissement : ajoutez-le sur sa fiche.</span>
        )}
        <Link href={`/system/commandes/${c.id}`} className="lien-texte">
          Détail de la commande
        </Link>
        <Link href={`/system/catalogue/restaurants/${c.restaurantId}`} className="lien-texte">
          Fiche de l&apos;établissement
        </Link>
      </div>
      <div className="repartition-actions">
        {c.statut === "en_attente" ? (
          <>
            <BoutonAction commandeId={c.id} action="accepter" libelle="Confirmée par le restaurant" variante="primary" />
            <BoutonAction commandeId={c.id} action="refuser" libelle="Refusée par le restaurant" variante="danger" />
          </>
        ) : null}
        {c.statut === "acceptee" ? (
          <>
            <BoutonAction commandeId={c.id} action="prete" libelle="Prête" variante="primary" />
            <BoutonAction commandeId={c.id} action="annuler" libelle="Annuler" variante="danger" />
          </>
        ) : null}
        {c.statut === "prete" ? <BoutonAction commandeId={c.id} action="terminee" libelle="Remise au client" variante="primary" /> : null}
        {c.statut === "en_attente" ? <BoutonAction commandeId={c.id} action="annuler" libelle="Annuler" /> : null}
      </div>
    </li>
  );
}

/**
 * Poste de répartition (ADR-020) : les commandes actives des établissements tenus par l'équipe. On joint le restaurant, on confirme, on suit la préparation,
 * puis la remise ; la livraison se répartit depuis « Livraisons ». La page se recharge toute seule toutes les 20 secondes.
 */
export default async function RepartitionPage() {
  await exigerPermissionPage("commande.support");
  const commandes = await listerCommandesARepartir();
  const maintenant = new Date();
  const aConfirmer = commandes.filter((c) => c.statut === "en_attente");
  const enPreparation = commandes.filter((c) => c.statut === "acceptee");
  const pretes = commandes.filter((c) => c.statut === "prete");

  return (
    <div>
      <ActualisationAuto />
      <AlerteEquipe aConfirmer={aConfirmer.map((c) => c.id)} />
      <PageHeader titre="Poste de répartition" description="Commandes des établissements tenus par l'équipe : joindre le restaurant, confirmer, suivre la préparation et la remise. La page se met à jour toute seule." />
      <div className="ad-pile">
        <section className="ad-cartes" aria-label="Chiffres clés de la répartition">
          <CarteChiffre libelle="À confirmer" valeur={aConfirmer.length} sous="Le restaurant n'a pas encore répondu" />
          <CarteChiffre libelle="En préparation" valeur={enPreparation.length} sous="Confirmées, pas encore prêtes" />
          <CarteChiffre libelle="Prêtes" valeur={pretes.length} sous="À remettre" />
        </section>

        {commandes.length === 0 ? (
          <Panneau titre="Commandes en cours">
            <EtatVide titre="Aucune commande en cours" texte="Les commandes des établissements en mode « Speedfood » apparaissent ici dès qu'un client les envoie." />
          </Panneau>
        ) : (
          <>
            {[
              { titre: "À confirmer au restaurant", liste: aConfirmer },
              { titre: "En préparation", liste: enPreparation },
              { titre: "Prêtes à remettre", liste: pretes },
            ]
              .filter((g) => g.liste.length > 0)
              .map((g) => (
                <Panneau key={g.titre} titre={g.titre} compteur={g.liste.length}>
                  <ul className="repartition-liste">
                    {g.liste.map((c) => (
                      <CarteCommande key={c.id} c={c} maintenant={maintenant} />
                    ))}
                  </ul>
                </Panneau>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
