import { PageHeader } from "@/components/admin/blocs";
import { obtenirContexteSysteme } from "@/lib/system-admin/contexte";
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
  obtenirCompteursCommandes,
  obtenirCompteursContenus,
  obtenirCompteursRestaurants,
} from "@/lib/system-admin/tableauDeBord";
import { ZoneIndicateurs, type ZoneAffichee } from "./ZoneIndicateurs";
import { FilePrioritaire, type LigneFilePriorite } from "./FilePrioritaire";
import { ActiviteRecente, type LigneActivite } from "./ActiviteRecente";
import { AccesRapides, type ActionRapide } from "./AccesRapides";
import { formaterDateCourte, formaterEcheance } from "./formatage";

export const metadata = { title: "Tableau de bord" };

/**
 * Centre de commandement `/system` : tableau de bord opérationnel, plus une
 * simple liste de liens. Trois zones, dans l'ordre du travail réel :
 * 1. « À traiter en priorité » — ce qui attend une décision humaine, avec lien
 *    direct vers l'écran d'action ;
 * 2. les indicateurs clés, tous cliquables vers la section déjà filtrée ;
 * 3. activité récente + accès rapides.
 *
 * Chaque zone n'est ni lue ni affichée si le rôle courant n'en a pas la
 * permission (`roleAPermission`) ; les lectures ciblées sont lancées en
 * parallèle (aucun waterfall) et chaque helper re-vérifie sa permission.
 */
export default async function AccueilCmsSystemePage() {
  const contexte = await obtenirContexteSysteme();
  const role = contexte.role;
  const permissions = permissionsDuRole(role);

  const [
    compteursRestaurants,
    compteursCommandes,
    compteursContenus,
    comptesSysteme,
    restaurantsEnAttente,
    propositionsEnAttente,
    activite,
  ] = await Promise.all([
    roleAPermission(role, "restaurant.moderer") ? obtenirCompteursRestaurants() : null,
    roleAPermission(role, "commande.consulter") ? obtenirCompteursCommandes() : null,
    roleAPermission(role, "contenu.editer") ? obtenirCompteursContenus() : null,
    roleAPermission(role, "systeme.roles") ? obtenirComptesSystemeParRole() : null,
    roleAPermission(role, "restaurant.moderer") ? listerRestaurantsEnAttenteValidation() : null,
    roleAPermission(role, "commande.consulter") ? listerPropositionsEnAttente() : null,
    roleAPermission(role, "systeme.audit") ? obtenirActiviteRecente() : null,
  ]);

  // --- Zones d'indicateurs (une par domaine, chacune filtrée par permission) ---
  const zones: ZoneAffichee[] = [];

  if (compteursRestaurants) {
    zones.push({
      titre: "Restaurants",
      compteurs: [
        {
          cle: "restaurants_en_attente",
          valeur: compteursRestaurants.enAttente,
          libelle: "En attente de validation",
          definition:
            "Créés mais jamais examinés : ni publiés, ni suspendus, ni en attente d'une correction.",
          href: "/system/catalogue/restaurants?statut=en_attente",
          ton: compteursRestaurants.enAttente > 0 ? "danger" : "neutre",
        },
        {
          cle: "restaurants_publies",
          valeur: compteursRestaurants.publies,
          libelle: "Publiés",
          definition: "Visibles dans le catalogue public (publiés et non suspendus).",
          href: "/system/catalogue/restaurants?statut=publies",
        },
        {
          cle: "restaurants_suspendus",
          valeur: compteursRestaurants.suspendus,
          libelle: "Suspendus",
          definition: "Suspension active : retirés du catalogue public jusqu'à réactivation.",
          href: "/system/catalogue/restaurants?statut=suspendus",
        },
        {
          cle: "restaurants_correction",
          valeur: compteursRestaurants.correction,
          libelle: "Correction demandée",
          definition: "En attente d'une correction de la part du restaurateur (motif envoyé).",
          href: "/system/catalogue/restaurants?statut=correction",
          ton: compteursRestaurants.correction > 0 ? "danger" : "neutre",
        },
      ],
    });
  }

  if (compteursCommandes) {
    zones.push({
      titre: "Commandes & support",
      compteurs: [
        {
          cle: "commandes_actives_du_jour",
          valeur: compteursCommandes.activesDuJour,
          libelle: "Actives du jour",
          definition:
            "Créées depuis minuit (UTC) et encore actives : en attente, acceptée ou prête.",
          href: "/system/commandes?jour=1",
        },
        {
          cle: "commandes_en_attente",
          valeur: compteursCommandes.enAttente,
          libelle: "En attente de confirmation",
          definition:
            "Commandes attendant la décision d'un restaurant, toutes dates et tous restaurants.",
          href: "/system/commandes?statut=en_attente",
        },
        {
          cle: "propositions_en_attente",
          valeur: compteursCommandes.propositionsEnAttente,
          libelle: "Propositions client en attente",
          definition:
            "Révisions de prix envoyées au client et toujours sans réponse (hors propositions expirées).",
          href: "/system/commandes?statut=en_attente",
          ton: compteursCommandes.propositionsEnAttente > 0 ? "danger" : "neutre",
        },
      ],
    });
  }

  if (compteursContenus) {
    zones.push({
      titre: "Contenus éditoriaux",
      compteurs: [
        {
          cle: "pages_publiees",
          valeur: compteursContenus.pagesPubliees,
          libelle: "Pages publiées",
          definition: "Pages d'aide/FAQ actuellement visibles publiquement.",
          href: "/system/contenu/pages?statut=publie",
        },
        {
          cle: "pages_brouillon",
          valeur: compteursContenus.pagesBrouillon,
          libelle: "Pages en brouillon",
          definition: "Pages créées mais pas encore publiées.",
          href: "/system/contenu/pages?statut=brouillon",
          ton: compteursContenus.pagesBrouillon > 0 ? "danger" : "neutre",
        },
        {
          cle: "bannieres_publiees",
          valeur: compteursContenus.bannieresPubliees,
          libelle: "Bannières publiées",
          definition: "Bannières actuellement diffusées sur les écrans publics.",
          href: "/system/contenu/bannieres?statut=publie",
        },
        {
          cle: "bannieres_brouillon",
          valeur: compteursContenus.bannieresBrouillon,
          libelle: "Bannières en brouillon",
          definition: "Bannières créées mais pas encore publiées.",
          href: "/system/contenu/bannieres?statut=brouillon",
          ton: compteursContenus.bannieresBrouillon > 0 ? "danger" : "neutre",
        },
      ],
    });
  }

  if (comptesSysteme) {
    zones.push({
      titre: "Comptes système",
      compteurs: comptesSysteme.map((compte) => ({
        cle: `comptes_${compte.role}`,
        valeur: compte.valeur,
        libelle: compte.libelle,
        definition: `Comptes disposant du rôle système « ${compte.libelle} » (matrice v${VERSION_MATRICE}).`,
        href: "/system/acces/roles",
      })),
    });
  }

  // --- File « à traiter en priorité » ---
  // Les propositions portent une échéance, les validations de restaurant non :
  // les propositions passent en tête.
  const lignesFile: LigneFilePriorite[] = [];
  for (const proposition of propositionsEnAttente ?? []) {
    lignesFile.push({
      href: `/system/commandes/${proposition.commandeId}`,
      titre: `Proposition client — commande ${proposition.reference || proposition.commandeId}`,
      meta: `${formaterEcheance(proposition.expireLe)} · nouveau total ${proposition.nouveauSousTotal.toLocaleString("fr-FR")} GNF`,
      badge: "Réponse client",
      ton: "danger",
    });
  }
  for (const restaurant of restaurantsEnAttente ?? []) {
    lignesFile.push({
      href: `/system/catalogue/restaurants/${restaurant.id}`,
      titre: restaurant.nom,
      meta: `Demande de mise en ligne créée le ${formaterDateCourte(restaurant.creeLe)}`,
      badge: "À valider",
      ton: "danger",
    });
  }
  const fichierOuvert =
    roleAPermission(role, "restaurant.moderer") || roleAPermission(role, "commande.consulter");

  // --- Activité récente ---
  const lignesActivite: LigneActivite[] = (activite ?? []).map((evenement) => ({
    id: evenement.id,
    action: evenement.action,
    cibleType: evenement.cibleType,
    cibleId: evenement.cibleId,
    acteurEmail: evenement.acteurEmail,
    horodatage: evenement.horodatage,
  }));

  // --- Accès rapides ---
  const actionsRapides: ActionRapide[] = [];
  if (roleAPermission(role, "restaurant.moderer")) {
    actionsRapides.push({
      href: "/system/catalogue/restaurants?statut=en_attente",
      libelle: "Valider un restaurant",
      description: "Ouvrir la file des demandes en attente de validation.",
    });
  }
  if (roleAPermission(role, "commande.consulter")) {
    actionsRapides.push({
      href: "/system/commandes?jour=1",
      libelle: "Voir les commandes du jour",
      description: "Commandes créées aujourd'hui, tous statuts confondus.",
    });
    actionsRapides.push({
      href: "/system/commandes?statut=en_attente",
      libelle: "Commandes en attente",
      description: "Commandes attendant une décision, coordonnées masquées.",
    });
  }
  if (roleAPermission(role, "contenu.editer")) {
    actionsRapides.push({
      href: "/system/contenu/pages",
      libelle: "Créer une page",
      description: "Formulaire de création en haut de la liste des contenus.",
    });
  }
  if (roleAPermission(role, "contenu.mettre_en_avant")) {
    actionsRapides.push({
      href: "/system/catalogue/mises-en-avant",
      libelle: "Gérer les mises en avant",
      description: "Sélection des restaurants mis en avant au catalogue public.",
    });
  }
  if (roleAPermission(role, "systeme.roles")) {
    actionsRapides.push({
      href: "/system/acces/roles",
      libelle: "Gérer les rôles système",
      description: "Attribuer ou retirer un rôle système — réservé à super_admin.",
    });
  }
  if (roleAPermission(role, "systeme.audit")) {
    actionsRapides.push({
      href: "/system/audit",
      libelle: "Consulter le journal d'audit",
      description: "Historique complet et filtrable des actions sensibles.",
    });
  }

  const dateDuJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div>
      <PageHeader
        titre="Tableau de bord"
        description={`${LIBELLES_ROLES[role]} · ${dateDuJour}. Ce qui attend une décision d'abord, puis les chiffres clés.`}
      />

      <div className="ad-grille-deux" style={{ marginTop: 0 }}>
        {fichierOuvert ? <FilePrioritaire lignes={lignesFile} /> : null}
        {actionsRapides.length > 0 ? <AccesRapides actions={actionsRapides} /> : null}
      </div>

      {zones.map((zone) => (
        <ZoneIndicateurs key={zone.titre} zone={zone} />
      ))}

      {lignesActivite.length > 0 ? (
        <div style={{ marginTop: "var(--space-6)" }}>
          <ActiviteRecente evenements={lignesActivite} />
        </div>
      ) : null}

      <div className="ad-pied" style={{ borderTop: 0, marginTop: "var(--space-6)", paddingTop: 0 }}>
        <details>
          <summary>Ce que votre rôle permet</summary>
          <ul style={{ paddingLeft: "1.2rem", margin: "0 0 var(--space-2)" }}>
            {permissions.map((permission) => (
              <li key={permission} style={{ marginBottom: 4 }}>
                {LIBELLES_PERMISSIONS[permission]}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
