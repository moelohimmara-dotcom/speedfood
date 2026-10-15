# Audit des consoles (super admin et restaurateur), 15 octobre 2026

Préalable à une éventuelle refonte « proche de Wix » des deux consoles. **Lecture seule : aucun code n'a été modifié** pour produire cet audit.
Ce document est la synthèse ; le détail (tableaux, fichier:ligne) est dans les quatre rapports de ce dossier :

| Rapport | Contenu | Produit par |
|---|---|---|
| `inventaire-system.md` | Routes, navigation, rôles, composants, CSS de `/system` | Haiku 5.5 |
| `inventaire-restaurant.md` | Routes, navigation, couplages, CSS de `/restaurant` | Haiku 5.5 |
| `analyse-system.md` | Ergonomie, sécurité de l'interface, accessibilité, mobile de `/system` | Sonnet 5.5 |
| `analyse-restaurant.md` | Tâche centrale, ergonomie, onboarding, mobile de `/restaurant` | Sonnet 5.5 |
| `audit-visuel.md` | Relevés sur la production réelle (28 pages, 3 largeurs) et captures (`captures/`) | Session principale, navigateur intégré |
| `audit-editeur.md` | Éditeur de pages à blocs, monté en local avec un document fictif (aucune écriture en production) | Session principale |

La synthèse et les vérifications ci-dessous sont de la session principale (Sonnet 5.5). Aucun modèle Opus n'a été utilisé.

## 1. Ce que j'ai vérifié moi-même dans le code (donc fiable)

| # | Constat | Preuve |
|---|---|---|
| V1 | **`AlerteCommandes` est montée deux fois** dans la console restaurateur : `contenuLateral` (qui contient `liensBas`, donc l'alerte) est rendu dans l'`<aside>` ET dans le tiroir mobile. Deux sondages de 15 s, deux carillons, deux rafraîchissements. | `src/app/restaurant/(console)/layout.tsx` : `AlerteCommandes` dans `liensBas` (ligne 48), `contenuLateral` défini vers la ligne 87, rendu dans l'`<aside>` puis dans `<AdminMenuMobile>` (vers les lignes 101 et 108) |
| V2 | **Sur téléphone, l'état de l'alerte est invisible** (connexion perdue, son bloqué) : il vit dans l'`<aside>` masqué et dans un tiroir fermé. Le restaurateur croit être alerté et ne l'est plus. | Même fichier ; l'aside n'est visible qu'à partir de 1024 px (`admin.css`) |
| V3 | **Compteur faux** : la pastille « Commandes » et l'alerte comptent `statut = 'en_attente'`, alors qu'une commande avec proposition de prix active attend le **client**. Résultat : pastille allumée et carillon rejoué pour rien. | `layout.tsx:28` et `alertes/route.ts:36` ; la page filtre sur `etatDerive` |
| V4 | **« À traiter » est trié du plus récent au plus ancien** : la commande la plus en retard est en bas. | `src/lib/commande/requetes.ts:202` (`order cree_le desc`) |
| V5 | **« Revenir aux valeurs actuelles » rétablit tout le design public sans confirmation** s'il n'y a pas de modification locale. | `src/app/system/design/EditeurJetons.tsx:234-242` |
| V6 | **Texte mangue sur crème, environ 1,5:1** (illisible). | `src/app/system/design/design.css:57-60` |
| V7 | **Classes `btn-secondaire` / `btn-primaire` sans aucune règle CSS** (3 usages) : boutons au style brut. | `EditeurJetons.tsx:264,445`, `InterrupteurFonctionnalite.tsx:15` ; aucune règle dans `src/**/*.css` |

**Audit visuel (même jour, production réelle)** : voir `audit-visuel.md`. Trois défauts graves s'y ajoutent à V1 à V7 : la **Taxonomie** expose 304 quartiers techniques « Centre de … » avec un bouton Supprimer définitif (effaçant en cascade liste d'attente et zones de livraison, page de 31 000 px), le **rappel de double authentification** occupe 125 px sur téléphone (un quart de l'écran, sur chaque page), et des **boutons coupés** dans la Taxonomie sur téléphone.

**Éditeur de pages (même jour, essai en local)** : voir `audit-editeur.md`. Défaut grave commun à toute la console : **les boîtes de dialogue s'ouvrent en haut à gauche** de l'écran (`* { margin: 0 }` supprime leur centrage ; `margin: auto` manque dans `.ad-dialogue`). Côté éditeur : inutilisable à 768 px (aperçu coupé), aperçu « Bureau » en vignette illisible, icônes d'action des blocs à 32 px, erreurs de validation sans champ désigné ; points forts : retour d'information immédiat, annulation, garde de navigation avec « Rester » par défaut.

## 2. Ce que les analyses ajoutent (lu dans le code par les agents, non revérifié ligne à ligne)

**Super admin (`/system`)**
- 27 pages, 18 entrées de menu, 4 rôles (super_admin 18 entrées, operations 5, content_editor 8, support 2).
- **Sécurité de l'interface : le tableau de bord ne fuit pas de commandes, de comptes, de chiffre d'affaires ni de coordonnées** vers les rôles non autorisés (chaque bloc est gardé par permission). Réserves : `fn_statistiques_application` renvoie des **agrégats** de commandes aux 4 rôles si on l'appelle directement (aucune donnée personnelle) ; des chiffres du tableau de bord mènent à une **404** pour `support` et `content_editor` ; le journal d'audit, motifs compris, est lisible par les 4 rôles (choix produit à valider).
- **Actions muettes ou trompeuses** : erreur de modification perdue dans la taxonomie (`ListeTaxonomie.tsx:60-73`), bannières et mises en avant sans aucun retour (actions qui renvoient `void`), aucun `error.tsx` dans toute l'application.
- **Incohérences** : 5 façons de confirmer une action (8 `confirm()` natifs), `BarreEnregistrement` (bien conçue) utilisée par une seule page, pas de retour d'information type toast, `<h1>` « Catalogue / Contenu / Accès » répétés sur 6, 4 et 3 pages, menu latéral et onglets `SousNav` qui affichent les **mêmes entrées**.
- **Tableau de bord de 607 lignes** : la seule file actionnable (« À traiter ») arrive après une dizaine de cartes ; mêmes chiffres répétés 2 à 3 fois ; une requête en échec s'affiche comme des zéros.
- **Accessibilité** : anneau de focus mangue (environ 1,6:1), boutons de famille du menu d'environ 28 px de haut, motif d'onglets ARIA incomplet dans l'éditeur de design.
- **Mobile** : la plupart des listes sont utilisables (tableaux en cartes) ; la fiche restaurant place la décision tout en bas ; l'éditeur de design est difficile ; l'éditeur de pages à blocs n'a pas été lu.

**Restaurateur (`/restaurant`)**
- 10 pages, 4 entrées de navigation, barre basse sous 1024 px.
- **Parcours de commande : 4 gestes minimum** (notification, Accepter, Prête, Remise) sur un seul écran : bon. Défauts : le bloc paiement passe avant le bouton principal, aucune pagination (tout l'historique est chargé à chaque rafraîchissement), `window.confirm` natif, aucun `loading.tsx`/`error.tsx`, aucun traitement du réseau lent ou coupé, pas de maintien de l'écran allumé (la veille endort le carillon), pas de mode « service ».
- **Erreur silencieuse** : `PlatItem.tsx:51-54` ferme l'éditeur avant le résultat ; un échec d'enregistrement n'est jamais affiché. Les interrupteurs de disponibilité ignorent leur résultat.
- **Navigation** : « Ouvrir ma journée » et « Menu du jour » n'ont pas d'entrée directe alors que c'est la deuxième tâche quotidienne ; pas de page Équipe ni Paiement dédiée (le rôle de membre n'est jamais utilisé) ; liens secondaires cachés dans le tiroir.
- **Onboarding** : la checklist de démarrage est tout en bas de l'accueil et ne contient ni alertes, ni zones de livraison, ni commande de test.
- **Dette** : 96 styles en ligne, classes `cmd-*` réparties sur trois feuilles (dont `marche.css`, celle du parcours client), blocs et tiroir mobile partagés avec `/system`.

**Dette commune** : CSS 100 % global (27 feuilles, l'ordre décide), `.ad-app` partagé par les deux consoles, classes génériques (`.btn`, `.card`, `.field`) restylées sous `.ad-app`, 142 styles en ligne côté système, valeurs de retour des actions serveur hétérogènes (`{erreur}`, `{succes}`, `void`, exceptions).

## 3. À garder (déjà bon)

`PageHeader`/`Panneau`/`Volet`/`Pastille` (affichage pur), `BarreEnregistrement`, le modèle de permissions (`GROUPES_SYSTEME`, `exigerPermissionPage` en 404), les dialogues natifs avec erreur lisible, la révélation de coordonnées avec motif et journal, la file « À traiter », le tableau en cartes sur téléphone, le modèle de commande en un écran (action principale 56 px), la barre basse avec pastille, le rituel « Ouvrir ma journée » (le meilleur écran mobile du dépôt), `ListeDemarrage`.

## 4. Les huit mécanismes « Wix » : où on en est, et lesquels valent le coup

| Mécanisme | Super admin | Restaurateur | Effort |
|---|---|---|---|
| Menu à deux niveaux repliable | Existe (accordéon) ; manque rail d'icônes, mémoire de l'état, badges ; **supprimer le doublon avec `SousNav`** | Regrouper les sous-pages dans un hub « Mon restaurant » ; pas de rail | M |
| Recherche globale (Ctrl+K) | Utile (palette de destinations d'abord, entités ensuite) | **Non en V1** (20 commandes par jour) ; recherche dans Commandes seulement | M à L / S |
| Accueil « prochaines étapes » | Manque ; la file « À traiter » en est le cœur | **Très pertinent** pour un restaurant neuf : en tête de l'accueil | M / S |
| Tiroirs latéraux d'édition | Manque (modales centrées seulement) | Feuille plein écran sur téléphone, pas de tiroir latéral | L / M |
| Listes puissantes | Filtres par puces existent ; manquent tri, pagination, actions groupées génériques | Filtres rapides et tri par ancienneté ; **pas** de colonnes configurables | L / S |
| États vides utiles | Existent ; manque l'action et la distinction « vide » / « aucun résultat » | Déjà bons | S |
| Barre d'enregistrement unique | Composant bon mais sous-employé | Surtout pour le profil (4 enregistrements séparés) | M |
| Aide contextuelle et fil d'Ariane | Fil d'Ariane facile (S) ; aide M | Aide légère (lien WhatsApp constant) | S à M |

## 5. Architecture proposée (par tâches, pas par tables)

**Super admin** : Accueil (À traiter, prochaines étapes, 4 chiffres) · Restaurants · Commandes · Catalogue (menu, taxonomie, mises en avant) · **Zones** (Géographie, Couverture, Liste d'attente) · Site et contenu (Pages, Bannières, Médias, Textes, Design) · Accès (Comptes, Rôles, Habilitations) · Réglages (Paramètres, Mises à jour, Réinitialisation) · Journal. Fil d'Ariane partout, palette Ctrl+K, aucun onglet redondant.

**Restaurateur (mobile d'abord)** : barre basse **Commandes** (accueil de service) · **Menu** · **Aujourd'hui** (ouverture, menu du jour) · **Mon restaurant** (hub : profil, paiement, zones, documents, tables et affiche, équipe, compte). Checklist en tête tant que le restaurant n'est pas publié. Mode « service » plein écran à décider.

## 6. Plan en phases

| Phase | Contenu | Estimation (indicative) |
|---|---|---|
| **0. Correctifs de fiabilité, avant toute refonte** | V1 à V7 ; erreurs silencieuses (PlatItem, taxonomie, bannières) ; `error.tsx` et `loading.tsx` ; liens morts 404 ; contrastes ; pagination des commandes | quelques jours |
| 1. Fondations | Conteneur CSS neuf (pas `.ad-app`), convention commune de retour des actions, composants `Confirmation`, `Toast`, `Tiroir`, `ListeDonnees`, barre d'enregistrement généralisée, fil d'Ariane | 1 à 2 semaines |
| 2. Coque super admin | Menu à deux niveaux, rail, palette Ctrl+K, accueil ; pages pilotes (Géographie, Restaurants) | 1 à 2 semaines |
| 3. Migration des sections | Une section à la fois, ancienne et nouvelle console coexistent | plusieurs semaines |
| 4. Restaurateur | Mode service, hub, checklist, feuille de confirmation, hors-ligne minimal | 2 à 3 semaines |
| 5. Finitions | Accessibilité, tests de bout en bout de la tâche centrale, nettoyage du CSS | 1 semaine |

Ces durées sont des ordres de grandeur, pas des engagements : elles dépendent des décisions ci-dessous.

## 6 bis. Phase 0 : état d'avancement (15 octobre 2026, en local, non déployée)

| Constat | État |
|---|---|
| V1 alerte montée deux fois, état invisible sur téléphone | **Corrigé** : une seule instance, en tête du contenu (`layout.tsx`) |
| V3 compteur faux (commandes qui attendent le client) | **Corrigé** : règle unique `lireCommandesATraiter` (pastille et alerte), testée |
| V4 tri inversé de « À traiter » | **Corrigé** : la plus ancienne en premier |
| V5 bouton de design trompeur | **Corrigé** : libellé selon l'effet, confirmation avant de rétablir le site public |
| V6 contraste du texte mangue sur crème | **Corrigé** (texte en encre) |
| V7 classes `btn-secondaire` / `btn-primaire` | **Corrigé** |
| Erreur perdue à l'édition d'un plat (restaurateur) et d'un élément de taxonomie | **Corrigé** : l'éditeur ne se ferme qu'après un succès |
| Bannières et mises en avant sans retour d'information, exceptions non rattrapées | **Corrigé** : retour `{ erreur }` affiché |
| Liens du tableau de bord qui menaient à une 404 selon le rôle | **Corrigé** |
| `error.tsx` (système et restaurateur), `loading.tsx` (restaurateur) | **Ajoutés** |
| VIS-1 Taxonomie : quartiers techniques supprimables | **Corrigé** : masqués, modification et suppression refusées côté serveur, suppression refusée tant que la liste d'attente ou des zones en dépendent |
| VIS-2 rappel 2FA de 125 px sur téléphone | **Corrigé** : 63 px (mesuré en local) |
| VIS-3 boutons coupés (Taxonomie) | **Corrigé** (retour à la ligne) |
| ED-1 boîtes de dialogue décentrées | **Corrigé** (`margin: auto`, centrage mesuré en local) |
| Cibles tactiles (liens de cartes, case de sélection, onglets du design, bouton de famille du menu) | **Corrigé** en grande partie ; menu latéral de bureau volontairement compact (souris) |
| Anneau de focus mangue | **Corrigé** (rouge foncé) |
| Pagination des commandes (historique entier chargé à chaque rafraîchissement) | **Non fait** : refonte de la requête et des chiffres de l'accueil |
| VIS-4 région et préfecture de Conakry en double (Géographie) | **Non fait** |
| ED-2 à ED-5 (éditeur de pages) | **Non fait** : phase de refonte |
| Mode service, maintien de l'écran allumé, hors ligne | **Non fait** : phase restaurateur |

**Vérifié** : types, lint, 1628 contrôles (dont 8 sur la règle « à traiter »), build et `cf:build` ; centrage des boîtes et hauteur du rappel 2FA mesurés en local.
**Non vérifié à l'écran** : les écrans connectés (restaurateur, Taxonomie) n'ont pas été vus après correction, faute de session locale ; à contrôler après déploiement.

## 7. Décisions à prendre avant de coder

1. **Identité de la console** : sobre (outil de travail, recommandé) ou colorée comme le site public.
2. **Phase 0 d'abord ?** Je recommande de corriger V1 à V7 maintenant, indépendamment de la refonte : ce sont des défauts de fiabilité réels, surtout l'alerte de commandes.
3. **Restaurateur : périmètre** : mode service plein écran, maintien de l'écran allumé, comportement hors ligne.
4. **Équipe et rôles côté restaurant** : à cadrer côté produit (aujourd'hui une seule appartenance par compte).
5. **Page Paiement dédiée** pour le restaurateur.
6. **Audit visible par tous les rôles** : le conserver ou le restreindre ?
7. **Recherche globale** : navigation seulement, ou aussi les entités (commandes, comptes : prudence sur les coordonnées clients) ?

## 8. Limites de cet audit

- **Aucun rendu réel** : tout le visuel est déduit du code ; les points « à confirmer visuellement » le sont. Aucune session connectée n'était disponible.
- **Non lus** : l'éditeur de pages à blocs (`src/components/studio/editeur/*`) et les tests existants de la console.
- Les constats des agents non listés en section 1 n'ont pas été revérifiés ligne à ligne ; les rapports citent fichier:ligne pour permettre de le faire.
- Les estimations d'effort sont indicatives.
