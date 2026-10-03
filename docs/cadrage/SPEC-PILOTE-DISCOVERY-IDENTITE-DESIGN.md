# Spécification produit pilote — Découverte, identité et expérience Speedfood

**Version :** 1.0 — décisions consolidées au 3 octobre 2026  
**Périmètre :** portail client, pages restaurants, console restaurant et CMS système  
**Portée :** complément prioritaire au TDR, ADR, parcours, architecture et brief frontend.

Ce document rassemble les décisions produit prises après le cadrage initial. En cas de contradiction sur ces sujets, cette version prévaut sur les formulations antérieures : la recherche intelligente et les recommandations utiles font maintenant partie du pilote; l’intégration automatisée de WhatsApp reste hors périmètre, mais le partage et le contact WhatsApp sont prévus; Google et téléphone sont des méthodes de connexion souhaitées, sous réserve de validation SMS en Guinée.

Speedfood a déjà une démo interactive dans `index.html`, `styles.css` et `app.js`. Elle constitue la base visuelle et un premier modèle de parcours. Les agents doivent la parcourir et l’inspecter avant d’éditer, conserver ce qui est utile et remplacer progressivement les données/actions simulées par les fonctions du pilote. Le détail de l’évolution écran par écran est dans `PARCOURS-CIBLE-CLIENT-MVP.md`.

## 1. Promesse du produit

**Speedfood aide les gourmets de Conakry à trouver un plat réellement disponible dans un restaurant ouvert et proche.** Chaque restaurant possède une page qu’il peut créer et gérer; Speedfood organise la découverte, présente des alternatives en cas de rupture et permet de revenir vers les pages suivies.

WhatsApp sert à distribuer les liens et à poursuivre une conversation avec le restaurant. Speedfood reste le lieu de découverte, de recherche, de comparaison, de suivi des restaurants et de lecture des disponibilités.

## 2. Principes du pilote

- Consultation publique sans compte; demander une connexion seulement pour une action qui la nécessite.
- Priorité mobile, faible consommation de données, images compressées et interface utilisable sur connexion instable.
- Localisation facultative : position de l’appareil avec consentement explicite, ou sélection manuelle du quartier/repère.
- Statuts opérationnels modifiables par le restaurant en un geste : ouvert/fermé, commandes acceptées/en pause, plat disponible/épuisé.
- Afficher l’heure de la dernière confirmation de disponibilité; information ancienne = « à confirmer », jamais garantie.
- L’algorithme MVP est explicable, fondé sur des règles et des données récentes; pas de boîte noire ni d’IA nécessaire.
- Les alternatives sont explicitement étiquetées; un plat différent n’est jamais présenté comme équivalent exact.
- Le restaurant garde la main sur l’acceptation. Toute modification du prix, des frais ou des conditions après envoi exige l’accord explicite du client avant confirmation/préparation.
- Pas de note moyenne publique tant qu’il n’existe pas d’avis authentifiés et une politique anti-manipulation.

## 3. Expérience client

### 3.1 Accueil découverte

L’accueil présente la promesse « Qu’est-ce qui te ferait plaisir aujourd’hui ? » avec une recherche centrale par plat, spécialité, type de cuisine ou restaurant. Il expose rapidement le quartier/position, les filtres prioritaires et des rails éditoriaux maintenus par Speedfood : « Disponible maintenant », « Menus du jour », « À découvrir près de toi ».

Les blocs éditoriaux doivent être alimentés par des données de restaurants réels et l’accord de publication requis. Une sélection éditoriale porte ce libellé; une promotion payante future porte un badge « Sponsorisé ».

### 3.2 Recherche locale

La recherche accepte une saisie simple et propose des suggestions utiles. Les résultats peuvent être filtrés par :

- quartier ou proximité;
- ouvert maintenant;
- accepte actuellement les commandes;
- disponibilité confirmée;
- catégorie/type de cuisine;
- budget, si les fourchettes ont été renseignées de manière exploitable.

Une liste est le mode de base; une carte géographique reste une amélioration ultérieure, car les adresses et coordonnées doivent d’abord être suffisamment fiables. La distance est indicative et ne représente pas un délai de livraison.

### 3.3 Article indisponible et alternatives

Quand un article exact est épuisé, Speedfood affiche clairement sa rupture sur la page source, puis propose :

1. le même article dans un autre restaurant, disponibilité récente confirmée;
2. un article déclaré équivalent par son restaurateur ou classé dans la même catégorie;
3. d’autres idées à découvrir, séparées visuellement des correspondances exactes.

Chaque proposition indique le restaurant, le quartier ou la distance indicative, le prix affiché et l’heure de confirmation de disponibilité. Si l’information est ancienne, afficher « disponibilité à confirmer » et demander confirmation au restaurant avant d’affirmer que le plat est disponible.

### 3.4 Page restaurant

La page publique est une mini-vitrine partageable : photo de couverture ou plat vedette, identité, quartier/repère, horaires, statut ouvert et statut de prise de commandes, menu et prix, informations de service, dernière mise à jour, CTA de contact/commande, partage Speedfood/WhatsApp et QR code.

Les photos nécessitent l’accord du restaurant. Les visuels génériques sont des placeholders clairement identifiés; ils ne doivent pas laisser croire qu’ils représentent un plat réel.

### 3.5 Partage et WhatsApp

- Chaque restaurant, menu et plat possède un lien Speedfood partageable.
- « Partager sur WhatsApp » ouvre l’application avec un texte et lien Speedfood préremplis; l’utilisateur confirme lui-même l’envoi.
- « Contacter/commander sur WhatsApp » ouvre la conversation du restaurant avec un message prérempli mentionnant Speedfood et le plat. Cela n’envoie pas automatiquement de commande et ne confirme ni prix ni disponibilité.
- Les visuels du menu du jour sont téléchargeables/partageables, portent discrètement la marque Speedfood et renvoient vers la page correspondante.
- Aucun bot, automatisation de messages, WhatsApp Business API ou statut de commande synchronisé n’est prétendu opérationnel dans le MVP.

## 4. Fonctionnement du moteur de découverte

### 4.1 Étapes de classement

Le moteur fonctionne en quatre étapes, côté serveur ou à travers une couche qui protège les champs non publics :

1. **Interpréter la demande** : terme exact, synonymes/catégorie maintenus, quartier et filtres.
2. **Écarter les inadmissibles selon les filtres explicites** : établissement non publié/suspendu; fermé si « ouvert maintenant » est demandé; commandes en pause si « accepte les commandes » est demandé.
3. **Former des groupes de résultats** : correspondance exacte et confirmée; correspondance exacte à confirmer; article équivalent confirmé; suggestions de catégorie.
4. **Classer à l’intérieur de chaque groupe** avec un score transparent.

### 4.2 Score de classement pilote

Après les filtres durs, calculer un score déterministe sur les signaux disponibles, normalisés de 0 à 1 :

`score = 0,40 × correspondance_article + 0,25 × fraîcheur_disponibilité + 0,20 × proximité + 0,10 × ouvert_et_commandes_actives + 0,05 × complétude_page`

Le groupe de correspondance exacte confirmé reste toujours avant les alternatives, même si un restaurant alternatif est plus proche. Les coefficients sont des valeurs initiales à observer et ajuster; ils ne constituent pas une promesse de qualité. Si position, prix ou fraîcheur manquent, le système omet le signal ou réduit sa confiance; il ne fabrique jamais une distance ou une disponibilité.

Au pilote, ne pas utiliser les clics comme unique signal de pertinence et ne pas promouvoir secrètement un restaurant payant. Un classement sponsorisé futur doit être visiblement séparé et étiqueté.

### 4.3 Définition de la fraîcheur

Le seuil de fraîcheur est configurable côté serveur et documenté. Le restaurateur confirme explicitement l’état des articles. Les commandes enregistrées diminuent-elles automatiquement le stock? **Non dans le pilote**, car Speedfood ne garantit pas l’exhaustivité des ventes réalisées en personne/WhatsApp. Une commande acceptée peut déclencher une demande de revalidation ou une mise en rupture si le restaurant le confirme, mais aucun inventaire comptable n’est promis.

Un statut « faible quantité » peut être ajouté si les restaurateurs comprennent sa règle. Au départ, privilégier `disponible`, `indisponible`, `à_confirmer`.

## 5. Expérience et modèle restaurant

### 5.1 Création de page

Le restaurateur s’inscrit, propose le nom et les renseignements de son établissement, puis crée une page en brouillon. Il complète les informations essentielles, prévisualise sa page et soumet la publication. Les premières pages sont validées manuellement par Speedfood avant d’être publiques.

Le parcours propose une aide humaine d’onboarding pour les premiers établissements : import/saisie du menu, photo de qualité, QR code, lien de partage et démonstration d’une mise à jour de disponibilité.

### 5.2 Console restaurant

L’accueil mobile de la console priorise :

- commandes nouvelles à traiter;
- grande bascule ouvert/fermé;
- grande bascule accepte/en pause;
- actions « Épuisé » et « Remettre disponible » depuis le menu;
- publication du plat du jour;
- aperçu public de la page et bouton de partage;
- indicateurs faciles à interpréter : vues de page, clics WhatsApp, partages, demandes reçues.

Chaque indicateur précise période et définition; un clic WhatsApp n’est pas présenté comme une commande. Un statut s’enregistre après confirmation serveur seulement, avec retour de réussite/erreur et heure de mise à jour visible.

## 6. Authentification et comptes

### 6.1 Méthodes souhaitées

Proposer : `Continuer avec Google` et `Continuer avec mon numéro`. Supabase Auth est le choix de départ proposé afin de garder authentification et PostgreSQL ensemble. Ne pas ajouter Clerk sans décision d’architecture documentée. Les visiteurs conservent l’accès sans compte aux recherches et pages publiques.

Google OAuth ne demande que les informations de profil indispensables (identifiant, nom/email si requis). Aucun accès Gmail, contacts ou autres scopes n’est demandé.

### 6.2 Téléphone guinéen

- Saisie conviviale du numéro guinéen et stockage au format normalisé international `+224`.
- OTP envoyé par un fournisseur externe choisi et configuré par un administrateur habilité; les frais SMS et la couverture réseau doivent être vérifiés avant l’ouverture publique.
- Avant activation à grande échelle, vérifier la livraison des codes sur les opérateurs et types de numéros utilisés par les pilotes, mesurer les coûts, définir les limites d’envoi et un mécanisme CAPTCHA/anti-abus.
- Afficher une alternative Google et une aide si le code n’arrive pas. Ne pas bloquer la consultation publique.
- Si le fournisseur SMS n’est pas validé/configuré, l’écran ne doit pas simuler l’envoi; le parcours téléphone reste désactivé ou clairement marqué comme indisponible.

### 6.3 Liaison de comptes et rôles

Google et téléphone peuvent être deux moyens d’accès au même profil après liaison contrôlée. Ne pas fusionner automatiquement deux comptes sur la seule ressemblance du nom ou de l’adresse email. La liaison exige une session authentifiée des deux côtés ou une procédure de récupération vérifiée. Un changement de numéro exige une nouvelle vérification; les numéros peuvent être réattribués.

Un compte client ne devient pas propriétaire restaurant ou membre du CMS par une sélection d’interface. Le rôle restaurant est accordé lors d’un onboarding contrôlé; le rôle système n’est donné que par un processus privilégié et journalisé. Les actions restaurant autorisées passent par les memberships et permissions serveur.

## 7. Business model cohérent avec l’expérience

La découverte de base est gratuite pour le client. Au lancement, une offre d’onboarding payante peut inclure création de page/menu, photos conseillées, QR et mise en place du partage. Elle est testée manuellement et n’achète pas un classement organique.

Après démonstration d’usage, Speedfood peut tester un abonnement SaaS pour les outils qui économisent du temps au restaurant : console, mises à jour, gestion des membres, statistiques utiles et supports marketing. Les placements sponsorisés ne sont proposés qu’avec audience mesurée, règles éditoriales et badge visible. Les commissions nécessitent attribution fiable des commandes et décision séparée sur paiements/livraison.

## 8. Direction artistique — « la table découverte de Conakry »

### 8.1 Système commun

Conserver les choix déjà validés : rouge `#D9362B`, orange `#FF7A1A`, jaune mangue `#FFC247`, crème `#FFF6ED`, blanc chaud `#FFFEFC`, encre `#2B211D`; Barlow Condensed pour les titres expressifs, Manrope pour l’interface; icônes régulières au trait arrondi.

Les couleurs vives servent aux actions, accents et états de disponibilité. Les grandes surfaces restent claires et calmes pour la lisibilité; rouge/orange en aplats plein écran n’est pas la règle. Garantir contraste lisible, tailles tactiles généreuses et focus clavier.

### 8.2 Portail client

Direction éditoriale, appétissante et locale : grandes photos authentiques, titre expressif, cartes de restaurant distinctives, rubans de découverte et filtres en capsules arrondies. La carte restaurant montre en premier plat visuel, nom, quartier, ouvert/commande active et fraîcheur de disponibilité. WhatsApp est secondaire au contenu Speedfood et son CTA garde explicitement le nom Speedfood.

Les badges distinguent `Disponible maintenant`, `À confirmer`, `Rupture`, `Ouvert`, `Commandes en pause`, `Sponsorisé` (ultérieur). Éviter le rouge d’erreur pour toute information neutre. L’état « épuisé » est lisible sans dépendre seulement de la couleur.

### 8.3 Page restaurant

Mini-vitrine premium : couverture photographique, informations fiables, menu sectionné avec prix visibles, disponibilité et mise à jour, avis non affichés au MVP, boutons de partage/contact cohérents. Fournir des modèles de visuel de plat du jour/QR avec identité Speedfood. Pas de fausses notes, compteurs ou badges de popularité.

### 8.4 Console et CMS

Console restaurant claire, apaisée et orientée action; navigation réduite à Accueil, Commandes, Menu, Mon restaurant. Les actions critiques sont des boutons larges avec texte, icône et confirmation appropriée. Un aperçu bascule vers la page publique.

Le CMS système privilégie densité et traçabilité, avec la même identité de marque mais une hiérarchie professionnelle; il ne doit pas ressembler au portail client. L’accès aux données personnelles est masqué et les permissions sont explicites.

### 8.5 Motion, images et performance

Animations courtes pour confirmation d’action, ouverture de filtres et transition disponibilité; respecter `prefers-reduced-motion`. Aucune vidéo lourde en lecture automatique. Images responsives, compressées, chargement différé en dessous du premier écran et placeholders sobres. Le contenu reste compréhensible quand une image échoue à charger.

## 9. Écrans P0 à ajouter au brief frontend

### Client

- `CLI-SEARCH-01` Accueil découverte / recherche et filtres rapides.
- `CLI-SEARCH-02` Résultats par article exact, disponibilité récente et ouvertures.
- `CLI-SEARCH-03` Résultats « disponible près de moi » avec localisation permise ou quartier manuel.
- `CLI-SEARCH-04` Aucun résultat / localisation refusée / information à confirmer.
- `CLI-ALT-01` Rupture d’article avec groupes exact, équivalent, suggestions.
- `CLI-RESTAURANT-01` Vitrine publique partageable avec horaires/statuts/menu.
- `CLI-SHARE-01` Partage Speedfood/WhatsApp et visuel/menu du jour.
- `CLI-AUTH-01` Choix Google/téléphone, erreurs, OTP, récupération et indisponibilité SMS.
- `CLI-FOLLOW-01` Restaurants suivis et derniers plats publiés (P1 si le suivi client n’est pas essentiel au pilote initial).

### Restaurant

- `RES-STATUS-01` Accueil opérationnel avec ouvert, prise de commandes, commandes à traiter.
- `RES-MENU-AVAIL-01` Liste menu avec changement disponibilité en une action et horodatage.
- `RES-PUBLISH-01` Publication du plat du jour avec aperçu partageable.
- `RES-PAGE-01` Création/complétion, brouillon, soumission, correction et aperçu public.
- `RES-INSIGHTS-01` Vues, clics WhatsApp, partages et demandes avec définitions (P1 après événements mesurés).

### CMS

- modération et validation des nouvelles pages;
- dictionnaire de catégories/synonymes de plats et quartiers;
- sélections éditoriales, aperçu et marquage sponsorisé futur;
- contrôle des statuts et horodatages de disponibilité pour support/modération;
- gestion du paramètre fraîcheur et règles d’algorithme, réservé aux rôles système appropriés et historisé.

## 10. Données à prévoir

Ajouter ou compléter les entités proposées ci-dessous après examen de la pile et des migrations existantes :

- `restaurant_locations`: quartier, repère textuel, coordonnées facultatives et précision/source de géolocalisation;
- champs de statut opérationnel : `opening_status`, `accepting_orders`, `status_updated_at`, `temporary_pause_until`;
- `menu_item_availability`: item, état, heure de confirmation, acteur/source, échéance éventuelle;
- `menu_item_tags` et synonymes contrôlés par CMS pour recherche de plats;
- `restaurant_follows` (uniquement si espace suivi inclus au pilote);
- événements analytiques minimaux et agrégés pour vues, partages, WhatsApp click, demandes; pas de capture du contenu conversationnel;
- paramètres de recommandation versionnés et événement d’audit des changements;
- fournisseurs d’identité attachés au compte Supabase Auth; téléphone vérifié et normalisé.

Les coordonnées géographiques exactes d’un client ne sont pas stockées par défaut pour classer des restaurants. La position peut être traitée temporairement dans le navigateur; un quartier/repère choisi suffit en alternative. Les données précises ne sont persistées que si un besoin de livraison explicite le requiert et après information/consentement.

## 11. Mesure du pilote

Suivre au minimum : recherches lancées, résultat exact disponible, résultat à confirmer, ouverture fiche, partage Speedfood, clic WhatsApp, statut de fraîcheur, changements de disponibilité, demandes et résultats. Agréger les rapports par période/restaurant. Ne pas assimiler clic WhatsApp à commande, ni vue à client unique. Éviter l’analytics inter-sites et les identifiants publicitaires; publier une information de confidentialité et une durée de rétention déterminées avant collecte réelle.

## 12. Phasage de construction

**Pilote essentiel :** pages restaurant validées, statuts ouvert/prise de commandes, disponibilité manuelle et horodatée, recherche par plat/quartier, filtres, alternatives exactes puis catégorielles, partage WhatsApp sortant, console simple et compte Google/téléphone si le SMS a été validé.

**P1 :** suivi de pages, fil éditorial plus complet, statistiques restaurant, géolocalisation plus affinée, suggestions personnalisées basées sur préférences explicites et données d’usage suffisantes.

**Plus tard :** inventaire automatique exact, intégration WhatsApp Business, commande/paiement/livraison gérés par Speedfood, prédiction de demande, classement personnalisé complexe, publicités.

## 13. Critères d’acceptation de cette tranche

- Le client trouve le plat exact et les alternatives selon groupes clairement nommés.
- « Ouvert », « commandes acceptées » et « disponible » ont des significations distinctes.
- Une information périmée n’est pas présentée comme certitude.
- Refuser la géolocalisation n’empêche pas la recherche par quartier.
- Un restaurant peut signaler rupture/rétablir disponibilité depuis mobile et voit quand le statut a été confirmé.
- Le partage ouvre WhatsApp avec un lien Speedfood; aucun envoi ou ordre automatique n’est simulé.
- Les pages publiques présentent Speedfood et renvoient à Speedfood après le partage.
- La connexion Google demande uniquement les scopes nécessaires; l’OTP téléphone ne fonctionne que si fournisseur configuré et validé.
- Aucune donnée privée d’un restaurant n’est visible depuis le compte d’un autre; aucune donnée client n’est mise en cache PWA.
- Les écrans suivent la palette, typographies et iconographie validées; les actions et états restent accessibles sans perception de couleur seule.

## 14. Notifications et outils UI

Appliquer `NOTIFICATIONS-ICONES-OUTILS.md` : améliorer le toast déjà présent dans la démo, utiliser un dialogue seulement pour une décision importante, et préparer les notifications métier in-app. Push Web/PWA est prévue comme évolution conditionnelle, avec opt-in contextualisé, préférences et test multi-appareil; le consentement push n’est pas demandé au premier chargement. Toute push renvoie vers Speedfood où le vrai état est vérifiable. Garder un set SVG fonctionnel au trait arrondi, complété par une petite série d’illustrations culinaires originales. Les bibliothèques proposées dépendent de la pile effective et n’impliquent pas d’installer React dans la démo.
