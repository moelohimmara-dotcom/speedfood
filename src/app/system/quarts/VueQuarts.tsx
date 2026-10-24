import Link from "next/link";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille } from "@/components/admin/blocs";
import {
  etatEtablissement,
  libelleAttente,
  libelleDelai,
  libelleEtatEtablissement,
  libelleRoleOperateur,
  type EtablissementQuart,
  type OperateurQuart,
} from "@/lib/system-admin/quarts-regles";
import type { AlerteRelance, VueQuarts } from "@/lib/system-admin/quarts-service";
import { ActionsEtablissement, RelanceCommande, type CommandeAffichee } from "./ActionsQuart";

/**
 * Affichage de l'écran « Quarts et affectation » (lot L2).
 *
 * Composant de présentation : il ne lit rien, il reçoit la vue déjà chargée. C'est ce qui permet
 * de rejouer l'écran avec des données factices (page d'aperçu) sans toucher au code de lecture.
 */

const LIBELLES_MODE: Record<string, string> = { livraison: "Livraison", retrait: "Retrait" };
const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  prete: "Prête",
};

export function VueQuartsEcran({ vue, moiId }: { vue: VueQuarts; moiId: string }) {
  const maintenant = new Date();

  return (
    <div className="ad-pile">
      <PageHeader
        titre="Quarts et affectation"
        description={`Qui tient quel établissement de l'équipe. Une commande qui attend depuis plus de ${libelleDelai(vue.delaiMinutes)} sur un établissement non pris déclenche une alerte de relance.`}
        retour={{ href: "/system", libelle: "Tableau de bord" }}
      />

      <section className="ad-cartes" aria-label="Chiffres clés des quarts">
        <CarteChiffre libelle="À moi" valeur={vue.moi.length} sous="Établissements que je tiens" />
        <CarteChiffre
          libelle="Non pris"
          valeur={vue.nonPris.length}
          sous="Aucun opérateur"
          ton={vue.nonPris.length > 0 ? "danger" : "neutre"}
        />
        <CarteChiffre
          libelle="Non reprises"
          valeur={vue.alertes.length}
          sous={`Commandes en attente depuis plus de ${libelleDelai(vue.delaiMinutes)}`}
          ton={vue.alertes.length > 0 ? "danger" : "neutre"}
        />
        <CarteChiffre libelle="Équipe" valeur={vue.operateurs.length} sous="Membres d'exploitation" />
      </section>

      <Panneau titre="Alerte de relance" compteur={vue.alertes.length}>
        {vue.alertes.length === 0 ? (
          <EtatVide
            titre="Aucune commande en attente de relance"
            texte={`Aucune commande d'un établissement non pris n'attend depuis plus de ${libelleDelai(vue.delaiMinutes)}.`}
          />
        ) : (
          <ul className="ad-liste">
            {vue.alertes.map((alerte) => (
              <CarteAlerte key={alerte.commande.id} alerte={alerte} />
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="À moi" compteur={vue.moi.length}>
        {vue.moi.length === 0 ? (
          <EtatVide
            titre="Vous ne tenez aucun établissement"
            texte="Prenez un établissement dans la file « non pris » pour le suivre."
          />
        ) : (
          <ul className="ad-liste">
            {vue.moi.map((etablissement) => (
              <CarteEtablissement
                key={etablissement.id}
                etablissement={etablissement}
                moiId={moiId}
                operateurs={vue.operateurs}
                maintenant={maintenant}
              />
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="Non pris" compteur={vue.nonPris.length}>
        {vue.nonPris.length === 0 ? (
          <EtatVide titre="Tous les établissements sont pris" texte="Chaque établissement de l'équipe a un opérateur." />
        ) : (
          <ul className="ad-liste">
            {vue.nonPris.map((etablissement) => (
              <CarteEtablissement
                key={etablissement.id}
                etablissement={etablissement}
                moiId={moiId}
                operateurs={vue.operateurs}
                maintenant={maintenant}
              />
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="Tenu par un autre membre de l'équipe" compteur={vue.autres.length}>
        {vue.autres.length === 0 ? (
          <EtatVide
            titre="Aucun établissement pris par un collègue"
            texte="Les établissements pris par un autre membre de l'équipe apparaissent ici."
          />
        ) : (
          <ul className="ad-liste">
            {vue.autres.map((etablissement) => (
              <CarteEtablissement
                key={etablissement.id}
                etablissement={etablissement}
                moiId={moiId}
                operateurs={vue.operateurs}
                maintenant={maintenant}
              />
            ))}
          </ul>
        )}
      </Panneau>

      <Panneau titre="Équipe d'exploitation" compteur={vue.operateurs.length}>
        <ul className="ad-liste">
          {vue.operateurs.map((operateur) => (
            <li key={operateur.utilisateurId} className="ad-liste">
              <span className="ad-liste-titre">
                {operateur.utilisateurId === moiId ? "Moi-même" : operateur.email || "Sans e-mail"}
              </span>
              <span className="ad-liste-meta">
                {libelleRoleOperateur(operateur.role)} ·{" "}
                {vue.etablissements.filter((e) => e.titulaireId === operateur.utilisateurId).length} établissement(s) tenu(s)
              </span>
            </li>
          ))}
        </ul>
      </Panneau>
    </div>
  );
}

/** Une commande qui attend : le temps d'attente et la relance. */
function CarteAlerte({ alerte }: { alerte: AlerteRelance }) {
  const commande = alerte.commande;
  return (
    <li className="ad-liste">
      <span className="ad-liste-titre">
        {commande.reference} · {commande.restaurantNom}
      </span>
      <span className="ad-liste-meta">
        reçue {libelleAttente(commande.creeLe, new Date())} · {alerte.minutesAttente} min d&apos;attente
        {alerte.derniereRelance
          ? ` · déjà relancée le ${new Date(alerte.derniereRelance).toLocaleString("fr-FR")}`
          : " · jamais relancée"}
      </span>
      <div className="ad-actions-ligne">
        <RelanceCommande commandeId={commande.id} reference={commande.reference} />
        <Link href={`/system/commandes/${commande.id}`} className="lien-texte">
          Détail de la commande
        </Link>
        <Link href="/system/repartition" className="lien-texte">
          Poste de répartition
        </Link>
      </div>
    </li>
  );
}

/** Un établissement : son titulaire, ses commandes en cours et l'action de prise ou de libération. */
function CarteEtablissement({
  etablissement,
  moiId,
  operateurs,
  maintenant,
}: {
  etablissement: EtablissementQuart;
  moiId: string;
  operateurs: OperateurQuart[];
  maintenant: Date;
}) {
  const etat = etatEtablissement(etablissement.titulaireId, moiId);
  const libelle = libelleEtatEtablissement(etat);
  const operateurCourant = operateurs.find((operateur) => operateur.utilisateurId === etablissement.titulaireId);
  const commandes: CommandeAffichee[] = etablissement.commandes.map((commande) => ({
    id: commande.id,
    reference: commande.reference,
    attente: libelleAttente(commande.creeLe, maintenant),
    statut: LIBELLES_STATUT[commande.statut] ?? commande.statut,
    mode: LIBELLES_MODE[commande.modeCommande] ?? commande.modeCommande,
  }));

  return (
    <li className="ad-liste">
      <span className="ad-liste-titre">
        {etablissement.nom} <Pastille ton={libelle.ton}>{libelle.texte}</Pastille>
      </span>
      <span className="ad-liste-meta">
        {etablissement.titulaireId
          ? `Tenu par ${operateurCourant?.email || "un membre de l'équipe"}${etablissement.priseLe ? ` · pris ${libelleAttente(etablissement.priseLe, maintenant)}` : ""}`
          : "Aucun opérateur : les commandes de cet établissement attendent."}
      </span>
      {commandes.length === 0 ? <span className="ad-liste-meta">Aucune commande en cours.</span> : null}

      <ActionsEtablissement
        restaurantId={etablissement.id}
        etat={etat}
        operateurId={etablissement.titulaireId ?? moiId}
        moiId={moiId}
        operateurs={operateurs}
        commandes={commandes}
      />
    </li>
  );
}
