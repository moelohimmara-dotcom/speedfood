import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { exigerPermissionPage, obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import { obtenirDossierRestaurant, obtenirQuartierIdRestaurant, obtenirRestaurantAdmin } from "@/lib/system-admin/restaurants";
import { grouperParCommune, lireQuartiersActifs } from "@/lib/geographie/quartiers";
import { creerClientServeur } from "@/lib/db/server";
import { creerClientAdmin } from "@/lib/db/admin";
import { detailLivraison } from "@/lib/site/livraison";
import { listerMembresAdmin } from "@/lib/system-admin/comptes";
import { PageHeader, Panneau, Pastille, Volet } from "@/components/admin/blocs";
import { lireReglagesAssistance } from "@/lib/parametres/assistance";
import { roleAPermission } from "@/lib/system-admin/permissions";
import { estElementDeTest } from "@/lib/system-admin/pilotageCalculs";
import { definirIllustrationAction, listerPlatsAdmin } from "@/lib/system-admin/illustrations";
import { Illustration } from "@/components/illustrations/Illustration";
import { familleDepuisCategorie, illustrationCouverture, illustrationLogo } from "@/lib/illustrations/automatique";
import { EditeurIllustration } from "@/components/illustrations/EditeurIllustration";
import { ActionsModeration } from "./ActionsModeration";
import { EditeurHoraires } from "./EditeurHoraires";
import { EditeurProfilRestaurant } from "./EditeurProfilRestaurant";
import { EditeurQuartierRestaurant } from "./EditeurQuartierRestaurant";
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
  const [membres, dossier, reglages, contexte, plats, quartierId, quartiers] = await Promise.all([
    listerMembresAdmin(id),
    obtenirDossierRestaurant(id),
    lireReglagesAssistance(),
    obtenirContexteSysteme(),
    listerPlatsAdmin(id),
    obtenirQuartierIdRestaurant(id),
    creerClientServeur().then((supabase) => lireQuartiersActifs(supabase)),
  ]);
  // Zones où le restaurant déclare livrer (lecture seule : c'est le restaurateur qui les déclare, dans « Mon restaurant »).
  const { data: zonesBrutes } = await creerClientAdmin()
    .from("restaurant_zones_desservies")
    .select("frais_gnf, delai_minutes, communes(nom), neighborhoods(nom, communes(nom))")
    .eq("restaurant_id", id);
  const zonesDesservies = (zonesBrutes ?? [])
    .map((z) => ({
      libelle: z.neighborhoods?.nom ? `${z.neighborhoods.nom}${z.neighborhoods.communes?.nom ? ` (${z.neighborhoods.communes.nom})` : ""}` : `Toute la commune de ${z.communes?.nom ?? ""}`,
      detail: detailLivraison(z.frais_gnf, z.delai_minutes),
    }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  const groupesQuartiers = grouperParCommune(quartiers);
  const quartierValide = quartiers.some((q) => q.id === quartierId);
  const famille = familleDepuisCategorie(restaurant.categorie);
  const role = contexte.role;
  const enLigne = restaurant.publie && restaurant.suspendu_le === null;
  const peutOuvrirParametres = roleAPermission(role, "parametres.editer");
  const peutVoirCommandes = roleAPermission(role, "commande.consulter");
  const peutOuvrirComptes = roleAPermission(role, "compte.consulter");
  // Le drapeau de la base fait foi ; la convention de nom ne sert que de filet si le dossier n'a pas pu être lu
  // (sinon un restaurant dont le nom contient « test » serait signalé à tort).
  const estDeTest = dossier ? dossier.estDeTest : estElementDeTest(restaurant.nom);
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
            <Link href={`/restaurants/${restaurant.id}`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              Voir la page (aperçu administrateur)<span className="sr-only"> (nouvel onglet)</span>
            </Link>
          </>
        }
      />

      {restaurant.suspendu_motif ? (
        <div className="ad-bandeau ad-bandeau-danger" role="note">
          <p>
            <strong>Motif de suspension :</strong> {restaurant.suspendu_motif}
          </p>
        </div>
      ) : null}
      {restaurant.motif_correction && !restaurant.suspendu_le ? (
        <div className="ad-bandeau ad-bandeau-attention" role="note">
          <p>
            <strong>Correction demandée :</strong> {restaurant.motif_correction}
          </p>
        </div>
      ) : null}

      <Panneau titre="Administration du restaurant" id="administration-restaurant" actions={<a href="#administration-restaurant" className="lien-texte">Accéder aux modifications</a>}>
        <p className="ad-aide-champ">Modifiez les informations opérationnelles sans retirer le restaurant du catalogue. Chaque modification est journalisée.</p>
        <EditeurQuartierRestaurant
          restaurantId={restaurant.id}
          groupes={groupesQuartiers}
          quartierActuelId={quartierId}
          quartierActuelValide={quartierValide}
        />
        <div className="ad-zones-desservies">
          <h3 className="ad-sous-titre">Zones de livraison déclarées</h3>
          {zonesDesservies.length === 0 ? (
            <p className="ad-aide-champ">Aucune zone déclarée : les clients voient que la livraison n&apos;est pas déclarée (le retrait reste possible).</p>
          ) : (
            <ul className="ad-liste-simple">
              {zonesDesservies.map((z) => (
                <li key={z.libelle}>
                  <strong>{z.libelle}</strong>
                  {z.detail ? <span> · {z.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="ad-aide-champ">Le restaurateur les déclare lui-même dans « Mon restaurant ».</p>
        </div>
        {dossier ? (
          <EditeurProfilRestaurant
            restaurantId={restaurant.id}
            horaires={dossier.horaires}
            consignes={dossier.consignes}
            moyensPaiement={dossier.moyensPaiement}
          />
        ) : null}
      </Panneau>

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
                ) : (
                  <Illustration
                    valeur={dossier?.couvertureIllustration ?? illustrationCouverture(famille)}
                    nom={`Illustration de couverture de ${restaurant.nom}${dossier?.couvertureIllustration ? "" : " (automatique)"}`}
                  />
                )}
              </div>
              <div className="ad-apercu-logo">
                {dossier?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- idem.
                  <img src={dossier.logoUrl} alt={`Logo de ${restaurant.nom}`} />
                ) : (
                  <Illustration
                    valeur={dossier?.logoIllustration ?? illustrationLogo(restaurant.nom, famille)}
                    nom={`Logo illustré de ${restaurant.nom}${dossier?.logoIllustration ? "" : " (automatique)"}`}
                  />
                )}
              </div>
            </div>

            <ul className="ad-controle">
              {points.map((point) => (
                <Fragment key={point.cle}>
                  <li className={`ad-controle-ligne ad-controle-${point.niveau}`}>
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
                  {point.cle === "horaires" && dossier && !dossier.horaires ? (
                    <li className="ad-controle-editeur">
                      <EditeurHoraires restaurantId={restaurant.id} horaires={dossier.horaires} />
                    </li>
                  ) : null}
                </Fragment>
              ))}
            </ul>

            {dossier && dossier.apercuPlats.length > 0 ? (
              <>
                <h3 className="ad-sous-titre">
                  Début du menu
                  <span className="ad-sous-titre-note">
                    {dossier.apercuPlats.length < dossier.plats
                      ? `${dossier.apercuPlats.length} premiers plats sur ${dossier.plats}`
                      : `${dossier.plats} plat${dossier.plats > 1 ? "s" : ""}`}
                  </span>
                </h3>
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
              <p className="ad-aide-champ ad-aide-champ-premier">
                Elles remplacent la photo tant qu&apos;il n&apos;y en a pas. Une vraie photo téléversée par le restaurateur prend toujours le dessus.
              </p>
              <h3 className="ad-sous-titre">Logo</h3>
              <EditeurIllustration cible="logo" id={restaurant.id} restaurantId={restaurant.id} nom={restaurant.nom} famille={famille} valeur={dossier?.logoIllustration ?? null} styles={["monogramme", "pastille"]} action={definirIllustrationAction} />
              <h3 className="ad-sous-titre">Couverture</h3>
              <EditeurIllustration cible="couverture" id={restaurant.id} restaurantId={restaurant.id} nom={restaurant.nom} famille={famille} valeur={dossier?.couvertureIllustration ?? null} styles={["affiche", "assiette"]} action={definirIllustrationAction} />
              <h3 className="ad-sous-titre">Plats</h3>
              <div className="ad-plats-ill">
                {plats.length === 0 ? <p className="ad-aide-champ">Aucun plat.</p> : null}
                {plats.map((plat) => (
                  <details key={plat.id} className="ad-plat-ill">
                    <summary>
                      {plat.illustration ? <Illustration valeur={plat.illustration} nom={plat.nom} decoratif /> : null}
                      <span>
                        {plat.nom}
                        <small className="ad-plat-ill-etat">
                          {plat.photoUrl ? "Photo téléversée" : plat.illustration ? (plat.illustration.genere ? "Illustration de démonstration" : "Illustration personnalisée") : "Aucune illustration"}
                        </small>
                      </span>
                    </summary>
                    <EditeurIllustration cible="plat" id={plat.id} restaurantId={restaurant.id} nom={plat.nom} famille={famille} valeur={plat.illustration} styles={["pastille", "assiette"]} action={definirIllustrationAction} />
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
              <p className="ad-aide-champ ad-aide-champ-premier">
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
