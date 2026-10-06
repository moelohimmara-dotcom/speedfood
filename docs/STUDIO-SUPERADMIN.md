# Studio Speedfood : refonte de la console super admin en CMS visuel

Statut : **décisions de Malika du 6 octobre 2026, architecture à valider avant tout code**. Aucune ligne de ce document n'est encore livrée,
sauf la page « Mises à jour » (interrupteurs de fonctionnalités, `docs/STATUT-PROJET.md`).

## 0. Décisions prises

| # | Sujet | Décision de Malika |
|---|---|---|
| 1 | Périmètre | Élargi : la console peut contrôler **toute l'application**, pas seulement les pages marketing. Cela **remplace** la phrase du bloc 8 du plan d'exécution (« pas un constructeur de site généraliste »). À reporter dans la copie source de `docs/cadrage/` (Malika). |
| 2 | Liberté d'édition | **Mixte** : blocs guidés par défaut ; mode libre (placement et réglages fins) disponible, sous garde-fous. |
| 3 | Couleurs | **Modifiables à volonté** : palettes assorties proposées d'abord, puis sélecteur de couleur libre. Les jetons de `DESIGN-SYSTEM.md` ne sont plus verrouillés : ils deviennent le thème par défaut. |
| 4 | Langues | **Contenu en français uniquement.** Un paquet de traduction permet de basculer en **anglais** le site public et l'espace des restaurateurs. La console super admin reste en français. |
| 5 | Habilitations | **Système par paliers, sur le modèle de Meta Business** (voir §5). |
| 6 | Cache | **Cloudflare gratuit** (ou alternative gratuite). Voir §6. |

## 1. Constat de départ (6 octobre 2026)

- Pages et bannières éditables en console (`content_pages`, `content_banners`) mais **lues par aucune page publique** : le CMS actuel est déconnecté.
- Textes et mises en page publics écrits en dur dans le code ; design dans ~20 fichiers CSS (~11 000 lignes) bâtis sur les jetons de `globals.css`.
- Plus aucune page du site n'est statique (rendu à chaque requête) ; le cache de revalidation OpenNext est en lecture seule (`staticAssetsIncrementalCache`).
- Bundle serveur Cloudflare : ~1,7 Mo compressé aujourd'hui (limite du plan gratuit : à confirmer auprès de Cloudflare avant le palier 2).

## 2. Les cinq couches

```
 5  Gouvernance   brouillon · aperçu · publication · planification · versions · audit · habilitations par paliers
 4  Comportement  interrupteurs · paramètres métier · règles de commande                      (commencé)
 3  Design        thèmes · palettes · sélecteur de couleur · typographie · formes · mouvement
 2  Mise en page  pages composées de blocs enregistrés (guidé) + mode libre
 1  Contenu       chaque texte, image, illustration = emplacement nommé (valeur par défaut dans le code)
```

Règle de sécurité commune : une page est un **document structuré (JSON) validé par schéma (zod)**, jamais du HTML libre. Le site n'affiche que des
**blocs enregistrés** ; toute valeur est assainie ; toute publication est tracée (qui, quoi, quand, version).

## 3. Éditeur visuel

Choix proposé : **Puck** (MIT, auto-hébergé, JSON dans notre base, nos composants comme blocs). L'éditeur est du JavaScript **navigateur**
(servi comme fichiers statiques, hors du Worker) ; seul un rendu léger (`Render`) tourne côté serveur. À valider par un essai avant le palier 2 :
compatibilité avec notre politique de sécurité des scripts (CSP) et poids du Worker.

Mode **mixte** : blocs guidés (réglages bornés par la charte, impossible de casser l'accessibilité) + « mode libre » par bloc (espacements,
alignements, ordre, visibilité par taille d'écran) ; l'accessibilité reste vérifiée à la publication (contraste, texte alternatif, ordre de lecture).

## 4. Studio de design (couleurs)

1. **Palettes assorties** : une bibliothèque de palettes complètes (marque, fonds, textes, succès/danger) ; un clic applique tout le jeu.
2. **Sélecteur libre** : n'importe quelle couleur, par jeton.
3. **Garde-fous non bloquants au brouillon, bloquants à la publication** : contraste AA vérifié automatiquement pour chaque couple texte/fond ; en cas d'échec, la
   publication est refusée avec la couleur corrigée suggérée (Malika garde la main : l'avertissement peut être levé par un palier supérieur, tracé).
4. Un thème publié devient des variables CSS injectées dans `<head>` ; thèmes versionnés, aperçu mobile et bureau, retour arrière en un clic.

## 5. Habilitations par paliers (modèle Meta Business)

Principes repris de Meta : séparer **qui** (personne), **sur quoi** (actif), **à quel niveau** (palier), avec **contrôle total** ou **accès partiel**,
sécurité renforcée aux paliers élevés, demandes d'accès et accès temporaires.

- **Actifs** : chaque page, le thème, les médias, la navigation, les traductions, les interrupteurs, les paramètres, les restaurants, les commandes, les comptes, l'audit.
- **Paliers** : 0 Observateur · 1 Contributeur (brouillons) · 2 Éditeur (publie sur son périmètre) · 3 Responsable (planifie, thème, périmètre) · 4 Administrateur (gère les accès) · 5 Propriétaire (seule à créer des administrateurs, régler la sécurité, supprimer).
- **Attribution** : personne × actif × palier, ou « contrôle total » d'un groupe d'actifs.
- **Sécurité par palier** : double authentification obligatoire dès le palier 3 ; validation à deux personnes (optionnelle) pour thème et pages d'accueil ; accès **temporaires** avec expiration ; **demande d'accès** approuvée par un palier supérieur ; journal complet.
- **Migration** : les rôles actuels (`super_admin`, `operations`, `content_editor`, `support`) deviennent des préréglages de la matrice ; les chaînes de permission existantes sont conservées.

## 6. Cache gratuit

Constat : KV gratuit = 100 000 lectures et 1 000 écritures par jour ; R2 et D1 ont aussi un palier gratuit, mais R2 demande l'activation d'une ressource (accord requis).

Proposition **sans ressource à créer** :

1. **Cache API de Cloudflare** (gratuit, sans quota) : le JSON des pages publiées est gardé 60 s par centre de données ; `stale-while-revalidate`.
2. Publication : effet immédiat sur le centre local, au plus ~60 s ailleurs.
3. **Option instantanée (gratuite aussi)** : un seul petit compteur de version dans KV (écrit seulement à la publication, ≪ 1 000/jour) ; lecture gardée en mémoire 30 s. Si le quota de lecture est atteint : repli sur le cache 60 s, jamais de panne.

## 7. Traduction anglaise

- Paquet proposé : **next-intl**, **sans préfixe d'URL** (la langue se choisit par un sélecteur et un cookie ; les adresses ne changent pas, donc rien ne casse : liens courts, QR, partages).
- Périmètre : site public et espace restaurateur ; **pas** la console super admin.
- Conséquence à décider : les contenus édités dans le Studio sont **en français uniquement** ; en mode anglais, l'habillage (menus, boutons, formulaires, erreurs) est traduit, les blocs de contenu restent en français. Un champ « version anglaise » optionnel par bloc pourra être ajouté plus tard sans refonte.
- Volume : extraction de plusieurs centaines à environ deux mille chaînes (écrans, messages d'erreur, validations). Traduction initiale rédigée par moi, **à relire par une personne bilingue** avant mise en ligne.

## 8. Paliers de livraison (chacun déployable seul, retour arrière possible)

| Palier | Contenu | Prérequis |
|---|---|---|
| **0** | Reconnecter l'existant : pages et bannières publiées lues par le site, brouillon, aperçu | aucun |
| **1** | Emplacements de contenu (tous les textes éditables) + cache Cloudflare gratuit | 0 |
| **2** | Habilitations par paliers (fondation : les droits précèdent les outils puissants) | 1 |
| **3** | Éditeur de pages par blocs (accueil d'abord) en mode mixte | 2 |
| **4** | Studio de design : palettes, sélecteur, garde-fous, thèmes versionnés | 2 |
| **5** | Traduction anglaise (site public puis espace restaurateur) | 1 |
| **6** | Médiathèque, navigation, SEO, planification de publications | 3 |

Ordre : le palier 2 vient **avant** les outils puissants, pour qu'aucun éditeur visuel ne soit livré sans ses garde-fous de droits.

**Palier 3, état au 6 octobre 2026 (branche `feat/studio-blocs`, non déployé)** : essai Puck concluant (tâche 5) ; modèle de données et
rendu public des pages à blocs livrés (tâche 6) : `content_pages.format = 'blocs'`, brouillon et version publiée séparés, historique des
20 dernières publications (`content_pages_versions`), publication atomique (`fn_publier_blocs`), document validé par schéma à
l'écriture et à la lecture (`src/lib/studio/registre.ts` : Titre, Paragraphe, Bouton, Séparateur, Espace), rendu serveur maison sans
Puck (`src/components/studio/RenduPage.tsx`), brouillon illisible par l'API publique (droits de colonne). Enregistrer le brouillon d'une
page hors ligne : palier 1 ; publier, restaurer une version, modifier le brouillon d'une page en ligne : palier 2 (garanti aussi en base).
Reste : éditeur dans la console (tâche 7), bibliothèque de blocs et mode mixte (8), accueil en blocs (9).

## 9. Risques

| Risque | Parade |
|---|---|
| Poids du Worker (limite du plan gratuit) | éditeur côté navigateur uniquement ; mesure à chaque palier |
| Politique de sécurité des scripts (CSP) | essai Puck avant engagement ; repli sur formulaires + aperçu en direct |
| Site « cassé » par une couleur ou une mise en page | garde-fous, brouillon, aperçu, versions, retour arrière |
| Lenteur (tout vient de la base) | cache §6 ; objectif de première réponse < 0,8 s en production |
| Extraction de la traduction (volume) | par écran, derrière un sélecteur ; français reste la valeur par défaut |
| Dérive du périmètre | un palier à la fois, validé en production avant le suivant |
