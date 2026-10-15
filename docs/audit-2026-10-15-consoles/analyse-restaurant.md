# Analyse d'ergonomie de la console restaurateur (lecture seule)

Dépôt : `C:\Users\moelo\dev\speedfood`. Chemins relatifs à `src/` sauf mention. Tout ce qui suit est tiré du code lu (layout, accueil, commandes, menu, profil, ouverture, tables, documents, nouveau, alertes, `public/sw.js`, CSS). « À vérifier » = non confirmé par lecture, faute de rendu réel (aucune capture d'écran n'a été faite).

---

## 1. La tâche centrale : une commande arrive, je la vois, je décide, je prépare, c'est prêt

### Parcours réel, geste par geste

| Étape | Ce qui se passe dans le code | Taps |
|---|---|---|
| Arrivée | Push vide « Nouvelle commande » (`public/sw.js:12-25`, `requireInteraction`, vibration) si l'abonnement push est actif ; sinon carillon dans l'onglet ouvert (`components/AlerteCommandes.tsx:91-111`, polling 15 s, rappel toutes les 2 min). | 0 |
| Ouvrir | Tap sur la notification : `sw.js:28-41` ouvre ou focalise `/restaurant/commandes` (bonne cible). | 1 |
| Voir | `commandes/page.tsx:76-89` : section « À traiter », cartes rouges (`.cmd-carte-en_attente`, `marche.css:648`). | 0 |
| Accepter | Bouton plein-largeur 56 px `Accepter la commande` (`CommandeCarte.tsx:336`, `marche.css:654`). **Aucune confirmation** : 1 tap. | 1 |
| Proposer un autre prix | `Proposer une modification` (l.340-347) ouvre le formulaire en ligne, saisie de 2 nombres et d'un texte, `Envoyer`, puis `window.confirm` natif (`FormulaireProposition.tsx:75`). | 4 à 5 taps + saisie |
| Refuser | `Refuser` + `window.confirm` (l.348-355). | 2 |
| Préparer | Pas d'étape « en préparation » : `acceptee` EST la préparation (libellé « Acceptée »). Rien ne dit au client un délai. | 0 |
| Prête | `Marquer prête` (l.385), 1 tap. | 1 |
| Remise | `Marquer livrée / servie / remise au client` (l.403), 1 tap. | 1 |

**Chemin heureux minimal : 4 taps** (notification, Accepter, Prête, Remise), sur **un seul écran** (la liste Commandes). C'est bon : la machine à états est directe, les boutons principaux sont gros (56 px, largeur pleine).

**Entrée depuis l'accueil** : `(console)/page.tsx:149` renvoie chaque ligne « À traiter » vers `/restaurant/commandes` **sans ancre vers la commande cliquée** : +1 tap et il faut retrouver la carte dans la liste.

### Ce qui ralentit

1. **« Triées par urgence » est faux dans « À traiter »** : `chargerApercusCommandes` trie `cree_le desc` (`lib/commande/requetes.ts:202`) et la page garde cet ordre. La commande la plus ancienne, donc la plus en retard, est **en bas**. Il faut trier `asc` dans la section « À traiter ». Gravité : critique pour le service.
2. **Le bloc paiement passe avant le bouton principal** (`CommandeCarte.tsx:256-314` avant `:334-407`). Sur une commande acceptée, `Marquer prête` est repoussé sous jusqu'à 6 boutons de paiement/WhatsApp/facture (l.272-311). Sur téléphone la carte fait plusieurs écrans. Mettre l'action principale en haut de la carte, replier le paiement.
3. **Carte longue et non scannable** : coordonnées complètes, bouton « Appeler le client » en plus du lien `tel:` (doublon, l.182 et 192), toutes les lignes de plat. Pas de vue compacte ni de dépliage ; l'historique rend aussi des cartes entières (`page.tsx:109-113`).
4. **Pas de pagination ni de limite** : `chargerApercusCommandes` charge **toutes les commandes du restaurant, historique complet, avec lignes et propositions** (`requetes.ts:196-202`) à chaque chargement de Commandes et de l'accueil, en plus du rafraîchissement automatique. Sur réseau variable, c'est le premier goulot quand l'historique grossit. Il traite aussi les propositions échues en écriture pendant le rendu (l.214-224).
5. **Rafraîchissement par `router.refresh()`** à chaque nouvelle commande et toutes les minutes (`AlerteCommandes.tsx:396-402`) : recharge complète de la liste lourde ci-dessus.
6. **« Refuser » et « Annuler » côte à côte** sur une commande `en_attente` (`CommandeCarte.tsx:348-363`) : deux sorties quasi identiques pour le restaurateur, deux libellés différents pour le client (à vérifier côté suivi). Aucun motif de refus demandé.
7. **`window.confirm` natif** pour refuser/annuler/pas reçu : gros boutons du navigateur, texte non stylé, parfois bloqués (apps intégrées, WebView). Voir §3.

### Ce qui manque

- **Mode « service » plein écran** : absent. Pas de vue réduite « à traiter uniquement » avec gros compteur.
- **Alerte visible sur téléphone** : l'état « alertes actives / connexion perdue / son bloqué » vit dans un `<details>` de la barre latérale (voir §3, problème critique n°1). Aucun indicateur dans l'en-tête mobile.
- **Compteur global fiable** : la pastille compte aussi les commandes en attente de réponse client (voir §3, n°2).
- **Écran maintenu allumé** (Wake Lock) : aucune occurrence de `wakeLock` dans `src/`. Un téléphone qui se met en veille endort l'onglet et donc le carillon ; `AlerteCommandes.tsx:547` le dit lui-même (« ne fonctionne que page ouverte »).
- **Annulation d'une erreur de tap** (annuler « prête » par exemple) : pas de retour arrière d'état dans la carte.
- **Temps de préparation annoncé au client**, ou impression/ticket : absent (à confirmer côté produit).
- **Tri/filtrage par mode** (livraison, retrait, sur place) : absent ; utile seulement si le volume monte.

---

## 2. Écarts avec le modèle « Wix-like » : ce qui est pertinent pour un restaurateur mobile

Principe : volume faible (de l'ordre de 20 commandes/jour), téléphone, une main occupée, réseau variable. Les mécanismes de Wix servent un utilisateur de bureau qui administre beaucoup d'objets. Pour le restaurateur, on retient ceux qui **réduisent des taps ou évitent une erreur**, pas ceux qui ajoutent des surfaces.

| Mécanisme | Existe aujourd'hui | Pertinent ? | Effort |
|---|---|---|---|
| **Barre latérale à deux niveaux repliable** | Latéral plat : 4 entrées + liste de 6-7 liens bas (`layout.tsx:45-85`). Pas de niveau 2, pas de repli. Sur téléphone : barre basse à 4 onglets + tiroir. | **Oui, mais dans la barre basse et le tiroir, pas en barre latérale à deux niveaux.** Garder 4 onglets fixes (Accueil, Commandes, Menu, Mon resto) et regrouper dans « Mon restaurant » les sous-pages (Ouverture, Menu du jour, Tables, Affiche, Documents, Sécurité) sous forme de liste/hub. Un repli de barre latérale n'apporte rien sur téléphone. Sur bureau, passer à deux niveaux (Menu : Plats, Ouverture de journée, Menu du jour ; Mon restaurant : Profil, Zones, Paiement, Documents, Équipe) est cohérent. | M |
| **Recherche globale** | Absente. | **Non en V1.** 20 commandes/jour, un menu de quelques dizaines de plats. Plus utile : une **recherche dans Commandes** (référence, nom, téléphone) et un filtre dans le menu quand il dépasse ~30 plats. | S (commandes), M (global) |
| **Accueil « prochaines étapes » avec checklist** | `ListeDemarrage` existe (`components/ListeDemarrage.tsx`) mais placé **tout en bas** de l'accueil dans un volet (`(console)/page.tsx:204-219`), sous KPI et graphique. | **Oui, très pertinent pour un restaurant neuf**, à remonter en tête tant que l'établissement n'est pas publié ; quand il l'est, l'accueil doit être un tableau de service (à traiter, bascules, ouvrir la journée). | S |
| **Tiroirs latéraux d'édition** | Aucun tiroir ni dialogue dans les pages (le seul `<dialog>` est le tiroir de navigation, `AdminMenuMobile.tsx`). Édition de plat = carte qui se transforme en formulaire (`PlatItem.tsx:47-137`). | **Oui sur téléphone, sous forme de feuille plein écran ou page dédiée** (édition de plat, proposition de prix). Sur téléphone un tiroir latéral est mal adapté ; une feuille basse plein écran ou une sous-route vaut mieux. Gain principal : sortir la saisie de la liste pour ne pas perdre sa position. | M |
| **Listes puissantes (colonnes configurables, tri, filtres, actions groupées)** | Listes simples. Menu : tri par nom, pas de recherche, pas de filtre « épuisés ». | **Colonnes configurables : non.** Filtres rapides par statut/mode et tri par ancienneté : oui. Action groupée **déjà présente** pour la disponibilité (« Tout reconfirmer », `menu/page.tsx:115`, « Ouvrir ma journée »). | S |
| **États vides utiles** | Présents et corrects : Commandes (`page.tsx:69-73`), Menu avec appel à l'action (`menu/page.tsx:123-148`), Ouverture avec bouton (`ouverture/page.tsx:59-67`), Tables/Affiche « disponible après publication ». | Oui, déjà bon. Améliorer l'état vide de Commandes : y mettre le lien de la page publique et le QR tant qu'aucune commande n'est arrivée. | S |
| **Barre d'enregistrement unique** | `BarreEnregistrement` seulement sur le profil (`FormulaireProfil.tsx:194`). Ouverture a sa barre fixe propre (`.rc-ouv-barre`). Quartier, zones, documents, plat : boutons séparés. | **Oui**, mais surtout pour éviter les enregistrements partiels sur le profil (un formulaire principal + quartier + zones + illustrations sont 4 enregistrements différents sur une page : `profil/page.tsx:76,113,121,125`). | M |
| **Aide contextuelle** | Quelques `aide-champ` et un bouton WhatsApp d'assistance dans `ListeDemarrage` seulement tant que non publié. | **Oui, mais légère** : lien « Une question ? » WhatsApp constant dans le tiroir, bulles `aide-champ` déjà là. Pas de centre d'aide. | S |
| **Hors ligne / réseau lent** | Aucun (service worker sans cache, `sw.js:4`). | **Plus pertinent que tout le reste ici** (voir §3). | M-L |
| **Équipe / rôles** | Absente. `restaurant_memberships.role` est lu (`contexte.ts:27`) mais jamais utilisé ; une seule appartenance par utilisateur (`maybeSingle()`). | Pertinent dès qu'un restaurant a un cuisinier + un gérant ; à cadrer produit avant de coder. | L |
| **Paiement (page dédiée)** | Dispersé : cases et codes marchands dans le profil (`FormulaireProfil.tsx:134-164`), encaissement dans la carte commande, reçus dans Documents. | **Oui**, une page « Paiement » (moyens, codes marchands, état des encaissements, reçus) corrigerait un besoin récurrent. Les codes marchands sont aujourd'hui noyés dans « Mon restaurant ». | M |

Verdict : ne pas copier la recherche globale ni les colonnes configurables. Copier **le hub de sections avec deux niveaux, la checklist de démarrage en tête, l'enregistrement unifié, l'édition hors liste**, et surtout traiter ce que Wix n'a pas : **service, alerte, réseau**.

---

## 3. Problèmes d'ergonomie constatés dans le code

### Critiques

**C1. L'alerte de commandes est montée deux fois, et son état est invisible sur téléphone.**
- `(console)/layout.tsx:47-50` met `AlerteCommandes` dans `liensBas`, et `liensBas` est dans `contenuLateral` (l.87-93) rendu **deux fois** : dans `<aside>` (l.101-103) et dans le tiroir `<dialog>` (`AdminMenuMobile`, l.108). Un `<dialog>` fermé garde ses enfants montés. Il y a donc **deux instances** : deux polls de 15 s, deux `AudioContext`, deux carillons simultanés, deux `router.refresh()` (`AlerteCommandes.tsx:364-396`). Vérification du doublon d'effets : chaque instance a son propre `connues` (l.128), donc les deux détectent la même nouvelle commande.
- Sur téléphone, `<aside>` est `display: none` (`admin.css:32-34`, seulement visible à partir de 1024 px, l.317-330) et le `<dialog>` est fermé : la ligne « Alertes actives · vérifié à 14:32 », l'alerte `role="alert"` « Vous ne recevez plus d'alertes » (l.551-557) et la note « le navigateur bloque le son » (l.544) **ne sont jamais à l'écran**. Le restaurateur qui croit être alerté ne l'est plus et ne le voit pas. C'est précisément le risque que le commentaire du composant dit éviter (l.21-23).
- Correction : monter `AlerteCommandes` **une seule fois** dans le layout, hors des sections répétées, et afficher un indicateur d'état persistant dans `.ad-entete-mobile` (point vert/rouge + « Son actif ») et en haut de la page Commandes ; garder les réglages détaillés dans le tiroir. Effort S-M.

**C2. L'ordre « À traiter » met la plus ancienne commande en dernier** (voir §1, point 1). `requetes.ts:202` + `commandes/page.tsx:58`.

**C3. Aucune gestion réseau lent / hors ligne côté actions.** Aucun `loading.tsx` ni `error.tsx` sous `restaurant/` (le dépôt n'en a que `restaurants/loading.tsx` et `system/loading.tsx`). Chaque navigation de console relance, dans le layout, `getUser` + 3 requêtes, puis refait `obtenirContexteRestaurant` dans la page (`contexte.ts:15-45`, 2 requêtes de plus) et la page charge ses données : écran blanc ou ancienne page figée sur réseau lent, sans retour. Les actions de `CommandeCarte` affichent seulement `disabled={enCours}` (l.272-362) : pas de libellé « Envoi… » sur Accepter, donc le tap semble sans effet et le restaurateur retape. Une exception réseau dans une server action n'est pas rattrapée côté client (`demarrer(async () => { await traiterCommandeAction(...) })`, l.74-79, pas de `try/catch`) : l'erreur remonte à React sans message. Correction : `loading.tsx` + `error.tsx` pour `restaurant/(console)`, libellés d'attente sur les boutons principaux, `try/catch` autour des actions, file de reprise simple pour Accepter/Prête. Effort M.

### Moyens

**M1. Écart de compteur : pastille et alerte comptent plus que la page.**
- `layout.tsx:27-28` et `alertes/route.ts:36` comptent `orders.statut = 'en_attente'`. `commandes/page.tsx:58` filtre `etatDerive === 'en_attente'`. Or `calculerEtatDerive` (`lib/commande/transitions.ts:113-120`) renvoie `attente_confirmation_client` quand le statut est `en_attente` **et** qu'une proposition est active. Résultat : après avoir proposé un autre prix, la pastille « Commandes » reste allumée (et le carillon est rejoué toutes les 2 min par `relanceSonDue`) alors que la section « À traiter » est vide et que la commande est « En cours ». Le restaurateur est relancé pour une commande qui attend le **client**.
- Correction : une seule source de vérité. Soit compter côté SQL `en_attente` sans proposition active, soit exposer une fonction commune (layout, route d'alerte, page). Effort S.

**M2. `PlatItem` perd les erreurs d'enregistrement.** `menu/PlatItem.tsx:51-54` : `action(formData); setEnEdition(false);` ferme l'éditeur immédiatement. Or `etat.erreur` n'est affiché que dans la branche d'édition (l.122-126). Si l'enregistrement échoue (prix invalide, photo trop lourde), le formulaire a disparu et **aucun message ne s'affiche** : le restaurateur croit avoir modifié le plat. Même risque documenté dans `CLAUDE.md` (« échoue silencieusement »). Correction : ne fermer l'édition que sur `etat.ok`, ou afficher l'erreur dans la ligne. Effort S.

**M3. Actions de disponibilité sans retour.** `PlatItem.tsx:175-178, 192-196, 211-214` : les résultats de `basculerDisponibiliteAction`, `confirmerDisponibiliteAction`, `archiverPlatAction` sont ignorés (pas d'erreur affichée, pas de confirmation visible hormis le changement du badge au rafraîchissement). Sur réseau lent, l'interrupteur « Disponible/Épuisé » ne dit pas si c'est enregistré. L'interrupteur est contrôlé (`checked={plat.disponible}`) donc il ne bouge qu'au retour serveur : sans indicateur, il semble cassé. Correction : état local optimiste avec retour arrière sur erreur, et toast. Effort S.

**M4. Pages sans entrée de navigation.**
- `ouverture` et `menu-du-jour` ne sont atteignables que par deux boutons de `menu/page.tsx:94-99` et deux de l'accueil (`page.tsx:122-127`). Le rituel « Ouvrir ma journée » est la tâche quotidienne n°2 après les commandes mais n'a ni onglet, ni raccourci en barre basse, ni badge « à reconfirmer ». À créer : sous-onglet « Aujourd'hui » dans Menu, et un rappel sur l'accueil quand `nombreAReconfirmer > 0` (la valeur est déjà calculée dans `menu/page.tsx:75` mais pas à l'accueil).
- `tables`, `affiche`, `documents` : uniquement dans la liste de liens du bas (`layout.tsx:56-67`). Sur téléphone, dans le tiroir. Les trois ouvrent des pages sans lien retour (`ouverture` en a un, `PageHeader retour`).
- `affiche` n'est pas lié depuis l'accueil (bloc « Mon lien et mon QR code », `page.tsx:221-243`) : il propose un téléchargement de QR mais pas l'affiche A4, qui est pourtant ce que le restaurateur veut imprimer.

**M5. Libellés d'icônes réutilisées et incohérents.** `layout.tsx:52-66` : « Voir ma page publique » et « Affiche et QR code » utilisent la même icône `boutique` ; « QR de tables » utilise `carte`, déjà celle de « Menu » dans la navigation (`NavRestaurant.tsx:15`). L'icône ne distingue plus les destinations. Mineur-moyen.

**M6. Liens secondaires cachés dans le tiroir mobile.** Sécurité du compte, déconnexion, Documents, Tables, Affiche sont accessibles uniquement via le bouton « Menu » de l'en-tête mobile (`AdminMenuMobile.tsx:21-29`), qui ouvre aussi l'alerte, l'installation de l'app et 6 liens dans une seule colonne. « Se déconnecter » est dans la même liste que les pages métier. Correction : hub « Mon restaurant » avec sections (Page publique, Paiement, Documents, Tables et affiche, Compte) et déconnexion séparée en bas.

**M7. Actions destructrices : confirmation par `window.confirm`.** `CommandeCarte.tsx:70,86` (refuser, annuler, pas reçu, marquer payée), `FormulaireProposition.tsx:75`, `PlatItem.tsx:210` (archiver), `SectionsMenu.tsx:70` (supprimer une section). Accessible mais non stylé, non traduisible, parfois supprimé par les navigateurs intégrés (WhatsApp/Facebook, que `AlerteCommandes.tsx:511` cite comme cas réel). Pas d'annulation après coup. Correction : composant de confirmation interne (feuille basse) avec bouton rouge nommé (« Refuser la commande SF-1234 ») et, pour refuser, 3 motifs prédéfinis. Pas de confirmation pour `Accepter` : correct.

**M8. 96 styles en ligne dans `src/app/restaurant`** (grep `style={{` : `CommandeCarte` 22, `SectionsMenu` 9, `BasculesStatut` 7, `menu/page` 7, `affiche/page` 7, `FormulaireProposition` 6, `PlatItem` 6, `OptionsPlat` 6, `(console)/page` 5, et 12 autres fichiers). Contredit la règle de `CLAUDE.md` (« le style va dans la feuille CSS »). Conséquences pratiques : impossible d'appliquer un mode « service » ou une densité compacte par CSS ; impossible de surcharger sur petit écran ; couleurs en dur dans `style` (`var(--orange)` dans `CommandeCarte.tsx:229`). Le plus coûteux à refondre : `CommandeCarte` (carte centrale du service).

**M9. Double garde d'authentification coûteuse.** Layout (`layout.tsx:21`) et page (`obtenirContexteRestaurant` dans chaque page) refont `getUser` et les requêtes de membership. Sur réseau lent, c'est deux aller-retours en série avant tout rendu. Mettre le contexte dans un `cache()` partagé. Effort S.

**M10. Nombre de commandes non plafonné dans l'accueil aussi** : `(console)/page.tsx:64` appelle `chargerApercusCommandes` sans limite pour n'afficher que 6 lignes et des agrégats sur 7 jours. Préférer une requête agrégée.

### Mineurs

- **m1.** `BasculesStatut.tsx:41-42` : un `Card` avec `<h2>` mais bouton `secondary` pour « Fermer le restaurant ». Fermer le restaurant est une action à effet fort sur les ventes sans confirmation ni indication de ce que voit le client. Ajouter une confirmation légère et un texte « Les clients voient : Fermé ».
- **m2.** `BasculesStatut.tsx` ne se resynchronise pas si l'état change ailleurs (état initial copié via `useState`, l.20).
- **m3.** Accueil : `Panneau` « Ma journée » (`page.tsx:119-129`) a deux boutons à poids égal (primary + secondary) quel que soit l'état ; si la journée est déjà confirmée, le bouton primaire devrait changer de ton.
- **m4.** `CommandeCarte.tsx:162` : badge « Test » avec `title`, inutile au toucher. Mettre le texte visible.
- **m5.** `commandes/page.tsx:81` : « Rien à traiter pour l'instant » sans aide ni état de connexion ; ajouter « Dernière vérification à 14:32 » (donnée disponible dans `AlerteCommandes`).
- **m6.** `nouveau/page.tsx:46-52` : styles en ligne, sans `PageHeader`, sans étape (voir §5).
- **m7.** Libellé « Mon restaurant » vs « Mon resto » entre latéral et barre basse (`NavRestaurant.tsx:16`) : cohérent avec le manque de place, mais le libellé court est familier.
- **m8.** `ChefIA`/`AjoutEnLot` : fonctions d'IA et d'import en lot dans une colonne latérale du menu (`menu/page.tsx:232-250`) ; sur téléphone elles passent **après** toute la liste des plats (colonne unique sous 1180 px, `console.css`), donc loin de « Ajouter mon premier plat » (ancre `#ajout-plat`, `menu/page.tsx:145`) : le formulaire d'ajout est tout en bas d'une longue liste. À remonter sur mobile.
- **m9.** `AlerteCommandes` : le titre d'onglet clignote seulement si l'onglet est caché (`l.371`) ; aucune vibration dans la page ouverte (seule la notification push vibre, `sw.js:22`).

---

## 4. Mobile : utilisable ou non, page par page

Socle : `rc-bas` fixe en bas jusqu'à 1023 px (`console-resto.css:32-80`), padding bas du contenu de 72 px + `env(safe-area-inset-bottom)` sur la barre (l.41), en-tête mobile avec bouton « Menu » (`admin.css:241+`). Boutons : `.btn` 44 px mini (`components.css:21`), `.btn-compact` 44 px (`catalogue.css:307-311`), `.cmd-principale` 56 px (`marche.css:654-658`), `.cmd-secondaires .btn` 44 px (l.665), `.cmd-contact` et `.cmd-appel` 44 px (l.669-686), items de barre basse 52 px (`console-resto.css:52`), lignes d'accueil 64 px (l.106). Les cibles respectent le design système (44 px).

| Page | Verdict | Preuves et réserves |
|---|---|---|
| **Accueil** | Utilisable | Une colonne par défaut, bascules à deux colonnes à 720 px (`console-resto.css:165-173`). Réserve : le bloc de checklist est en bas, sous KPI et graphique ; les KPI à 7 jours (`ad-cartes`) sont du bruit pour quelqu'un qui est en service. |
| **Commandes** | **Utilisable sur téléphone, avec réserves. Je tranche : oui.** Pas de media query propre, mais ce n'est pas nécessaire : la page est en colonne unique (`.cmd-liste` flex colonne, `marche.css:633`), le bouton principal fait la largeur de la carte à 56 px, les secondaires se replient en `flex-wrap` à 44 px, l'en-tête de carte a `flexWrap: wrap` (`CommandeCarte.tsx:138-146`). Les `.cmd-*` viennent de `marche.css` (parcours client, media 379/639 px non concernés) et de `console.css:731+` (retard). Réserves : carte très longue (paiement avant action, §1), 5-6 boutons empilés, texte 0,8 à 0,9 rem pour l'adresse et les frais (`CommandeCarte.tsx:172,185`), `window.confirm`. À vérifier au rendu : lisibilité de l'adresse en 0,9 rem en plein soleil. |
| **Menu** | Utilisable mais lourd | Colonne unique sous 1180 px (`console.css`, `.menu-colonnes`) : tout le formulaire d'ajout, l'import en lot, l'IA et les sections arrivent **après** la liste (m8). Boutons `btn-compact` à 44 px mais 3 par plat (Confirmer, Modifier, Archiver) serrés ; « Archiver » en rouge sans espacement de sécurité devant « Modifier » (`PlatItem.tsx:185-219`). Pas de recherche. |
| **Menu du jour** | Utilisable | Aperçu canvas en une colonne, deux à 900 px (à vérifier : poids de l'image, partage vers WhatsApp). |
| **Ouverture** | **Très bien sur mobile** | Barre fixe au-dessus de la barre basse (`.rc-ouv-barre`), boutons Oui/Épuisé en radios natifs, « Tout est disponible/épuisé », compteur `role="status"`. Modèle à suivre pour le reste de la console. Fonctionne sans JavaScript (commentaire du composant). |
| **Profil** | Utilisable mais long | Une colonne jusqu'à 1180 px, aperçu à droite masqué en dessous. Quatre enregistrements indépendants (§2). `BarreEnregistrement` collée en bas : à vérifier qu'elle ne se superpose pas à `rc-bas` (deux barres fixes) ; la page a `variante="console"` mais le CSS de superposition n'a pas été confirmé. |
| **Tables** | Utilisable pour configurer, inutile pour imprimer sur téléphone | Impression en A4 (planche de QR) ; sur téléphone, c'est un écran de configuration. |
| **Affiche** | Idem | Même remarque. |
| **Documents** | Utilisable | Deux colonnes → une sous 900 px (`documents.css`). |
| **Nouveau** | Utilisable, minimal | `maxWidth: 420` en ligne, un formulaire de 3 champs, boutons pleine largeur. |

Mode paysage téléphone : la barre passe en `position: static` pour hauteur ≤ 520 px (`console-resto.css:82-89`) : bon réflexe.

---

## 5. Onboarding : parcours d'un nouveau restaurant

1. **Entrée.** Un utilisateur connecté sans appartenance est redirigé vers `/restaurant/nouveau` par `obtenirContexteRestaurant` (`contexte.ts:42`). Aucune autre page n'envoie vers `nouveau` (grep : une seule redirection, plus l'auto-redirection de `nouveau/page.tsx:15`). Le point d'entrée marketing depuis l'extérieur vers « devenir restaurateur » n'est donc pas dans la console : à vérifier côté pages publiques/inscription.
2. **Nouveau (`nouveau/page.tsx`, `NouvelEtablissementForm.tsx`).** 3 champs : nom, catégorie, quartier. Bien court. Manques : pas d'indication du nombre d'étapes à venir, pas d'explication de ce qui se passe après (validation par l'équipe), pas de téléphone/WhatsApp du restaurant (essentiel pour l'équipe qui valide), pas de choix du mode (livraison, retrait, sur place) ni de zones de livraison. Erreur serveur générique (`lib/auth/actions.ts:206`) sans champ en surbrillance (la validation des champs se fait avec `required` natif, l.174-175 renvoie « Tous les champs sont obligatoires » sans dire lequel).
3. **Atterrissage (`redirect("/restaurant")`, `lib/auth/actions.ts:209`).** Le restaurateur arrive sur le tableau de bord de service : bascules Ouvert/Pause, « Ma journée », « À traiter » (vide), 4 cartes de chiffres à zéro, **puis** la checklist, tout en bas. Le premier écran n'a aucune étape claire à faire. Seule la bannière « n'est pas encore visible… une personne de l'équipe doit d'abord le valider » (`page.tsx:102-108`) et le pastille « En attente de validation » informent.
4. **Checklist (`ListeDemarrage`).** Cinq étapes (photo, logo, plat, horaires, paiement) + validation. Bien conçue (progression `<progress>`, liens directs, aide WhatsApp tant que non publié). Défauts : placée en bas ; les 3 étapes qui mènent à `/restaurant/profil` pointent toutes vers la même page sans ancre (`ListeDemarrage.tsx:30-34`) ; « Créer au moins un plat » mène à `menu` sans ouvrir le formulaire (ancre `#ajout-plat` existe) ; absence des étapes qui comptent pour pouvoir **recevoir** une commande : zones de livraison/frais (`profil/page.tsx:121`), activer les alertes (son + push), codes marchands, ouverture du jour. Une commande sera donc refusable ou bloquée sans que la checklist l'ait dit (à vérifier : un restaurant sans zone desservie peut-il recevoir une commande en livraison ?).
5. **Blocages.** Publication dépendante de l'équipe Speedfood (délai affiché si configuré). Entre-temps, `tables` et `affiche` sont inaccessibles (« Disponible après publication »), et le lien public + QR sont masqués (`page.tsx:221-243`). Le restaurateur n'a **rien à faire de concret** pendant l'attente hormis remplir son profil : une bonne occasion pour la checklist de proposer « Envoyer une commande de test » (le champ `est_test` existe, `CommandeCarte.tsx:162`) et « Activer les alertes ».
6. **Menu vide.** Appel à l'action clair (`menu/page.tsx:123-148`). Dictée/photo via IA (`ChefIA`) et ajout en lot sont de bons accélérateurs, mais relégués derrière la liste (m8).
7. **Où la checklist « prochaines étapes » aide le plus** : en tête de l'accueil tant que `publie` est faux ou qu'une étape manque, puis rétractable. Étapes proposées : 1 profil (photo, logo, horaires), 2 menu (au moins 5 plats), 3 paiement (moyens, codes marchands), 4 zones et frais, 5 alertes activées et testées (`/restaurant/alertes/test`), 6 commande de test, 7 demande de publication, 8 « Ouvrir ma journée » après publication.

---

## 6. Accessibilité

Points acquis :
- Lien d'évitement « Aller au contenu » (`layout.tsx:97-99`), `main` avec `tabIndex={-1}` (l.111).
- Navigation avec `aria-label` et `aria-current="page"` (`NavRestaurant.tsx:32,56`), pastille avec `aria-label`.
- Tiroir en `<dialog>` natif : focus piégé, Échap, retour de focus (`AdminMenuMobile.tsx:7-9`).
- Annonce vocale des nouvelles commandes : `role="status" aria-live="polite"` (`AlerteCommandes.tsx:558`), alerte de connexion en `role="alert"` (l.552).
- Focus visible : `.ad-app .btn:focus-visible` outline mangue 3 px (`console-b.css:86-88`).
- Cibles tactiles ≥ 44 px (voir §4) ; formulaires étiquetés (`label htmlFor` sur `FormulaireProfil`, `NouvelEtablissementForm`).
- `fieldset`/`legend` sur le rituel d'ouverture, radios natifs ; compteur en `role="status"`.

Problèmes :
- **Le seul état d'alerte critique est invisible sur mobile** (C1) : un `role="alert"` rendu dans un conteneur `display: none` n'est pas annoncé non plus.
- **`window.confirm`** : pas contrôlable en style, lecture variable selon lecteur d'écran.
- **Texte petit** : métadonnées de commande en 0,8 à 0,9 rem (`CommandeCarte.tsx:164,172,185,215,246`), note des bascules à 0,78 rem (`BasculesStatut.tsx:97`), item de barre basse à 0,74 rem (`console-resto.css:54`, 0,74 rem dans `rc-bas-item` et réduit encore sous 420 px par `fantaisie.css`, à vérifier). Le contraste de `--secondaire` (`#75695F`) est conforme AA sur crème selon le design système (non remesuré ici) ; le risque est la taille plus que la couleur.
- **Contraste de la pastille** : `.rc-pastille` fond `--orange` avec texte `--encre` (`console-resto.css:11-12`), `.rc-pastille-coin` fond rouge-foncé et texte blanc (l.23-24) : deux couleurs différentes pour la même information dans latéral/bas. À vérifier (valeurs de `--orange` pour AA).
- **Pas de gestion de `prefers-reduced-motion` sur le clignotement du titre d'onglet** (`AlerteCommandes.tsx:193-197`) ; la règle existe pour les animations d'entrée (`console-b.css:219`).
- **Filtre d'intitulés sur liens identiques** : plusieurs « Toutes les commandes » / « Ouvrir » (`documents/page.tsx:79`) sans contexte pour lecteur d'écran (`Ouvrir` seul répété dans la liste).
- **Sons uniquement** : l'alerte n'a pas d'équivalent vibratoire dans la page ouverte (m9).
- Règles `.ad-app` globales de `fantaisie.css` sur `input[type=checkbox]`, `label:has(...)` (inventaire §6) peuvent altérer la zone de clic de nouveaux contrôles (à vérifier au rendu si de nouveaux composants sont ajoutés).

---

## 7. Ce qu'il faut GARDER, et la dette technique

### À garder

- **Le modèle de commande en un écran** avec action principale 56 px pleine largeur par état, secondaires à 44 px (`CommandeCarte.tsx:334-407`, `marche.css:654-668`).
- **Le tri en sections par urgence** (À traiter / En cours / historique replié, `commandes/page.tsx:76-115`), après correction de l'ordre.
- **Le signalement de retard** (`cmd-retard`, seuil 10 min, `lib/alertes/commandes.ts:7`) et l'âge lisible.
- **Alertes multi-canaux** : carillon, titre d'onglet, notification locale via service worker (workaround Chrome Android documenté, `AlerteCommandes.tsx:381-389`), push page fermée sans donnée client (`sw.js:3-6`), test d'alerte avec limite de débit. Bonne conception, mal placée dans l'interface.
- **Barre basse à 4 onglets avec pastille** (`NavRestaurant.tsx`), `safe-area-inset-bottom`, mode paysage.
- **Le rituel « Ouvrir ma journée »** (un geste par plat, barre fixe, sans JavaScript indispensable) : référence pour toute la console.
- **`BasculesStatut` : pas de succès optimiste** (le nouvel état n'est affiché qu'après confirmation du serveur, `BasculesStatut.tsx:14-18, 31-35`) avec message d'erreur clair. Bon principe pour un service critique ; à étendre aux interrupteurs de plat (M3) avec un état « envoi… ».
- **`FormulaireProposition` reprend la dernière proposition** (`valeursDeReprise`), message explicite sur les conséquences pour le client.
- **États vides utiles**, bannière de correction demandée (`page.tsx:96-101`), `ListeDemarrage`.
- **Montants GNF entiers**, `fr-FR`, formatage cohérent.
- **Absence totale de styles en ligne dans `components/restaurant`** (inventaire §7).

### Dette technique

- **Couplage avec l'administration système** : `components/admin/blocs` (PageHeader, Panneau, EtatVide, Pastille, CarteChiffre, Volet) utilisé par la console système et le site public (inventaire §4, 32 usages hors restaurant) ; `AdminMenuMobile` identique pour les deux consoles (aria-label « Navigation de **l'administration** », `AdminMenuMobile.tsx:33`, lu tel quel par le lecteur d'écran du restaurateur) ; `BarreEnregistrement` partagée avec `system/parametres` ; `(console)/page.tsx:17` importe `lib/system-admin/pilotageCalculs` et `components/admin/graphiques`. Toute refonte du restaurateur modifiant ces blocs touche `/system`. Recommandation : dupliquer en `components/restaurant/blocs` les blocs qui changent de comportement (en-tête, panneau, volet) et ne mutualiser que les tokens.
- **Wrapper `ad-app` commun** (`layout.tsx:96` + `system/layout.tsx`) : toute règle `.ad-app …` des feuilles `console-b.css` et `fantaisie.css` agit sur les deux consoles. La console restaurateur n'a pas de racine CSS propre autre que `.console-resto`.
- **CSS global sans module** : cinq feuilles à tenir ensemble (`console-resto.css` 652 l., `console.css` 845 l., `console-b.css` 342 l., `fantaisie.css` 440 l., `recap.css` 106 l.) plus `admin.css` (2598 l.). Classes génériques non préfixées (`.btn`, `.field`, `.etat-vide`, `.tableau`, `.kpi`, `.interrupteur`, `.aide-champ`, `.bandeau-dispo`) définies dans plusieurs feuilles, `.field` dans 9 (inventaire §6). La règle de `CLAUDE.md` impose un préfixe de contexte ; `PlatItem`, `FormulaireProposition`, `NouvelEtablissementForm` utilisent `.field` brut.
- **Classes `cmd-*` à cheval sur deux feuilles** : définies dans `marche.css` (parcours client) pour la plupart, `cmd-carte-retard`/`cmd-retard` dans `console.css:731`, `cmd-paiement*` dans `paiement.css:62-78`. Modifier `marche.css` pour le client peut casser la console restaurateur sans erreur. Déplacer tout `cmd-*` dans `console-resto.css` (renommer `rc-cmd-*`).
- **`.cmd-liste` et `.menu-liste` définis dans deux feuilles** (inventaire §6) ; animations d'entrée en cascade sur les enfants directs de `.cmd-liste` et `.ad-contenu` (`console-b.css:194-207`) : une carte de commande qui arrive après un `router.refresh()` rejoue son animation (à vérifier au rendu) et retarde l'apparition de 60 à 220 ms par rang.
- **Classes TSX sans règle exacte** (inventaire) : `rc-illustration`, `rc-mj-choix`, `rc-ouv-groupe` (utilisées dans `PlatItem.tsx:222`, `FormulaireOuverture.tsx:64`), `affiche-page`, `chef-ia`, `plat-ligne` : soit vestiges, soit hooks de test ; à trancher.
- **96 `style={{ }}`** (§3, M8).
- **Requêtes**: `chargerApercusCommandes` sans pagination (§1), appelé par l'accueil et Commandes ; écritures (`traiterPropositionEchue`) pendant des rendus de lecture ; double `obtenirContexteRestaurant` (M9).
- **Compteur d'alertes dupliqué** en trois endroits (layout, route `alertes`, page) avec des définitions différentes (M1).
- **Aucune route `loading.tsx`/`error.tsx` pour `restaurant/`**.
- **Absence de tests visibles** d'ergonomie : à vérifier s'il existe un test e2e de la tâche centrale (commande → accepter → prête → remise) ; aucun n'a été lu pour ce rapport.

---

## Priorisation suggérée pour la refonte

1. S : unifier le compteur « à traiter » (M1) ; trier « À traiter » du plus ancien au plus récent (C2) ; corriger la perte d'erreur de `PlatItem` (M2) ; monter `AlerteCommandes` une seule fois (C1, étape 1).
2. S-M : indicateur d'état d'alerte persistant dans l'en-tête mobile (C1, étape 2) ; `loading.tsx`/`error.tsx` ; libellés d'attente, `try/catch` et retour d'erreur sur toutes les actions (C3, M3) ; action principale en tête de carte, paiement replié (§1).
3. M : checklist de démarrage en tête d'accueil, étapes alertes/zones/commande de test (§5) ; hub « Mon restaurant » à deux niveaux (§2) ; feuille de confirmation interne remplaçant `window.confirm` (M7) ; limiter et paginer `chargerApercusCommandes`.
4. M-L : page Paiement dédiée ; Wake Lock + vue « service » plein écran ; Équipe (cadrage produit d'abord) ; découplage `components/admin/blocs` ; sortie des styles en ligne et du CSS `cmd-*` partagé.
