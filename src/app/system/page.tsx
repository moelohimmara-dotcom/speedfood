import { Card } from "@/components/ui";
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
          href: "/system/restaurants?statut=en_attente",
          ton: compteursRestaurants.enAttente > 0 ? "danger" : "neutre",
        },
        {
          cle: "restaurants_publies",
          valeur: compteursRestaurants.publies,
          libelle: "Publiés",
          definition: "Visibles dans le catalogue public (publiés et non suspendus).",
          href: "/system/restaurants?statut=publies",
        },
        {
          cle: "restaurants_suspendus",
          valeur: compteursRestaurants.suspendus,
          libelle: "Suspendus",
          definition: "Suspension active : retirés du catalogue public jusqu'à réactivation.",
          href: "/system/restaurants?statut=suspendus",
        },
        {
          cle: "restaurants_correction",
          valeur: compteursRestaurants.correction,
          libelle: "Correction demandée",
          definition: "En attente d'une correction de la part du restaurateur (motif envoyé).",
          href: "/system/restaurants?statut=correction",
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
          href: "/system/contenus?statut=publie",
        },
        {
          cle: "pages_brouillon",
          valeur: compteursContenus.pagesBrouillon,
          libelle: "Pages en brouillon",
          definition: "Pages créées mais pas encore publiées.",
          href: "/system/contenus?statut=brouillon",
          ton: compteursContenus.pagesBrouillon > 0 ? "danger" : "neutre",
        },
        {
          cle: "bannieres_publiees",
          valeur: compteursContenus.bannieresPubliees,
          libelle: "Bannières publiées",
          definition: "Bannières actuellement diffusées sur les écrans publics.",
          href: "/system/contenus/bannieres?statut=publie",
        },
        {
          cle: "bannieres_brouillon",
          valeur: compteursContenus.bannieresBrouillon,
          libelle: "Bannières en brouillon",
          definition: "Bannières créées mais pas encore publiées.",
          href: "/system/contenus/bannieres?statut=brouillon",
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
        href: "/system/roles",
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
      href: `/system/restaurants/${restaurant.id}`,
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
      href: "/system/restaurants?statut=en_attente",
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
      href: "/system/contenus",
      libelle: "Créer une page",
      description: "Formulaire de création en haut de la liste des contenus.",
    });
  }
  if (roleAPermission(role, "contenu.mettre_en_avant")) {
    actionsRapides.push({
      href: "/system/mises-en-avant",
      libelle: "Gérer les mises en avant",
      description: "Sélection des restaurants mis en avant au catalogue public.",
    });
  }
  if (roleAPermission(role, "systeme.roles")) {
    actionsRapides.push({
      href: "/system/roles",
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

  return (
    <div>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-2)" }}>Centre de commandement</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Vous êtes connecté en tant que {LIBELLES_ROLES[role]}. Ce qui attend une décision
        d&apos;abord, puis les compteurs clés (chacun ouvre sa section filtrée), puis les
        dernières actions sensibles. Les zones hors permissions de votre rôle ne sont ni
        lues ni affichées.
      </p>

      {fichierOuvert ? <FilePrioritaire lignes={lignesFile} /> : null}

      {zones.map((zone) => (
        <ZoneIndicateurs key={zone.titre} zone={zone} />
      ))}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "var(--space-5)",
          marginBottom: "var(--space-6)",
        }}
      >
        {lignesActivite.length > 0 ? <ActiviteRecente evenements={lignesActivite} /> : null}
        <AccesRapides actions={actionsRapides} />
      </div>

      <Card>
        <h2 style={{ fontSize: "1.15rem", marginBottom: "var(--space-3)" }}>
          Ce que votre rôle permet
        </h2>
        <ul style={{ paddingLeft: "1.2rem", color: "var(--secondaire)", fontSize: "0.9rem" }}>
          {permissions.map((permission) => (
            <li key={permission} style={{ marginBottom: 4 }}>
              {LIBELLES_PERMISSIONS[permission]}
            </li>
          ))}
        </ul>
        <p style={{ marginTop: "var(--space-3)", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Matrice de permissions v{VERSION_MATRICE} — toute évolution est versionnée dans
          docs/MATRICE-PERMISSIONS.md et dans src/lib/system-admin/permissions.ts.
        </p>
      </Card>
    </div>
  );
}
