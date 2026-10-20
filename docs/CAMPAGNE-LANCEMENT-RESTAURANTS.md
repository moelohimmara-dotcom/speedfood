# Campagne de lancement : les 8 à 10 premiers restaurants

**Date :** 20 octobre 2026 · **Origine :** brainstorming du 20 octobre avec Malika · **Statut :** plan validé en discussion, **rien n'est lancé** ; les chiffres cibles et les quartiers restent à confirmer par Malika.

## 1. Pourquoi cette campagne

Lecture des données du 20 octobre 2026 (base de production, hors commandes de test) :

- **1 seul restaurant publié** (barbie food, Kaporo Centre).
- **9 commandes réelles en tout** (5 retraits, 4 livraisons), entre le 27 septembre et le 12 octobre, sur 2 à 3 restaurants. Aucune commande à table, aucune saisie par un restaurateur, **aucune depuis le 12 octobre**.
- Conséquence visible : un client situé à Kobaya, lançant l'aide au choix, ne trouve rien dans 5 km (le restaurant le plus proche est à environ 9 km).

Le goulot n'est donc **pas** le modèle économique mais l'offre (peu de restaurants) et la demande (peu de commandes). Les deux se bloquent : sans restaurants près d'eux, les clients ne reviennent pas ; sans commandes visibles, les restaurateurs suivants ne s'inscrivent pas.

## 2. Décisions déjà prises pendant le brainstorming

| Sujet | Décision | Réserve |
|---|---|---|
| Qui paie en premier | Le restaurateur, **par commande** (frais fixe) | Aucune facturation avant le test à blanc (ADR-008 et TDR, paragraphe sur la facturation) |
| Encaissement | **Test à blanc d'abord** : le système calcule des frais simulés, sans rien facturer | Reporté tant que le volume de commandes est trop faible pour être lu |
| Forme du frais | **Montant fixe par commande** terminée (montant à choisir ; 1 000 GNF proposé comme point de départ) | Non décidé |
| Commandes à compter | Quatre compteurs séparés : (A) livraison et retrait commandés par le client, (B) commandes à table par QR, (C) commandes saisies par le restaurateur, (D) première commande de chaque client | Choix des compteurs à retenir après le test |
| Priorité | **Acquisition d'abord**, compteur de frais ensuite | |
| Stratégie | **Plusieurs quartiers en parallèle** (choix de Malika) | Compromis : peu de choix par zone ; compensé par l'élargissement du rayon de l'aide au choix |
| Point de départ | **Aucun contact** de restaurateur en dehors de barbie food | Tout est à construire : liste, approche, argumentaire |

## 3. Plan de campagne (2 semaines, puis mesure à 4 semaines)

### 3.1 Cible
- **5 quartiers × 2 restaurants** (10 visites minimum).
- Quartiers : ceux que Malika connaît le mieux (elle est à Kobaya) et leurs voisins immédiats. **À choisir par Malika** : liste ci-dessous à compléter.
- Profil d'un bon premier restaurant : smartphone avec WhatsApp, une vingtaine de clients par jour au moins, menu stable, décideur présent, retrait ou livraison possible. Priorité aux grillades, fast-food et petit-déjeuner (commandes simples, panier réduit).

| Quartier | Restaurant 1 | Restaurant 2 | Visité le | Résultat |
|---|---|---|---|---|
| (à compléter) | | | | |

### 3.2 Offre de lancement
- Installation gratuite, environ 30 minutes.
- **Aucun frais pendant les 3 premiers mois** (cohérent avec ADR-008 : pas de facturation dans le MVP).
- Message : « Vous gardez 100 % de ce que le client paie. Il paie chez vous. Nous vous apportons les commandes. »
- Engagement demandé : afficher le QR de table et partager le lien sur son WhatsApp.

### 3.3 Fiche de visite (30 minutes)
1. **Avant de partir :** téléphone chargé, connexion de secours, affiches imprimées, ce plan.
2. **Démonstration** sur le téléphone du restaurateur : trouver son restaurant, voir comment un client commande.
3. **Mise en place** : photo du menu, analysée par le Chef IA (plats et prix), correction à deux ; photo du restaurant ; horaires ; téléphone du restaurant.
4. **QR de table** imprimé depuis la page Affiche, collé sur une table.
5. **Commande de test passée ensemble** : le restaurateur voit l'alerte arriver et accepte la commande (mode test, jamais comptée).
6. **Il garde** : votre numéro WhatsApp d'assistance, le rappel « ouvrez la console avant le service ».
7. **Demande de parrainage** : « Quels deux restaurants voisins devrais-je voir ? »
8. Noter dans le tableau de suivi : date, objections entendues, plats manquants, qui sera joignable.

### 3.4 Parrainage
À la fin de chaque visite, demander deux noms de voisins. En retour (à décider) : une affiche « Commandez chez nous sur Speedfood », ou une mise en avant signalée comme telle sur la page d'accueil (sans acheter de classement organique, voir la spécification pilote §7).

### 3.5 Suivi hebdomadaire

| Semaine | Visités | Inscrits | Publiés | Commandes (total) | Commandes par restaurant | Délai avant la 1re commande |
|---|---|---|---|---|---|---|
| S1 | | | | | | |
| S2 | | | | | | |
| S3 | | | | | | |
| S4 | | | | | | |

### 3.6 Critères de réussite et d'arrêt
- **Réussite à 4 semaines :** au moins **8 restaurants publiés** et, pour chacun, au moins **3 commandes par semaine**.
- **Si en dessous :** on change d'approche (par exemple demande d'abord via la liste d'attente par zone, ou un seul quartier dense), au lieu de continuer à visiter.
- **Signal d'alarme à surveiller dès la semaine 2 :** des restaurants publiés qui ne reçoivent rien, ou qui laissent des commandes sans réponse.

## 4. Risques à traiter avant de partir

1. **Livraison : qui livre, à quel prix ?** Non réglé à ce stade. Le module livraison existe dans l'application ; il faut décider si les restaurants livrent eux-mêmes ou si Speedfood organise des livreurs. **À trancher avant la première visite.**
2. **Alertes ignorées :** un restaurateur qui n'ouvre pas la console laisse des commandes sans réponse. Les alertes sonores et notifications existent ; la visite doit les tester sur place.
3. **Plats épuisés** affichés comme disponibles : à expliquer et à faire pratiquer (bascule de disponibilité).
4. **Menu et prix** mal saisis : relecture à deux pendant la visite.
5. **Capacité technique** (plan Cloudflare gratuit) : des erreurs 503 aléatoires existent déjà. À 8 à 10 restaurants, la charge reste faible, mais à surveiller (voir `docs/PLAN-INCIDENT.md`).

## 5. Ce qu'il faudrait ajouter dans l'application pour soutenir la campagne (à évaluer, rien n'est décidé)

Par ordre d'utilité supposée :
1. **Tableau de bord pilote** (page administrateur) : restaurants par état (visité, inscrit, publié), commandes par restaurant et par semaine, délai avant la première commande. Alimente le tableau de suivi sans saisie manuelle.
2. **Relance automatique d'un restaurant** dont une commande reste sans réponse trop longtemps (la détection de retard existe déjà sur la console).
3. **Rappel à la fermeture** : plats épuisés à vérifier avant le service.
4. **Fiche de visite imprimable** générée depuis l'administration.
5. **Compteur de frais simulés** (différé) : voir §2, à reprendre quand il y aura du volume.

## 6. Questions ouvertes

- Quels sont les 5 quartiers, et quels restaurants y viser ?
- **Qui livre, et à quel prix ?**
- Qui fait les visites : Malika seule, ou des relais ?
- Montant du frais par commande à simuler (1 000 GNF proposé).
- Geste de remerciement du parrainage.
- Quel est le critère exact de « publié » pour un restaurant qui n'a pas encore de plats complets ?
