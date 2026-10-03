# Parcours utilisateur — Speedfood

Version de travail pour cadrer l’expérience avant l’implémentation. Ces parcours sont des spécifications, pas des fonctions déjà livrées. Le prototype actuel ne couvre qu’une simulation locale du parcours client et un petit aperçu de tableau restaurant. Il n’a ni PWA, ni comptes, ni serveur partagé, ni CMS.

## A. Client : découvrir et commander

### Parcours normal

1. **Arriver sur Speedfood.** Le client ouvre un lien, un QR code ou une page partagée. Il peut commencer à naviguer sans créer de compte ni installer la PWA.
2. **Trouver une adresse.** Il recherche un plat ou un nom, puis réduit la liste par catégorie ou quartier. L’état « aucun résultat » propose d’effacer les filtres.
3. **Comparer.** Une carte indique nom, catégorie, zone, horaires/état d’ouverture, délai indicatif, note seulement si celle-ci provient de vrais avis, et plat vedette. Les données fictives de prototype ne doivent pas être migrées comme des avis réels.
4. **Ouvrir le restaurant.** Il consulte l’adresse, les horaires, les options disponibles, les consignes, le menu et les prix. Un restaurant fermé ou un plat indisponible est signalé; il ne peut pas être ajouté au panier.
5. **Choisir les plats.** Il choisit quantités et options effectivement prises en charge. Les modifications de menu ou prix ne sont jamais validées par le seul navigateur.
6. **Construire le panier.** Le panier contient les produits d’un seul restaurant. S’il choisit un article d’un autre restaurant, Speedfood lui demande s’il veut vider/remplacer le panier ou revenir à son choix actuel.
7. **Vérifier.** Le panier affiche quantités et sous-total; frais de livraison et modalités sont détaillés ou indiqués « à confirmer ». Le client sait que la commande n’est pas encore acceptée ni payée.
8. **Renseigner la commande.** Le client saisit son nom et son numéro de contact. Il choisit retrait ou demande de livraison; l’adresse est demandée pour la livraison. Il voit les conditions demandées, le sous-total et chaque frais déjà connu.
9. **Envoyer.** Le serveur revalide restaurant actif, disponibilité, prix et quantités, recalcule le montant et crée une commande `en_attente` une seule fois. Le double-clic ou une reconnexion ne doit pas produire deux commandes.
10. **Voir le résultat.** Speedfood affiche une référence et un lien de suivi protégé par un jeton non devinable. Le client voit que la demande est transmise, pas encore acceptée ni payée. Le téléphone et l’adresse ne sont pas affichés sur une page publique.
11. **Recevoir une décision du restaurant.** Le restaurant peut accepter les conditions envoyées, refuser, ou proposer des changements de prix total/frais/conditions de livraison. L’acceptation des conditions initiales passe à `acceptee`; un refus passe à `refusee`.
12. **Examiner une proposition modifiée.** Si le restaurant change prix/frais ou conditions de livraison, Speedfood montre clairement la demande initiale à côté de la nouvelle proposition, chaque frais, le nouveau total, le changement de mode/zone/délai, et la date limite. La commande reste `en_attente` et son état affiché devient « attente de confirmation du client » (état dérivé `attente_confirmation_client`); elle reste bloquée.
13. **Donner son accord explicite.** Le client appuie sur « Accepter la nouvelle proposition » ou « Refuser et annuler ». Aucun choix n’est présélectionné. Accepter la version courante fait passer la commande à `acceptee`; refuser l’annule. Une version remplacée ou expirée ne peut être acceptée.
14. **Récupérer le repas.** Après accord, le restaurant prépare, marque `prete`, puis `terminee` lors de la remise. Le paiement se fait directement auprès du restaurant pendant le pilote.

### Cas de blocage et récupération

- **Restaurant fermé / suspendu :** retirer l’action de commande; conserver une explication et, si pertinent, les horaires.
- **Plat devenu indisponible ou prix changé avant envoi :** serveur refuse la soumission avec les éléments concernés; garder les autres articles du panier et permettre la correction.
- **Commande refusée :** afficher le statut et une raison courte si le restaurant en donne une; proposer de retourner au catalogue sans soumettre automatiquement ailleurs.
- **Perte de connexion :** conserver éventuellement le panier sur l’appareil sans identité/contact; ne jamais prétendre que la commande a été envoyée sans reçu serveur. Bouton de réessai idempotent.
- **Client quitte avant la soumission :** aucun ordre créé.
- **Frais ou conditions de livraison modifiés :** le client doit explicitement accepter la proposition avant confirmation ou préparation. Enregistrer une version immuable; refuser/expirer signifie pas de commande confirmée, pas de préparation.
- **Le restaurant remplace un plat :** ne pas le faire automatiquement. Ce cas suit le même principe de consentement et doit être inclus dans le modèle de proposition avant d’activer les substitutions.

## B. Restaurateur : configurer et gérer son établissement

### Première connexion et publication

1. **Recevoir l’accès.** Pour le pilote, le restaurateur est invité ou son établissement est créé après vérification; l’inscription publique ne donne aucun accès aux données d’un autre restaurant.
2. **Se connecter.** Il utilise un compte nominatif; la récupération d’accès est explicite et sécurisée. Un lien d’invitation expire et ne contient pas d’informations client.
3. **Suivre un démarrage guidé.** La console demande seulement les informations nécessaires dans l’ordre : nom, contact professionnel, adresse/quartier, horaires, retrait/livraison proposée, puis menu.
4. **Créer le menu.** Le restaurateur ajoute catégorie, nom de plat, description courte, prix GNF entier et disponibilité. Champs inutiles sont masqués; les exemples sont illustratifs et clairement étiquetés.
5. **Prévisualiser.** Il voit la page publique telle que le client la verra et corrige les erreurs avant soumission.
6. **Demander publication.** L’établissement passe en revue administrative; Speedfood indique les éléments manquants. Il n’apparaît pas publiquement avant approbation.
7. **Être publié.** La console montre un état simple « visible sur le portail » et un lien partageable de sa page.

### Tâches quotidiennes

1. **Ouvrir l’accueil.** La première vue met les nouvelles commandes et les actions à faire en premier; les compteurs sont compréhensibles et les menus secondaires restent discrets.
2. **Traiter une nouvelle demande.** Ouvrir la commande, voir articles, sous-total, mode et données de contact nécessaires; accepter les conditions initiales, refuser, ou établir une proposition révisée avec détail des frais/conditions et échéance.
3. **Attendre la réponse du client.** Si les conditions ont été modifiées, la commande n’est pas confirmée et ne peut pas être marquée prête. Le tableau de bord l’affiche distinctement « En attente de l’accord du client ».
4. **Préparer.** Après accord seulement, marquer `prete`, puis `terminee` une fois remise au client. Une transition est confirmée visuellement et journalisée.
5. **Tenir le menu à jour.** Depuis l’accueil ou Menu, basculer la disponibilité d’un plat rapidement; le changement se reflète sur la page publique.
6. **Fermer temporairement.** Utiliser une action rapide pour suspendre les nouvelles demandes, sans supprimer la fiche ni son historique.
7. **Demander de l’aide.** Ouvrir une aide courte ou contacter le support sans quitter l’action en cours.

### Principes de simplicité à éprouver

- Navigation proposée : **Accueil · Commandes · Menu · Mon restaurant**.
- Commandes à traiter en premier; boutons tactiles larges et libellés concrets (« Accepter », « Refuser », « Plat indisponible »).
- Les actions fréquentes (accepter/refuser une demande, indisponibiliser un plat, fermer temporairement) se font depuis l’accueil en deux actions au maximum, cible à valider en observation.
- Pas de jargon (« statut », « catalogue », « tenant », « fulfillment ») dans l’interface restaurant.
- Une erreur indique quoi corriger et conserve les données déjà saisies.
- La console ne prétend pas enregistrer une action hors connexion.

## C. Administrateur système : opérer Speedfood dans le CMS

### Connexion et permission

1. **Se connecter à l’espace système distinct.** Seuls des comptes attribués par un super-administrateur peuvent y accéder; aucun auto-enrôlement par un compte restaurant.
2. **Voir son tableau de bord.** Afficher les files d’attente utiles au rôle : restaurants à vérifier, contenus à publier, incidents support ou activité globale agrégée.
3. **Agir selon son rôle.** `operations` gère onboarding/modération; `content_editor` gère pages et taxonomie; `support` recherche les commandes avec coordonnées masquées; `super_admin` attribue les rôles et gère les permissions/configurations sensibles.
4. **Auditer les actions.** Publication, suspension, changement de rôle et consultation exceptionnelle d’une donnée personnelle exigent un motif adapté et créent une entrée d’audit non modifiable depuis le CMS.

### Gérer un établissement

1. Retrouver une demande ou un établissement par nom, quartier, état ou date.
2. Ouvrir une fiche de contrôle avec aperçu du contenu public et éléments manquants.
3. Approuver, demander une correction ou suspendre; motif requis pour les décisions ayant un impact public.
4. Informer le restaurant du résultat via le canal réellement configuré; à défaut, l’état est clairement consultable dans sa console.
5. Vérifier l’état final, le nom du responsable, l’heure et le motif dans l’historique.

### Gérer le contenu public

1. Choisir le domaine : catégories/quartiers/tags, sélection de restaurants, bannière, FAQ ou page d’information.
2. Modifier un brouillon, prévisualiser desktop et mobile, puis publier/dépublier.
3. Voir la personne éditrice, le statut, la date de mise à jour et l’historique.
4. Ne jamais publier de restaurants, notes, témoignages, prix ou promotions fictifs comme s’ils étaient réels.

### Aider sur une commande

1. Le support demande une référence ou localise la commande par critères autorisés.
2. Il voit d’abord identifiants partiels, restaurant, statut et événements; téléphone et adresse restent masqués.
3. Si une donnée personnelle est indispensable à un incident, un rôle/permission spécifique, un motif et un événement d’audit sont requis.
4. Le support informe ou oriente; il ne confirme pas une commande et ne modifie pas son statut à la place du restaurant sans procédure approuvée.

## D. Expérience PWA et connexion

1. Le visiteur utilise d’abord le portail comme un site normal; aucune installation n’est exigée.
2. Une aide discrète explique comment l’ajouter à l’écran d’accueil lorsque l’appareil le permet; instructions alternatives pour les navigateurs sans invite universelle.
3. Une fois installée, la PWA s’ouvre en mode autonome mais utilise les mêmes comptes et contrôles serveur.
4. Hors ligne, le shell statique et une explication peuvent apparaître. Aucun menu dynamique, commande, compte, téléphone ou adresse n’est affiché depuis un cache.
5. Les formulaires désactivent ou retiennent localement le brouillon non sensible sans le présenter comme envoyé. Pour le MVP, ne pas mettre en file les commandes ni les actions CMS/restaurateur.

## E. Décisions à trancher avec des restaurateurs avant gel du parcours

1. Le restaurant a-t-il intérêt à accepter ou refuser directement dans la console, ou doit-il appeler/confirmer par WhatsApp ?
2. La livraison est-elle annoncée par chaque établissement avec frais fixes, frais par zone, ou confirmée après la demande ?
3. Quelle durée laisse-t-on au client pour répondre à une proposition révisée avant expiration ?
4. Quelles conditions le restaurant peut-il réviser (frais, délai, zone, mode de service), et les substitutions de plats sont-elles permises ?
5. Quels éléments de menu les restaurants savent-ils tenir à jour eux-mêmes : prix, disponibilité, photos, options ?
6. Quel canal de notification et quel délai de réponse peuvent être réellement tenus ?
7. Qui peut publier une nouvelle fiche et quelle preuve minimale confirme qu’elle appartient au restaurant ?

## F. Ce qui est déjà dans la démo et ce qui reste à construire

| Zone | Prototype actuel | MVP à construire |
|---|---|---|
| Client | Recherche locale, filtres, cartes, menu, panier, demande de commande locale | Données serveur, validation, reçu/suivi sécurisé, comparaison et consentement à une proposition révisée, erreurs réseau |
| Restaurant | Petit tableau simulé dans le même navigateur | Comptes, tenant séparé, console dédiée simple, menu réel, sécurité, proposition de changement et attente du consentement client |
| Admin système | Aucun CMS | Authentification, RBAC, gestion établissements/comptes, contenu/taxonomie, support/audit |
| PWA | Pas implémentée | Manifest, icônes, installation HTTPS, shell et page hors connexion sans données dynamiques |

## Addendum parcours — recherche disponible et partage Speedfood (3 octobre 2026)

Appliquer `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` comme règle la plus récente. Le parcours client ajouté est : ouvrir Speedfood sans compte → rechercher un plat/restaurant → choisir quartier ou autoriser temporairement la localisation → appliquer ouvert/commandes actives/disponible → consulter les groupes exact, à confirmer, équivalent et suggestion → lire la fiche avec fraîcheur → partager la page Speedfood ou ouvrir WhatsApp avec texte prérempli.

En cas de rupture : la page source affiche l’article épuisé; les alternatives sont séparées et indiquent prix, quartier/distance indicative et dernière confirmation. Disponibilité vieillie = « à confirmer ». Aucune alternative n’est automatiquement substituée au panier.

Le restaurateur se connecte, crée une page brouillon, renseigne coordonnées/menu/horaires, prévisualise et soumet à validation. Dans sa console mobile, il peut changer ouvert/fermé, prise de commandes et état d’un article; le changement ne paraît confirmé qu’après réponse serveur et affiche son heure. Il partage un lien/visuel Speedfood.

Google/téléphone sont des choix sur l’écran d’authentification quand configurés. OTP SMS n’est jamais annoncé comme envoyé si le prestataire n’est pas réellement configuré. Le visiteur conserve la découverte publique sans compte.
