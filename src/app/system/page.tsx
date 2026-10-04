import Link from "next/link";
import { CarteChiffre, EtatVide, PageHeader, Panneau, Pastille, Tuile, Volet } from "@/components/admin/blocs";
import { IconeAdmin } from "@/components/admin/icones";
import {
  Anneau,
  BarresHorizontales,
  COULEURS_CATEGORIE,
  GraphiqueBarresJours,
  GraphiqueHeures,
  LIBELLES_CATEGORIE,
  Legende,
  Tendance,
  Variation,
} from "@/components/admin/graphiques";
import { ancienneteLisible } from "@/lib/disponibilite/etat";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
import {
  comparerPeriodes,
  construireJours,
  estElementDeTest,
  heuresPleines,
  pourcentage,
  tauxAcceptation,
  variation,
} from "@/lib/system-admin/pilotageCalculs";
import {
  LIBELLES_PERMISSIONS,
  LIBELLES_ROLES,
  permissionsDuRole,
  roleAPermission,
  VERSION_MATRICE,
} from "@/lib/system-admin/permissions";
import {
  listerPropositionsEnAttente,
  listerRestaurantsEnAttenteValidation,
  obtenirActiviteRecente,
  obtenirComptesSystemeParRole,
  obtenirPilotageCommandes,
  obtenirStatistiquesApplication,
} from "@/lib/system-admin/tableauDeBord";
import { FilePrioritaire, type LigneFilePriorite } from "./FilePrioritaire";
import { ListeActivite, type LigneActivite } from "./ActiviteRecente";
import { formaterEcheance } from "./formatage";

export const metadata = { title: "Tableau de bord" };

const PERIODES = [7, 14, 30] as const;
const PERIODE_PAR_DEFAUT = 14;

function formaterGnf(montant: number): string {
  return `${Math.round(montant).toLocaleString("fr-FR")} GNF`;
}

/**
 * Tableau de bord de pilotage `/system` (refonte du 4 octobre 2026). Lecture dans l'ordre du travail :
 * 1. raccourcis d'action et chiffres clés (avec la tendance par rapport à la période précédente) ;
 * 2. ce qui attend une décision, avec son ancienneté, et l'état des restaurants ;
 * 3. graphiques de commandes (par jour, répartition, heures de pointe), chacun avec ses chiffres en tableau ;
 * 4. tiroirs repliables pour le reste (éléments de test, activité, contenus, équipe, droits du rôle).
 *
 * Chaque zone n'est ni lue ni affichée si le rôle courant n'en a pas la permission ; les lectures sont lancées en parallèle
 * et chaque fonction re-vérifie sa permission. Aucun graphique ne contient de donnée personnelle (agrégats seulement).
 */
export default async function AccueilCmsSystemePage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const contexte = await obtenirContexteSysteme();
  const role = contexte.role;
  const permissions = permissionsDuRole(role);

  const { periode: periodeBrute } = await searchParams;
  const periodeDemandee = Number.parseInt(periodeBrute ?? "", 10);
  const periode = (PERIODES as readonly number[]).includes(periodeDemandee) ? periodeDemandee : PERIODE_PAR_DEFAUT;

  const peutVoirRestaurants = roleAPermission(role, "restaurant.consulter");
  const [stats, comptesSysteme, restaurantsEnAttente, propositionsEnAttente, activite, pilotage] = await Promise.all([
    obtenirStatistiquesApplication(periode),
    roleAPermission(role, "systeme.roles") ? obtenirComptesSystemeParRole() : null,
    roleAPermission(role, "restaurant.moderer") ? listerRestaurantsEnAttenteValidation() : null,
    roleAPermission(role, "commande.consulter") ? listerPropositionsEnAttente() : null,
    roleAPermission(role, "systeme.audit") ? obtenirActiviteRecente() : null,
    roleAPermission(role, "commande.consulter") ? obtenirPilotageCommandes(periode) : null,
  ]);
  const compteursRestaurants = peutVoirRestaurants ? stats.restaurants : null;

  const maintenant = new Date();

  // --- Chiffres et graphiques de commandes ---
  const jours = pilotage ? construireJours(pilotage.lignes, periode, maintenant) : [];
  const { courant, precedent } = pilotage
    ? comparerPeriodes(pilotage.lignes, periode, maintenant)
    : { courant: null, precedent: null };
  const heures = pilotage ? heuresPleines(pilotage.heures) : [];
  const tauxCourant = courant ? tauxAcceptation(courant) : null;
  const tauxPrecedent = precedent ? tauxAcceptation(precedent) : null;
  const decidees = courant ? courant.total - courant.enAttente : 0;

  // --- File « à traiter » : le travail réel d'abord, les éléments de test à part ---
  const lignesFile: LigneFilePriorite[] = [];
  const lignesTest: { id: string; nom: string; creeLe: string }[] = [];
  for (const proposition of propositionsEnAttente ?? []) {
    lignesFile.push({
      href: `/system/commandes/${proposition.commandeId}`,
      titre: `Proposition client, commande ${proposition.reference || proposition.commandeId}`,
      meta: `${formaterEcheance(proposition.expireLe)} · nouveau total ${proposition.nouveauSousTotal.toLocaleString("fr-FR")} GNF`,
      badge: "Réponse client",
      ton: "danger",
    });
  }
  for (const restaurant of restaurantsEnAttente ?? []) {
    if (estElementDeTest(restaurant.nom)) {
      lignesTest.push({ id: restaurant.id, nom: restaurant.nom, creeLe: restaurant.creeLe });
      continue;
    }
    const jourAttente = Math.floor((maintenant.getTime() - new Date(restaurant.creeLe).getTime()) / 86_400_000);
    lignesFile.push({
      href: `/system/catalogue/restaurants/${restaurant.id}`,
      titre: restaurant.nom,
      meta: `Demande de mise en ligne déposée ${ancienneteLisible(new Date(restaurant.creeLe), maintenant)}`,
      badge: jourAttente >= 3 ? `À valider · ${jourAttente} j` : "À valider",
      ton: "danger",
    });
  }
  const fileOuverte = roleAPermission(role, "restaurant.moderer") || roleAPermission(role, "commande.consulter");

  const lignesActivite: LigneActivite[] = (activite ?? []).map((evenement) => ({
    id: evenement.id,
    action: evenement.action,
    cibleType: evenement.cibleType,
    cibleId: evenement.cibleId,
    acteurEmail: evenement.acteurEmail,
    horodatage: evenement.horodatage,
  }));

  // --- Raccourcis d'action (une ligne de boutons sous le titre) ---
  const raccourcis: { href: string; libelle: string; icone: string }[] = [];
  if (roleAPermission(role, "restaurant.moderer")) {
    raccourcis.push({ href: "/system/catalogue/restaurants?statut=en_attente", libelle: "Valider un restaurant", icone: "catalogue" });
  }
  if (roleAPermission(role, "commande.consulter")) {
    raccourcis.push({ href: "/system/commandes?jour=1", libelle: "Commandes du jour", icone: "commandes" });
    raccourcis.push({ href: "/system/commandes?statut=en_attente", libelle: "Commandes en attente", icone: "commandes" });
  }
  if (roleAPermission(role, "contenu.editer")) {
    raccourcis.push({ href: "/system/contenu/pages", libelle: "Créer une page", icone: "contenu" });
  }
  if (roleAPermission(role, "contenu.mettre_en_avant")) {
    raccourcis.push({ href: "/system/catalogue/mises-en-avant", libelle: "Mises en avant", icone: "catalogue" });
  }
  if (roleAPermission(role, "systeme.roles")) {
    raccourcis.push({ href: "/system/acces/roles", libelle: "Rôles système", icone: "acces" });
  }
  if (roleAPermission(role, "systeme.audit")) {
    raccourcis.push({ href: "/system/audit", libelle: "Journal d'audit", icone: "audit" });
  }

  const dateDuJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(maintenant);

  return (
    <div>
      <PageHeader
        titre="Tableau de bord"
        description={`${LIBELLES_ROLES[role]} · ${dateDuJour}`}
        actions={
          pilotage ? (
            <nav className="ad-periode" aria-label="Période des graphiques">
              <span className="ad-periode-titre">Période</span>
              {PERIODES.map((valeur) => (
                <Link
                  key={valeur}
                  href={valeur === PERIODE_PAR_DEFAUT ? "/system" : `/system?periode=${valeur}`}
                  className={`chip ${periode === valeur ? "actif" : ""}`}
                  aria-current={periode === valeur ? "true" : undefined}
                >
                  {valeur} jours
                </Link>
              ))}
            </nav>
          ) : null
        }
      />

      {raccourcis.length > 0 ? (
        <ul className="ad-raccourcis" aria-label="Raccourcis">
          {raccourcis.map((raccourci) => (
            <li key={raccourci.href + raccourci.libelle}>
              <Link href={raccourci.href}>
                <IconeAdmin nom={raccourci.icone} taille={18} />
                {raccourci.libelle}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* 1. Chiffres clés */}
      {courant && precedent ? (
        <section className="ad-cartes" aria-label={`Chiffres clés des ${periode} derniers jours`}>
          <CarteChiffre
            libelle={`Commandes, ${periode} derniers jours`}
            valeur={courant.total}
            href="/system/commandes"
            sous={<Variation valeur={variation(courant.total, precedent.total)} />}
            tendance={<Tendance valeurs={jours.map((j) => j.total)} />}
          />
          <CarteChiffre
            libelle="Taux d'acceptation"
            valeur={tauxCourant === null ? "—" : `${Math.round(tauxCourant * 100)} %`}
            sous={
              tauxCourant === null
                ? "Aucune commande encore décidée sur la période"
                : `${courant.enCours + courant.terminees} acceptées sur ${decidees} décidées${
                    tauxPrecedent === null ? "" : ` (${Math.round(tauxPrecedent * 100)} % avant)`
                  }`
            }
            ton={tauxCourant !== null && tauxCourant < 0.6 ? "danger" : "neutre"}
          />
          <CarteChiffre
            libelle="Montant des commandes"
            valeur={formaterGnf(courant.montantRetenu)}
            sous={
              <>
                <Variation valeur={variation(courant.montantRetenu, precedent.montantRetenu)} />
                <br />
                Indicatif : le règlement se fait hors Speedfood.
              </>
            }
          />
          {compteursRestaurants ? (
            <CarteChiffre
              libelle="Restaurants publiés"
              valeur={compteursRestaurants.publies}
              href="/system/catalogue/restaurants?statut=publies"
              sous={
                compteursRestaurants.enAttente > 0
                  ? `${compteursRestaurants.enAttente} en attente de validation`
                  : "Aucune validation en attente"
              }
            />
          ) : null}
        </section>
      ) : compteursRestaurants ? (
        <section className="ad-cartes" aria-label="Chiffres clés">
          <CarteChiffre
            libelle="Restaurants publiés"
            valeur={compteursRestaurants.publies}
            href="/system/catalogue/restaurants?statut=publies"
            sous={`${compteursRestaurants.enAttente} en attente de validation`}
          />
        </section>
      ) : null}

      {/* Autres chiffres clés : toute l'application */}
      <section className="ad-cartes" aria-label="Autres chiffres clés">
        {roleAPermission(role, "compte.consulter") ? (
          <CarteChiffre
            libelle="Comptes clients"
            valeur={stats.clients.comptes}
            href="/system/acces/comptes"
            sous={`${stats.clients.nouveaux} nouveau${stats.clients.nouveaux > 1 ? "x" : ""} sur ${periode} jours`}
          />
        ) : null}
        {peutVoirRestaurants ? (
          <CarteChiffre
            libelle="Plats disponibles"
            valeur={stats.catalogue.disponibles}
            sous={`${stats.catalogue.plats} plats au total, ${pourcentage(stats.catalogue.disponibles, stats.catalogue.plats)} % disponibles`}
          />
        ) : null}
        {peutVoirRestaurants ? (
          <CarteChiffre
            libelle="Restaurants équipés d'alertes"
            valeur={`${stats.alertes.restaurantsEquipes} / ${stats.restaurants.publies}`}
            sous={
              stats.restaurants.publies > stats.alertes.restaurantsEquipes
                ? "Certains restaurants publiés ne recevront pas d'alerte de commande"
                : "Tous les restaurants publiés reçoivent les alertes"
            }
            ton={stats.restaurants.publies > stats.alertes.restaurantsEquipes ? "danger" : "neutre"}
          />
        ) : null}
        {roleAPermission(role, "systeme.audit") ? (
          <CarteChiffre
            libelle="Actions enregistrées"
            valeur={stats.evenementsAudit}
            href="/system/audit"
            sous={`Dans le journal d'audit sur ${periode} jours`}
          />
        ) : null}
      </section>

      {/* 2. À traiter et restaurants */}
      {fileOuverte || compteursRestaurants ? (
        <div className="ad-pilotage-deux">
          {fileOuverte ? <FilePrioritaire lignes={lignesFile} notesDeTest={lignesTest.length} /> : null}
          {compteursRestaurants ? (
            <Panneau titre="Restaurants">
              <BarresHorizontales
                lignes={[
                  { cle: "publies", libelle: "Publiés", valeur: compteursRestaurants.publies, couleur: "var(--succes)", href: "/system/catalogue/restaurants?statut=publies" },
                  { cle: "attente", libelle: "En attente de validation", valeur: compteursRestaurants.enAttente, couleur: "var(--orange)", href: "/system/catalogue/restaurants?statut=en_attente" },
                  { cle: "correction", libelle: "Correction demandée", valeur: compteursRestaurants.correction, couleur: "var(--secondaire)", href: "/system/catalogue/restaurants?statut=correction" },
                  { cle: "suspendus", libelle: "Suspendus", valeur: compteursRestaurants.suspendus, couleur: "var(--danger)", href: "/system/catalogue/restaurants?statut=suspendus" },
                ]}
              />
            </Panneau>
          ) : null}
        </div>
      ) : null}

      {/* 3. Graphiques de commandes */}
      {courant && pilotage ? (
        <div className="ad-pilotage-graphes" style={{ marginTop: "var(--space-4)" }}>
          <Panneau titre={`Commandes par jour, ${periode} derniers jours`}>
            {courant.total === 0 ? (
              <EtatVide icone="commandes" titre="Aucune commande sur cette période" texte="Les graphiques apparaissent dès la première commande." />
            ) : (
              <>
                <GraphiqueBarresJours jours={jours} identifiant="graphique-jours" />
                <Legende
                  elements={(["terminees", "enCours", "enAttente", "ecartees"] as const).map((categorie) => ({
                    cle: categorie,
                    libelle: LIBELLES_CATEGORIE[categorie],
                    valeur: courant[categorie],
                    couleur: COULEURS_CATEGORIE[categorie],
                  }))}
                />
                <details className="ad-donnees-graphique">
                  <summary>Voir les chiffres jour par jour</summary>
                  <div className="ad-defile">
                    <table>
                      <caption className="sr-only">Commandes par jour et par statut</caption>
                      <thead>
                        <tr>
                          <th scope="col">Jour</th>
                          <th scope="col">Terminées</th>
                          <th scope="col">En cours</th>
                          <th scope="col">En attente</th>
                          <th scope="col">Écartées</th>
                          <th scope="col">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jours.map((jour) => (
                          <tr key={jour.jour}>
                            <th scope="row">{jour.libelle}</th>
                            <td>{jour.terminees}</td>
                            <td>{jour.enCours}</td>
                            <td>{jour.enAttente}</td>
                            <td>{jour.ecartees}</td>
                            <td>
                              <strong>{jour.total}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </Panneau>

          <div className="ad-pile">
            <Panneau titre="Répartition par statut">
              <Anneau
                identifiant="graphique-repartition"
                centre="commandes"
                parts={(["terminees", "enCours", "enAttente", "ecartees"] as const).map((categorie) => ({
                  cle: categorie,
                  libelle: LIBELLES_CATEGORIE[categorie],
                  valeur: courant[categorie],
                  couleur: COULEURS_CATEGORIE[categorie],
                }))}
              />
              {courant.total > 0 ? (
                <Legende
                  elements={(["terminees", "enCours", "enAttente", "ecartees"] as const).map((categorie) => ({
                    cle: categorie,
                    libelle: LIBELLES_CATEGORIE[categorie],
                    valeur: `${Math.round((courant[categorie] / courant.total) * 100)} %`,
                    couleur: COULEURS_CATEGORIE[categorie],
                  }))}
                />
              ) : null}
            </Panneau>
            <Panneau titre="Heures de pointe">
              <GraphiqueHeures valeurs={heures} identifiant="graphique-heures" />
              <p className="ad-aide-champ" style={{ marginTop: 0 }}>
                Heure locale (la Guinée est à l&apos;heure UTC). Barre rouge : l&apos;heure la plus chargée.
              </p>
            </Panneau>
          </div>
        </div>
      ) : null}

      {/* 4. Tiroirs thématiques : le détail de chaque aspect de l'application */}
      <div className="ad-volets">
        {pilotage ? (
          <Volet
            titre="Commandes en détail"
            ouvert
            resume={`${stats.commandes.total} commande${stats.commandes.total > 1 ? "s" : ""} · panier moyen ${formaterGnf(stats.commandes.panierMoyen)}`}
          >
            <div className="ad-tuiles">
              <Tuile valeur={stats.commandes.restaurantsActifs} libelle="Restaurants actifs" definition={`Ont reçu au moins une commande sur ${periode} jours.`} />
              <Tuile valeur={formaterGnf(stats.commandes.panierMoyen)} libelle="Panier moyen" definition="Moyenne des commandes acceptées, prêtes ou terminées (hors frais de livraison)." />
              <Tuile valeur={stats.propositions.total} libelle="Propositions de prix" definition={`${stats.propositions.acceptees} acceptées, ${stats.propositions.refusees} refusées, ${stats.propositions.expirees} expirées, ${stats.propositions.enAttente} en attente.`} href="/system/commandes?statut=en_attente" ton={stats.propositions.enAttente > 0 ? "danger" : "neutre"} />
            </div>
            <div className="ad-pilotage-deux" style={{ marginTop: "var(--space-4)" }}>
              <div>
                <h3 className="ad-sous-titre">Livraison ou retrait</h3>
                <BarresHorizontales
                  lignes={[
                    { cle: "livraison", libelle: "Livraison", valeur: stats.commandes.livraison, couleur: "var(--rouge-fonce)" },
                    { cle: "retrait", libelle: "Retrait sur place", valeur: stats.commandes.retrait, couleur: "var(--secondaire)" },
                  ]}
                />
                <h3 className="ad-sous-titre">Quartiers les plus actifs</h3>
                {stats.quartiers.length === 0 ? (
                  <p className="ad-aide-champ">Pas encore de commande sur la période.</p>
                ) : (
                  <BarresHorizontales lignes={stats.quartiers.map((q) => ({ cle: q.nom, libelle: q.nom, valeur: q.nb, couleur: "var(--orange)" }))} />
                )}
              </div>
              <div>
                <h3 className="ad-sous-titre">Restaurants les plus commandés</h3>
                {stats.topRestaurants.length === 0 ? (
                  <p className="ad-aide-champ">Pas encore de commande sur la période.</p>
                ) : (
                  <BarresHorizontales lignes={stats.topRestaurants.map((r) => ({ cle: r.nom, libelle: r.nom, valeur: r.nb, couleur: "var(--succes)" }))} />
                )}
                <h3 className="ad-sous-titre">Plats les plus commandés</h3>
                {stats.topPlats.length === 0 ? (
                  <p className="ad-aide-champ">Pas encore de commande sur la période.</p>
                ) : (
                  <BarresHorizontales lignes={stats.topPlats.map((pl) => ({ cle: pl.nom, libelle: pl.nom, valeur: pl.nb, couleur: "var(--secondaire)" }))} />
                )}
              </div>
            </div>
          </Volet>
        ) : null}

        {peutVoirRestaurants ? (
          <Volet
            titre="Qualité des restaurants publiés"
            resume={`${stats.restaurants.ouverts} ouvert${stats.restaurants.ouverts > 1 ? "s" : ""} sur ${stats.restaurants.publies} publié${stats.restaurants.publies > 1 ? "s" : ""}`}
          >
            <BarresHorizontales
              lignes={[
                { cle: "ouverts", libelle: "Ouverts en ce moment", valeur: stats.restaurants.ouverts, couleur: "var(--succes)" },
                { cle: "commandes", libelle: "Acceptent les commandes", valeur: stats.restaurants.acceptentCommandes, couleur: "var(--succes)" },
                { cle: "logo", libelle: "Avec un logo", valeur: stats.restaurants.avecLogo, couleur: "var(--secondaire)" },
                { cle: "photo", libelle: "Avec une photo", valeur: stats.restaurants.avecPhoto, couleur: "var(--secondaire)" },
              ]}
            />
            <p className="ad-aide-champ">
              Sur {stats.restaurants.publies} restaurant{stats.restaurants.publies > 1 ? "s" : ""} publié{stats.restaurants.publies > 1 ? "s" : ""} ·{" "}
              {stats.restaurants.nouveaux} nouveau{stats.restaurants.nouveaux > 1 ? "x" : ""} sur {periode} jours.
            </p>
          </Volet>
        ) : null}

        {peutVoirRestaurants ? (
          <Volet titre="Menus et plats" resume={`${stats.catalogue.plats} plats · ${stats.catalogue.enPromo} en promotion`}>
            <div className="ad-tuiles">
              <Tuile valeur={stats.catalogue.plats} libelle="Plats au menu" definition="Plats non archivés, tous restaurants." />
              <Tuile valeur={`${pourcentage(stats.catalogue.disponibles, stats.catalogue.plats)} %`} libelle="Disponibles" definition={`${stats.catalogue.disponibles} plats que les clients peuvent commander.`} />
              <Tuile valeur={stats.catalogue.enPromo} libelle="En promotion" definition="Plats avec un prix promo." />
              <Tuile valeur={`${pourcentage(stats.catalogue.avecPhoto, stats.catalogue.plats)} %`} libelle="Avec une photo" definition="Les plats illustrés se vendent mieux." />
              <Tuile valeur={stats.catalogue.supplements} libelle="Suppléments proposés" definition="Options au choix du client (boissons, extras)." />
              <Tuile valeur={stats.catalogue.nouveaux} libelle={`Nouveaux sur ${periode} jours`} definition="Plats ajoutés par les restaurateurs." />
            </div>
          </Volet>
        ) : null}

        {roleAPermission(role, "compte.consulter") ? (
          <Volet titre="Clients" resume={`${stats.clients.comptes} compte${stats.clients.comptes > 1 ? "s" : ""}`}>
            <div className="ad-tuiles">
              <Tuile valeur={stats.clients.comptes} libelle="Comptes clients" definition="Clients inscrits (téléphone ou Facebook)." href="/system/acces/comptes" />
              <Tuile valeur={stats.clients.nouveaux} libelle={`Nouveaux sur ${periode} jours`} definition="Inscriptions de la période." />
              <Tuile valeur={`${pourcentage(stats.clients.avecCoordonnees, stats.clients.comptes)} %`} libelle="Coordonnées enregistrées" definition="Commande plus rapide : nom, téléphone et adresse déjà remplis." />
            </div>
          </Volet>
        ) : null}

        {peutVoirRestaurants ? (
          <Volet
            titre="Alertes de commande sur téléphone"
            resume={`${stats.alertes.abonnements} appareil${stats.alertes.abonnements > 1 ? "s" : ""} abonné${stats.alertes.abonnements > 1 ? "s" : ""}`}
          >
            <div className="ad-tuiles">
              <Tuile valeur={stats.alertes.abonnements} libelle="Appareils abonnés" definition="Téléphones et ordinateurs qui reçoivent les alertes." />
              <Tuile valeur={`${stats.alertes.restaurantsEquipes} / ${stats.restaurants.publies}`} libelle="Restaurants équipés" definition="Restaurants publiés avec au moins un appareil abonné." ton={stats.restaurants.publies > stats.alertes.restaurantsEquipes ? "danger" : "neutre"} />
              <Tuile valeur={stats.alertes.actifs7j} libelle="Alertes reçues sur 7 jours" definition="Appareils dont la dernière alerte a réussi cette semaine." />
              <Tuile valeur={stats.alertes.enEchec} libelle="Appareils en échec" definition="Alertes qui n'arrivent plus : l'abonnement est à refaire." ton={stats.alertes.enEchec > 0 ? "danger" : "neutre"} />
            </div>
          </Volet>
        ) : null}

        {roleAPermission(role, "contenu.editer") ? (
          <Volet
            titre="Contenus éditoriaux"
            resume={`${stats.contenus.pagesBrouillon + stats.contenus.bannieresBrouillon} brouillon(s) · ${stats.contenus.misesEnAvantActives} mise(s) en avant`}
          >
            <div className="ad-tuiles">
              <Tuile valeur={stats.contenus.pagesPubliees} libelle="Pages publiées" definition="Pages d'aide visibles publiquement." href="/system/contenu/pages?statut=publie" />
              <Tuile valeur={stats.contenus.pagesBrouillon} libelle="Pages en brouillon" definition="Créées mais pas encore publiées." href="/system/contenu/pages?statut=brouillon" ton={stats.contenus.pagesBrouillon > 0 ? "danger" : "neutre"} />
              <Tuile valeur={stats.contenus.bannieresPubliees} libelle="Bannières publiées" definition="Diffusées sur les écrans publics." href="/system/contenu/bannieres?statut=publie" />
              <Tuile valeur={stats.contenus.bannieresBrouillon} libelle="Bannières en brouillon" definition="Créées mais pas encore publiées." href="/system/contenu/bannieres?statut=brouillon" ton={stats.contenus.bannieresBrouillon > 0 ? "danger" : "neutre"} />
              <Tuile valeur={stats.contenus.misesEnAvantActives} libelle="Mises en avant actives" definition="Restaurants épinglés en tête du catalogue." href="/system/catalogue/mises-en-avant" />
            </div>
          </Volet>
        ) : null}

        {comptesSysteme ? (
          <Volet
            titre="Équipes"
            resume={`${stats.equipes.comptesSysteme} administrateur(s) · ${stats.equipes.membresRestaurants} membre(s) de restaurants`}
          >
            <div className="ad-tuiles">
              {comptesSysteme.map((compte) => (
                <Tuile
                  key={compte.role}
                  valeur={compte.valeur}
                  libelle={compte.libelle}
                  definition={`Comptes disposant du rôle « ${compte.libelle} ».`}
                  href="/system/acces/roles"
                />
              ))}
              <Tuile valeur={stats.equipes.membresRestaurants} libelle="Membres de restaurants" definition="Propriétaires et équipiers rattachés à un restaurant." href="/system/acces/comptes" />
            </div>
          </Volet>
        ) : null}

        {lignesTest.length > 0 ? (
          <Volet
            titre="Éléments de test à nettoyer"
            resume={`${lignesTest.length} restaurant${lignesTest.length > 1 ? "s" : ""} de test en attente`}
          >
            <p className="ad-aide-champ" style={{ marginTop: 0 }}>
              Ces restaurants portent un nom de test : ils sont écartés de la file « À traiter » pour ne pas la noyer. Vous pouvez
              les suspendre avec un motif, ou supprimer les comptes de test.
            </p>
            <ul className="ad-liste" style={{ margin: "0 calc(var(--space-4) * -1)" }}>
              {lignesTest.map((element) => (
                <li key={element.id}>
                  <Link href={`/system/catalogue/restaurants/${element.id}`} className="ad-liste-lien">
                    <span className="ad-liste-texte">
                      <span className="ad-liste-titre">{element.nom}</span>
                      <span className="ad-liste-meta">Créé {ancienneteLisible(new Date(element.creeLe), maintenant)}</span>
                    </span>
                    <span className="ad-liste-fin">
                      <Pastille ton="neutre">Test</Pastille>
                      <IconeAdmin nom="chevron" taille={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {roleAPermission(role, "compte.consulter") ? (
              <p style={{ margin: "var(--space-3) 0 0" }}>
                <Link href="/system/acces/comptes?type=test" className="lien-texte">
                  Voir les comptes de test
                </Link>
              </p>
            ) : null}
          </Volet>
        ) : null}

        {lignesActivite.length > 0 ? (
          <Volet titre="Activité récente" resume={`${lignesActivite.length} dernières actions`}>
            <ListeActivite evenements={lignesActivite} />
          </Volet>
        ) : null}

        <Volet titre="Ce que votre rôle permet" resume={`${permissions.length} permission${permissions.length > 1 ? "s" : ""}`}>
          <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
            {permissions.map((permission) => (
              <li key={permission} style={{ marginBottom: 4 }}>
                {LIBELLES_PERMISSIONS[permission]}
              </li>
            ))}
          </ul>
          <p className="ad-aide-champ">Version des droits d&apos;accès : {VERSION_MATRICE}.</p>
        </Volet>
      </div>
    </div>
  );
}
