import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { obtenirDossierRestaurant, obtenirRestaurantAdmin } from "@/lib/system-admin/restaurants";
import { listerMembresAdmin } from "@/lib/system-admin/comptes";
import { PageHeader, Panneau, Pastille, Volet } from "@/components/admin/blocs";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { estElementDeTest } from "@/lib/system-admin/pilotageCalculs";
import { listerPlatsAdmin } from "@/lib/system-admin/illustrations";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie } from "@/lib/illustrations/automatique";
import { EditeurIllustration } from "./EditeurIllustration";
import { ActionsModeration } from "./ActionsModeration";
import { GestionEquipe } from "./GestionEquipe";

export const metadata = { title: "Fiche restaurant (administration)" };

type Niveau = "ok" | "manque" | "conseille";

interface PointControle {
  cle: string;
  libelle: string;
  detail: string;
  niveau: Niveau;
  /** Un point obligatoire manquant empêche d'approuver. */
  obligatoire: boolean;
}

function formaterGnf(montant: number): string {
  return `${montant.toLocaleString("fr-FR")} GNF`;
}

/**
 * Fiche d'un restaurant côté administration, pensée pour décider : à gauche le dossier à contrôler (liste de contrôle
 * avec ce qui manque, aperçus, menu, commandes), à droite le panneau de décision (état, action principale, correction,
 * puis zone sensible). L'équipe, rarement utile, est dans un tiroir.
 */
export default async function RestaurantDetailSystemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerPermissionPage("restaurant.moderer");
  const { id } = await params;

  const restaurant = await obtenirRestaurantAdmin(id);
  if (!restaurant) {
    notFound();
  }
  const [membres, dossier, reglages, contexte, plats] = await Promise.all([
    listerMembresAdmin(id),
    obtenirDossierRestaurant(id),
    lireReglagesAssistance(),
    obtenirContexteSysteme(),
    listerPlatsAdmin(id),
  ]);
  const famille = familleDepuisCategorie(restaurant.categorie);
  const role = contexte.role;
  const enLigne = restaurant.publie && restaurant.suspendu_le === null;
  const peutOuvrirParametres = roleAPermission(role, "parametres.editer");
  const peutVoirCommandes = roleAPermission(role, "commande.consulter");
  const peutOuvrirComptes = roleAPermission(role, "compte.consulter");
  const estDeTest = estElementDeTest(restaurant.nom) || dossier?.estDeTest === true;
  const aUnProprietaire = membres.some((m) => m.role === "owner");

  const points: PointControle[] = dossier
    ? [
        {
          cle: "proprietaire",
          libelle: "Propriétaire rattaché",
          detail: aUnProprietaire ? "Un compte propriétaire gère ce restaurant." : "Aucun propriétaire : personne ne peut recevoir les commandes.",
          niveau: aUnProprietaire ? "ok" : "manque",
          obligatoire: true,
        },
        {
          cle: "menu",
          libelle: "Menu",
          detail:
            dossier.plats === 0
              ? "Aucun plat : les clients ne pourraient rien commander."
              : `${dossier.plats} plat${dossier.plats > 1 ? "s" : ""}, ${dossier.platsDisponibles} disponible${dossier.platsDisponibles > 1 ? "s" : ""}, ${dossier.platsAvecPhoto} avec photo.`,
          niveau: dossier.plats > 0 ? "ok" : "manque",
          obligatoire: true,
        },
        {
          cle: "horaires",
          libelle: "Horaires",
          detail: dossier.horaires || "Non renseignés : les clients ne savent pas quand commander.",
          niveau: dossier.horaires ? "ok" : "manque",
          obligatoire: true,
        },
        {
          cle: "photo",
          libelle: "Photo de couverture",
          detail: dossier.photoUrl ? "Présente." : "Absente : la fiche paraîtra vide dans le catalogue.",
          niveau: dossier.photoUrl ? "ok" : "conseille",
          obligatoire: false,
        },
        {
          cle: "logo",
          libelle: "Logo",
          detail: dossier.logoUrl ? "Présent." : "Absent : facultatif, mais il rassure les clients.",
          niveau: dossier.logoUrl ? "ok" : "conseille",
          obligatoire: false,
        },
        {
          cle: "paiement",
          libelle: "Moyens de paiement",
          detail: dossier.moyensPaiement.length > 0 ? dossier.moyensPaiement.join(", ") : "Non précisés : le client ne sait pas comment payer.",
          niveau: dossier.moyensPaiement.length > 0 ? "ok" : "conseille",
          obligatoire: false,
        },
        {
          cle: "position",
          libelle: "Position sur la carte",
          detail: dossier.aPosition ? "Renseignée." : "Non renseignée : facultatif.",
          niveau: dossier.aPosition ? "ok" : "conseille",
          obligatoire: false,
        },
      ]
    : [];
  const bloquants = points.filter((p) => p.obligatoire && p.niveau === "manque").map((p) => p.libelle.toLowerCase());
  const conseilles = points.filter((p) => p.niveau === "conseille").length;

  const phrasEtat = restaurant.suspendu_le
    ? "Suspendu : invisible des clients tant qu'il n'est pas réactivé."
    : enLigne
      ? "En ligne : visible des clients."
      : restaurant.motif_correction
        ? "En attente d'une correction du restaurateur."
        : "En attente de votre décision : invisible des clients.";

  return (
    <div>
      <PageHeader
        titre={restaurant.nom}
        retour={{ href: "/system/catalogue/restaurants", libelle: "Tous les restaurants" }}
        description={`${restaurant.categorie || "Catégorie non renseignée"} · ${restaurant.quartier || "quartier non renseigné"} · créé le ${new Date(restaurant.cree_le).toLocaleDateString("fr-FR")}`}
        actions={
          <>
            {estDeTest ? <Pastille ton="neutre">Restaurant de test</Pastille> : null}
            {restaurant.suspendu_le ? (
              <Pastille ton="danger">Suspendu</Pastille>
            ) : restaurant.motif_correction ? (
              <Pastille ton="attention">Correction demandée</Pastille>
            ) : (
              <Pastille ton={restaurant.publie ? "succes" : "neutre"}>{restaurant.publie ? "Publié" : "En attente"}</Pastille>
            )}
            <Pastille ton={restaurant.ouvert ? "succes" : "neutre"}>{restaurant.ouvert ? "Ouvert" : "Fermé"}</Pastille>
          </>
        }
      />

      {restaurant.suspendu_motif ? (
        <div className="ad-bandeau ad-bandeau-danger" role="note">
          <p style={{ margin: 0 }}>
            <strong>Motif de suspension :</strong> {restaurant.suspendu_motif}
          </p>
        </div>
      ) : null}
      {restaurant.motif_correction && !restaurant.suspendu_le ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p style={{ margin: 0 }}>
            <strong>Correction demandée :</strong> {restaurant.motif_correction}
          </p>
        </div>
      ) : null}

      <div className="ad-fiche">
        <div className="ad-fiche-principal">
          <Panneau
            titre="Dossier à contrôler"
            actions={
              <span className={bloquants.length > 0 ? "ad-fiche-synthese ad-fiche-synthese-manque" : "ad-fiche-synthese"}>
                {bloquants.length > 0
                  ? `${bloquants.length} point${bloquants.length > 1 ? "s" : ""} bloquant${bloquants.length > 1 ? "s" : ""}`
                  : conseilles > 0
                    ? `Complet, ${conseilles} conseil${conseilles > 1 ? "s" : ""}`
                    : "Complet"}
              </span>
            }
          >
            <div className="ad-apercus">
              <div className="ad-apercu-photo">
                {dossier?.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu d'un média déjà hébergé, dimensions libres.
                  <img src={dossier.photoUrl} alt={`Photo de couverture de ${restaurant.nom}`} />
                ) : dossier?.couvertureIllustration ? (
                  <Illustration valeur={dossier.couvertureIllustration} nom={`Illustration de couverture de ${restaurant.nom}`} />
                ) : (
                  <span>Pas de photo</span>
                )}
              </div>
              <div className="ad-apercu-logo">
                {dossier?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- idem.
                  <img src={dossier.logoUrl} alt={`Logo de ${restaurant.nom}`} />
                ) : dossier?.logoIllustration ? (
                  <Illustration valeur={dossier.logoIllustration} nom={`Logo illustré de ${restaurant.nom}`} />
                ) : (
                  <span>Pas de logo</span>
                )}
              </div>
            </div>

            <ul className="ad-controle">
              {points.map((point) => (
                <li key={point.cle} className={`ad-controle-ligne ad-controle-${point.niveau}`}>
                  <span className="ad-controle-marque" aria-hidden="true">
                    {point.niveau === "ok" ? "✓" : point.niveau === "manque" ? "✕" : "!"}
                  </span>
                  <span>
                    <strong>{point.libelle}</strong>
                    {point.obligatoire ? <span className="ad-controle-tag"> obligatoire</span> : null}
                    <span className="ad-controle-detail">{point.detail}</span>
                  </span>
                  <span className="sr-only">
                    {point.niveau === "ok" ? "Conforme" : point.niveau === "manque" ? "Manquant" : "À améliorer"}
                  </span>
                </li>
              ))}
            </ul>

            {dossier && dossier.apercuPlats.length > 0 ? (
              <>
                <h3 className="ad-sous-titre">Début du menu</h3>
                <ul className="ad-apercu-menu">
                  {dossier.apercuPlats.map((plat, i) => (
                    <li key={`${plat.nom}-${i}`}>
                      <span>{plat.nom}</span>
                      <strong>{formaterGnf(plat.prix)}</strong>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <p className="ad-fiche-liens">
              {enLigne ? (
                <Link href={`/restaurants/${restaurant.id}`} className="lien-texte" target="_blank" rel="noopener">
                  Voir la page vue par les clients
                </Link>
              ) : null}
              {peutVoirCommandes ? (
                <Link href={`/system/commandes?restaurant=${restaurant.id}`} className="lien-texte">
                  Commandes de ce restaurant{dossier ? ` (${dossier.commandes})` : ""}
                </Link>
              ) : null}
            </p>
          </Panneau>

          {roleAPermission(role, "restaurant.moderer") ? (
            <Volet
              titre="Illustrations"
              resume={`Logo, couverture et ${plats.length} plat${plats.length > 1 ? "s" : ""} : modifiables`}
            >
              <p className="ad-aide-champ" style={{ marginTop: 0 }}>
                Elles remplacent la photo tant qu&apos;il n&apos;y en a pas. Une vraie photo téléversée par le restaurateur prend toujours le dessus.
              </p>
              <h3 className="ad-sous-titre">Logo</h3>
              <EditeurIllustration cible="logo" id={restaurant.id} restaurantId={restaurant.id} nom={restaurant.nom} famille={famille} valeur={dossier?.logoIllustration ?? null} styles={["monogramme", "pastille"]} />
              <h3 className="ad-sous-titre">Couverture</h3>
              <EditeurIllustration cible="couverture" id={restaurant.id} restaurantId={restaurant.id} nom={restaurant.nom} famille={famille} valeur={dossier?.couvertureIllustration ?? null} styles={["affiche", "assiette"]} />
              <h3 className="ad-sous-titre">Plats</h3>
              <div className="ad-plats-ill">
                {plats.length === 0 ? <p className="ad-aide-champ">Aucun plat.</p> : null}
                {plats.map((plat) => (
                  <details key={plat.id} className="ad-plat-ill">
                    <summary>
                      {plat.illustration ? <Illustration valeur={plat.illustration} nom={plat.nom} decoratif /> : null}
                      <span>
                        {plat.nom}
                        <small style={{ display: "block", color: "var(--secondaire)" }}>
                          {plat.photoUrl ? "Photo téléversée" : plat.illustration ? (plat.illustration.genere ? "Illustration de démonstration" : "Illustration personnalisée") : "Aucune illustration"}
                        </small>
                      </span>
                    </summary>
                    <EditeurIllustration cible="plat" id={plat.id} restaurantId={restaurant.id} nom={plat.nom} famille={famille} valeur={plat.illustration} styles={["pastille", "assiette"]} />
                  </details>
                ))}
              </div>
            </Volet>
          ) : null}

          <Volet
            titre="Équipe"
            ouvert={membres.length === 0}
            resume={membres.length === 0 ? "Aucun membre" : `${membres.length} membre${membres.length > 1 ? "s" : ""}`}
          >
            <GestionEquipe restaurantId={restaurant.id} membres={membres} />
            {peutOuvrirComptes ? (
              <p className="ad-aide-champ">
                Pour suivre ou supprimer un compte, voir{" "}
                <Link href="/system/acces/comptes" className="lien-texte">
                  Accès, comptes
                </Link>
                .
              </p>
            ) : null}
          </Volet>
        </div>

        <aside className="ad-fiche-decision" aria-label="Décision de modération">
          <Panneau titre="Décision">
            <p className="ad-decision-etat">{phrasEtat}</p>
            {!enLigne && reglages.delaiValidationHeures !== null ? (
              <p className="ad-aide-champ" style={{ marginTop: 0 }}>
                Délai annoncé aux restaurateurs : {reglages.delaiValidationHeures} h
                {peutOuvrirParametres ? (
                  <>
                    {" · "}
                    <Link href="/system/parametres" className="lien-texte">
                      Modifier
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            <ActionsModeration
              restaurantId={restaurant.id}
              publie={restaurant.publie}
              suspendu={restaurant.suspendu_le !== null}
              aUneCorrectionEnCours={restaurant.motif_correction !== null}
              bloquants={bloquants}
            />
            {restaurant.suspendu_le || restaurant.motif_correction ? (
              <p className="ad-aide-champ">
                <Link href="/system/audit?action=restaurant.suspension" className="lien-texte">
                  Voir l&apos;historique des décisions
                </Link>
              </p>
            ) : null}
          </Panneau>
        </aside>
      </div>
    </div>
  );
}
