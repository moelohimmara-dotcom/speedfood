# Navigation de l'application par rôle (règle établie le 22 octobre 2026)

Trois publics, trois interfaces. Une personne ne voit que l'interface qui la concerne.

| Espace | Qui | Entrée | Navigation (barre du bas) |
|---|---|---|---|
| **Client** | tout le monde, sans compte pour parcourir | ouverture de l'application | Accueil · Commandes · Panier · Compte (barre claire) |
| **Restaurateur** | compte rattaché à un restaurant (`restaurant_memberships`) | Compte → « Mes espaces professionnels » (ou Espace professionnel après connexion) | Commandes · Menu · Compte (barre sombre) |
| **Livreur** | compte lié à une fiche `livreurs` | idem | Courses · Compte (barre sombre) |
| **Équipe Speedfood** | compte avec un rôle `system_admin_memberships` | idem | Tableau · Commandes · Livraisons · Compte (barre sombre) |

## Règles
1. **Le client est l'espace par défaut.** Aucun écran de choix de rôle au lancement ; l'application s'ouvre sur les restaurants, comme Uber Eats ou Glovo.
2. **Un client ordinaire ne voit jamais un espace professionnel** dans son Compte. Il a seulement un accès discret « Espace professionnel » qui explique comment rejoindre Speedfood (restaurateur : demande de référencement sur le site ; livreur : compte ouvert par l'équipe) et permet de se connecter.
3. **Les droits viennent du serveur** : `GET /api/v1/moi` renvoie `{restaurateur, livreur, equipe}` pour le compte du jeton. C'est une information d'affichage : chaque route d'un espace revérifie le droit (RLS, rôle système).
4. **Chaque espace pro a sa propre coque** (`EspacePro.kt`) : barre du bas sombre (jamais confondue avec celle du client), onglets propres, pas de flèche « retour » à la racine d'un onglet. On en sort par Compte → « Espace client ».
5. **L'espace pro utilisé en dernier est repris au lancement** (un restaurateur retrouve sa console). Si le droit a été retiré ou si la personne est déconnectée, retour au client.
6. Un compte qui cumule plusieurs rôles (ex. restaurateur et livreur) choisit son espace dans Compte et peut en changer à tout moment.

## Code
- `data/Espaces.kt` : `Espace`, `RolesCompte`, `EspaceService` (espace actif, droits).
- `EspacePro.kt` : coque et navigation des espaces pro. `App.kt` : coque client.
- `ui/EspacesScreens.kt` : « Espace professionnel » (entrée) et Compte pro.
- Serveur : `src/app/api/v1/moi/route.ts`.
- Tests : `EspacesTest` (natif).

## Reste à faire
- Vérifier chaque espace pro avec un vrai compte (restaurateur, livreur, équipe) sur l'émulateur ou un téléphone.
- Écrans de l'équipe encore ouverts sur le site (finances, partenaires, avis, comptes, contenu) : voir `FEUILLE-DE-ROUTE-ADMIN.md`.
