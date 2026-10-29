import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { listerJournalContacts } from "@/lib/system-admin/contacts-service";
import {
  LIBELLES_ETAT_ECHEANCE,
  LIBELLES_TYPE_CONTACT,
  formaterDateHeureFr,
  formaterEcheance,
  libelleAncienneteContact,
} from "@/lib/system-admin/contacts-regles";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import { FormulaireContact } from "./FormulaireContact";

/**
 * Lot L7 — journal des contacts avec l'établissement.
 *
 * Chaque contact est daté, typé, avec un compte rendu ; la « prochaine action » porte une échéance,
 * suivie comme un rappel (en retard, aujourd'hui, à venir).
 *
 * Lecture : `restaurant.consulter`. Écriture : `restaurant.moderer` — le journal est le document de
 * travail de l'équipe qui tient l'établissement.
 */

export const metadata = { title: "Journal des contacts (administration)" };
export const dynamic = "force-dynamic";

interface Recherche {
  restaurant?: string;
}

export default async function PageContacts({ searchParams }: { searchParams: Promise<Recherche> }) {
  const contexte = await exigerPermissionPage("restaurant.consulter");
  const peutAgir = roleAPermission(contexte.role, "restaurant.moderer");
  const { restaurant } = await searchParams;
  const restaurantFiltre = restaurant && restaurant !== "tous" ? restaurant : undefined;

  const journal = await listerJournalContacts(restaurantFiltre);
  const { compteurs } = journal;
  const nomFiltre = journal.etablissements.find((e) => e.id === restaurantFiltre)?.nom;

  return (
    <div className="ad-pile">
      <PageHeader
        titre="Journal des contacts"
        description="Ce qui a été dit à l'établissement, quand, et ce qu'il reste à faire. Chaque contact est daté, typé, avec un compte rendu ; la prochaine action est suivie comme un rappel."
      />

      <section className="ad-cartes" aria-label="Chiffres clés du journal des contacts">
        <CarteChiffre libelle="Contacts consignés" valeur={journal.total} sous={nomFiltre ? `pour ${nomFiltre}` : "tous établissements"} />
        <CarteChiffre libelle="Échéances en retard" valeur={compteurs.enRetard} sous="à relancer aujourd'hui" ton={compteurs.enRetard > 0 ? "danger" : "succes"} />
        <CarteChiffre libelle="Échéances du jour" valeur={compteurs.aujourdhui} sous="pour aujourd'hui" />
        <CarteChiffre libelle="Prochaine échéance" valeur={compteurs.prochaine ? formaterDateHeureFr(compteurs.prochaine) : "aucune"} sous="la plus proche à venir" />
      </section>

      <Panneau titre="Consigner un contact">
        <FormulaireContact
          etablissements={journal.etablissements.map((e) => ({ id: e.id, nom: e.nom }))}
          selectionne={restaurantFiltre}
          peutAgir={peutAgir}
        />
      </Panneau>

      <Panneau titre="Journal" compteur={journal.contacts.length}>
        <div className="ad-outils">
          <form method="GET" role="search" className="ad-recherche">
            <label htmlFor="restaurant-filtre" className="sr-only">
              Filtrer par établissement
            </label>
            <select id="restaurant-filtre" name="restaurant" defaultValue={restaurantFiltre ?? "tous"}>
              <option value="tous">Tous les établissements</option>
              {journal.etablissements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary btn-compact">
              Filtrer
            </button>
          </form>
          {nomFiltre ? (
            <div className="alerte alerte-info u-fs-0-85rem" role="note">
              Filtre : contacts de {nomFiltre} seulement.{" "}
              <Link href="/system/contacts" className="u-fw-700">
                Voir tous les établissements
              </Link>
            </div>
          ) : null}
        </div>

        {journal.contacts.length === 0 ? (
          <EtatVide
            titre="Aucun contact consigné"
            texte="Les appels, visites et relances avec les établissements de l'équipe apparaissent ici, avec la prochaine action à mener."
          />
        ) : (
          <ul className="ad-chronologie">
            {journal.contacts.map((contact) => {
              const etat = LIBELLES_ETAT_ECHEANCE[contact.etatEcheance];
              return (
                <li key={contact.id} className="ad-case-ligne">
                  <div>
                    <p className="ad-liste-titre">
                      <Pastille ton="neutre">{LIBELLES_TYPE_CONTACT[contact.type]}</Pastille> {contact.nomEtablissement}
                    </p>
                    <p className="ad-liste-meta">
                      {formaterDateHeureFr(contact.creeLe)} · {libelleAncienneteContact(contact.creeLe, journal.maintenant)}
                    </p>
                    <p className="ad-liste-texte">{contact.compteRendu}</p>
                    {contact.prochaineAction ? (
                      <p className="ad-liste-meta">
                        Prochaine action : {contact.prochaineAction} — {formaterEcheance(contact.echeanceLe, journal.maintenant)}
                      </p>
                    ) : null}
                  </div>
                  {contact.prochaineAction ? <Pastille ton={etat.ton}>{etat.texte}</Pastille> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panneau>
    </div>
  );
}
