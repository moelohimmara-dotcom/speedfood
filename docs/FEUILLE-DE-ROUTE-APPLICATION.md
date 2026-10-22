# Feuille de route de l'application Speedfood (établie le 22 octobre 2026)

Source : `AUDIT-PARCOURS-2026-10-22.md` (constats S1…X2), `NAVIGATION-PAR-ROLE.md` (règle des espaces), `CHECKLIST-APPLICATION-PRO.md` (inventaire des fonctions), `FEUILLE-DE-ROUTE-ADMIN.md` (parité de l'équipe).
Principe : **fiabilité avant fonctionnalités**, puis conversion client, puis outils pro, puis distribution. Chaque phase se termine par un audit dans l'émulateur avec le faux serveur et une publication vérifiée.

## Portes de qualité de chaque version (obligatoires)
1. `tsc`, `eslint`, tests unitaires, cloisonnement, tests natifs verts.
2. **Parcours joué dans l'émulateur** avec les comptes factices (client, resto, livreur, équipe, multi) : au minimum connexion, déconnexion, session révoquée, hors ligne.
3. Chaque nouvel état d'erreur a un message, une action (réessayer / se reconnecter) et un test.
4. Aucune perte silencieuse de données utilisateur (panier, commande, brouillon).
5. APK signée, empreinte vérifiée, production vérifiée, puis seulement `git push`.

## Phase A : fiabilité de la session et des rôles (2.20.0) : priorité absolue
Objectif : appliquer la machine d'états de l'audit. Corrige S1, S2, S3, S4, S5, S7, L1.
- Distinguer **accès refusé (401/403)** de **réseau coupé** dans toutes les API (`ErreurAcces` n'est plus une `ErreurReseau`) ; un service unique `SessionService.invalider(motif)` appelé par toutes les API : bandeau « Session expirée, reconnectez-vous », bouton direct, rien d'effacé.
- Relecture des droits (`/api/v1/moi`) à la reprise de l'application et toutes les 10 min en espace pro ; retour au Client avec message si un droit disparaît.
- Déconnexion : conserver les commandes en cours (et le suivi) ; effacer profil, adresses, favoris, jeton push ; option « effacer aussi les commandes de cet appareil » ; message visible après retour à l'accueil.
- Après connexion : un seul espace pro ⇒ ouverture directe (avec annulation) ; plusieurs ⇒ écran « Choisir mon espace » ; entrées « Mes espaces professionnels » en haut de Compte.
- Libellés (« Compte professionnel » pour un compte pro, majuscules), bouton livreur « En ligne / Hors ligne » selon l'état.
- Tests natifs + scénarios faux serveur (`__revoquer`).
**Critère d'acceptation :** session révoquée, droit retiré et déconnexion volontaire, jouées dans l'émulateur, donnent exactement les comportements du tableau d'états.

## Phase B : premier lancement et compte (2.21.0, livrée le 22 octobre 2026 sauf ce qui est noté « reporté »)
**Livré et vérifié dans l'émulateur :** visite guidée en 3 écrans ; invitation à activer les notifications sur le suivi d'une commande (le moment où elles servent : sans l'autorisation, Android 13+ ne montre aucune notification de commande aux clients, ce qui était un manque réel) ; suppression de compte dans l'application (`POST /api/v1/client/compte`, confirmation écrite « SUPPRIMER », refusée pour un compte professionnel) ; verrouillage optionnel des espaces pro par empreinte, visage ou code du téléphone (Paramètres → Sécurité ; ne bloque jamais sans verrouillage d'écran). **Reporté :** choix de la localité au premier lancement (un seul restaurant publié : le filtre n'aurait aucun effet, à faire quand il y aura plusieurs zones) ; code SMS (décision de coût de Malika) ; profil de référence de démarrage (outil de mesure à installer, à faire avec un vrai téléphone). Google : déjà dans l'application, il apparaît dès que l'interrupteur de `/system/parametres` est coché. Le fond crème dès la première image existe déjà (aucun éclair blanc) : le point O3 de l'audit se résume à la lenteur de l'émulateur.

Plan d'origine :
Corrige O1, O2, O3, S6, S8, S9.
- Visite guidée en 3 écrans (parcourir, commander et suivre, espaces professionnels), sautable ; choix de la **localité** avant la liste ; écrans « pourquoi on demande » juste avant la position et les notifications.
- Écran de démarrage système (Android 12+) et profil de référence (Baseline Profile) pour un démarrage rapide.
- Connexion en un geste : **Google** (activer l'interrupteur, déjà prêt), puis **code SMS** (décision de Malika : coût d'un fournisseur SMS) ; suivi d'une commande par téléphone + référence pour les invités.
- **Suppression de compte** dans l'application ; verrouillage biométrique/PIN optionnel des espaces pro.
**Critère :** un nouvel utilisateur commande en moins de 2 minutes sans mot de passe ; suppression de compte vérifiée de bout en bout en base.

## Phase C : découverte et commande (2.22.0 à 2.24.0)
**Lot C1 livré le 22 octobre 2026 (2.22.0) :** carnet d'adresses proposé dans la commande en livraison (puces, adresse par défaut préremplie), cœur « favori » sur la fiche restaurant (rempli selon le compte, connexion proposée sans compte). Vérifiés dans l'émulateur. **Constaté, pas fait :** la note au restaurant demande une colonne en base (la commande n'a pas ce champ côté serveur) ; le libellé « à confirmer » est la règle produit commune au site (à changer ensemble, décision de Malika) ; le stepper de quantité existe déjà dans le panier.

Corrige C1, C2, C3. Dépend du **contenu** (photos et menus réels : tâche de Malika/équipe).
- Accueil : sections « Ouverts maintenant », « Près de vous », « Les mieux notés », cuisines ; cartes avec photo, délai, frais, note ; libellé « Disponibilité à vérifier » à la place du jargon.
- Fiche restaurant : photos, sections, recherche dans le menu, **fiche plat** (options, quantité), cœur favori.
- Commande : adresses enregistrées, note au restaurant, détail des frais et délai estimé avant l'envoi, commande programmée, « commander à nouveau ».
- Suivi : frise d'étapes, notification qui ouvre le bon écran, appel du livreur/restaurant, carte.
- Paiement mobile (Chap Chap Pay : dépend du KYC de Malika, aujourd'hui à 0 %).

## Phase D : outils des professionnels (2.25.0 et suivantes)
- **Restaurateur** : historique et statistiques du jour/semaine, horaires, « pause » rapide, réglage du son, retrait du bouton en double, mode « poste fixe » (écran allumé, alerte continue).
- **Livreur** : onglets Courses · Gains · Compte, gains en direct, historique, assistance, rappel des documents.
- **Équipe** : tableau priorisé (file de tâches, pas seulement des chiffres), finances, restaurants/référencements, partenariats, avis, comptes, audit (voir `FEUILLE-DE-ROUTE-ADMIN.md`) ; statuts avec couleurs justes.
- Bande d'identité en haut des espaces pro (X1).

## Phase E : distribution et exploitation
- **Trois applications** (Speedfood, Speedfood Pro pour restaurateurs, Speedfood Livreur) construites sur le même module partagé `shared/` : trois modules `androidApp`, trois identités, trois dépôts Play. Évite le refus de Google Play lié aux autorisations sensibles et simplifie chaque parcours. La coque actuelle (`EspacePro.kt`) se déplace presque telle quelle.
- Dépôt sur **Google Play** (compte développeur payant : décision de Malika) : mises à jour silencieuses réelles, confiance, installation sans avertissement.
- Mesure : événements d'usage respectueux de la vie privée, tableau d'adoption, rapports de plantage (Crashlytics déjà en place), configuration à distance et déploiement progressif.
- Tenue en charge du site (limite CPU du Worker, plan gratuit) : à traiter avant toute campagne.

## Phase F : iPhone
Module `shared` déjà multiplateforme ; coque iOS à construire (compte Apple Developer payant).

## Décisions attendues de Malika
1. Fournisseur de **code SMS** (coût) pour la connexion par téléphone.
2. **Google Play** (compte payant) et séparation en trois applications : recommandé avant l'ouverture au public.
3. **Contenu** : photos et menus des restaurants référencés, reconfirmation des plats.
4. **Paiement mobile** : avancement du dossier Chap Chap Pay.
5. Comptes réels de test pour restaurateur/livreur/équipe si vous souhaitez un essai hors faux serveur (non nécessaire pour la phase A).
