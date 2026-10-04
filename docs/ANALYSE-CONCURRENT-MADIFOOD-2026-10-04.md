# Analyse du concurrent Madifood — 4 octobre 2026

**Objet :** comprendre le parcours, le fonctionnement et la pile technique de `madifood.com` pour **s'en inspirer et faire mieux**, sans copier. **Méthode :** parcours du site public dans le navigateur (téléphone et ordinateur), lecture du code source public et des en-têtes HTTP, lecture de la fiche publique de l'application sur l'App Store, critique de design (première impression, usabilité, hiérarchie visuelle, cohérence, accessibilité). **Rien n'a été soumis** : aucun compte créé, aucun formulaire envoyé, aucune connexion, aucune commande, aucune application installée.

## 1. Limites de l'analyse (à lire d'abord)

- **L'expérience de commande n'a pas été vue.** Elle se passe dans une application mobile à installer (131,9 Mo sur iOS), que je n'ai pas téléchargée. Ce que je décris de l'application vient de la fiche publique de l'App Store et de la FAQ du site.
- **Le tableau de bord des restaurants** (« Madifood Restaurant Manager », derrière `/login`) n'a pas été vu non plus.
- **Les chiffres de Madifood sont ses affirmations**, pas des faits vérifiés (voir §3 : l'écart entre « 4,8 » et la note de l'App Store).
- Les observations techniques sont celles d'un visiteur (en-têtes, balises, scripts) ; elles peuvent changer à tout moment.
- Cette analyse sert à décider, pas à imiter : aucun texte, visuel ou logo n'est repris.

## 2. Ce qu'est Madifood et comment le client avance

**Une place de marché à trois faces** (l'application est publiée par la société **Alysites SARL** ; le site web est probablement du même éditeur, ce que je n'ai pas pu vérifier) :

| Face | Où | Parcours |
|---|---|---|
| **Client** | Application mobile iOS et Android | Télécharger l'application, créer un compte, choisir un restaurant, composer sa commande, payer (espèces à la livraison ou mobile money), suivre en temps réel. |
| **Restaurant / commerce** | Formulaire web `/restaurant_partner`, puis tableau de bord web `/login` | Remplir une demande (type, organisation, commune, quartier, indications, **position GPS sur carte**, catégories, spécialités, responsable), attendre un appel sous 48 h. |
| **Coursier** | Formulaire web `/become-deliver` | Prénom, nom, téléphone, tranche d'âge, commune, quartier, possession d'une moto, motivation ; réponse sous 48 h ; paiement hebdomadaire sur mobile money. |

**Le site web lui-même n'est qu'une vitrine** : page d'accueil, à propos, FAQ, confidentialité, conditions, deux formulaires de recrutement. **On ne peut ni parcourir un restaurant ni commander depuis le web.** Tout passe par les boutons App Store et Google Play.

**Parcours de la page d'accueil** (vu sur téléphone, page de ~6 700 px) : promesse (« Bien manger, sans bouger, en moins de 45 min ») → boutons de téléchargement et preuve sociale → « Commander n'a jamais été aussi simple » (3 étapes : choisir son lieu, commander, recevoir) → « Tout depuis une seule appli » (restaurants, supermarchés, épiceries) → logos de partenaires → paiement (espèces, Orange Money, MTN MoMo, Soutra, Kulu, cartes, portefeuille MadiCash) → appel aux restaurants → appel aux coursiers → pied de page (à propos, FAQ, confidentialité, conditions, e-mail, téléphone).

## 3. Pile technique (relevé public)

| Élément | Constat | Preuve |
|---|---|---|
| Framework | **Next.js** (génération avec Turbopack, comme Speedfood), polices via `next/font` | scripts `/_next/static/…`, en-tête `x-powered-by: Next.js` |
| Hébergement | **Vercel** (région de service Paris, calcul à l'est des États-Unis) | `server: Vercel`, `x-vercel-id: cdg1::iad1` |
| Images | `next/image` : 88 images en chargement différé avec `srcset` | balises `<img loading="lazy" srcset>` |
| Icônes | **Boxicons chargé depuis unpkg** (CDN tiers, feuille de style bloquante) | `<link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/…">` |
| Carte | **Google Maps JavaScript** pour placer l'établissement (formulaire partenaire) | `window.google.maps` présent |
| Mesure d'audience | Aucune détectée (pas de gtag, pas de pixel) | absence de `dataLayer`, `gtag`, `fbq` |
| Application | Éditeur Alysites SARL ; iOS 16+, **langue : anglais uniquement**, note publique **3,9 / 5 sur 18 avis**, dernière note de version « fix ui and ux » | fiche App Store |
| Données de l'application | Localisation et coordonnées liées à l'identité ; diagnostics non liés | fiche App Store |
| Sécurité HTTP | Seulement HSTS. **Ni CSP, ni X-Frame-Options.** | en-têtes |
| Cache de la page d'accueil | `cache-control: private, no-cache, no-store` et `x-vercel-cache: MISS` : **une page statique recalculée à chaque visite** | en-têtes |

## 4. Critique de design (visiteur sur téléphone, puis ordinateur)

### Première impression
Identité **forte et reconnaissable** : jaune soleil et turquoise, grand titre en police arrondie, téléphone au centre entouré de bulles de plats. En deux secondes on comprend : application de livraison, Conakry, rapide. C'est un vrai point fort.

### Ce qui fonctionne bien
- **Promesse chiffrée et mémorable** (« en moins de 45 min »), répétée dans toute la page.
- **Une seule action principale** en tête : télécharger (badges des deux boutiques).
- **Trois étapes numérotées** : lisible, rassurant.
- **Paiement mis en avant** avec les moyens locaux (Orange Money, MTN MoMo…) : ce qui lève la peur de payer en ligne.
- **Recrutement des deux autres faces sur la même page** (restaurants, coursiers), avec une promesse de réponse en 48 h.
- **Formulaire partenaire bien structuré** : choix « Un restaurant / Une épicerie » en boutons, sections titrées, **carte pour la position GPS**, aide « ces informations aident vos clients à vous trouver ».
- **Photographie de plats locaux** (riz, attiéké, boulettes, wings) : crédible pour Conakry.
- **Toutes les images ont un `alt`**, un seul `h1`, repères de page présents.

### Défauts et faiblesses
| Constat | Gravité | Effet |
|---|---|---|
| **Aucun parcours web** : impossible de voir un menu ou de commander sans installer une application de 130 Mo | 🔴 | Perte de tous les visiteurs qui ne veulent pas installer (données mobiles chères, téléphone saturé). |
| **Preuve sociale incohérente** : « 4,8 · +50 000 téléchargements » sur le site, mais **3,9 sur 18 avis** sur l'App Store | 🔴 | Chiffres invérifiables ; un client ou un journaliste qui compare perd confiance. |
| **Moyens de paiement contradictoires** : la page d'accueil en liste 8 ; la FAQ n'en cite que 3 (espèces, Orange, MTN) | 🟡 | Promesse floue. |
| **Application en anglais uniquement** pour un public francophone ; `<html lang="en">` sur un site français | 🟡 | Mauvaise lecture par les lecteurs d'écran et les moteurs de recherche. |
| **Même titre « Madifood Restaurant Manager »** sur la connexion, le formulaire partenaire, coursiers, FAQ | 🟡 | Onglets et résultats de recherche indistincts. |
| **Pas d'aperçu de partage** (aucune balise Open Graph), pas de données structurées, pas de lien canonique | 🟡 | Lien partagé sur WhatsApp = aperçu pauvre. |
| `/robots.txt`, `/sitemap.xml`, `/manifest.json` renvoient la page HTML (code 200) | 🟡 | Pages de remplacement invisibles pour les robots ; aucune installation web possible. |
| **Contenu dupliqué dans la page** (carrousels en boucle : « Tout depuis une seule appli » et les trois cartes présents deux fois dans le DOM) | 🟡 | Lecteurs d'écran qui lisent tout en double. |
| Textes d'étapes **pâles** (révélés au défilement) | 🟡 | Contraste faible pendant l'animation, texte parfois illisible. |
| Cibles tactiles petites (« À propos » 61 × 21, « FAQ » 29 × 21, bouton menu 39 × 39) | 🟡 | Difficile à toucher. |
| Carte « Épiceries » avec un grand aplat vert sans photo | 🟢 | Section visuellement vide. |
| Adresses incohérentes (`/restaurant_partner` en snake_case, `/become-deliver` en anglais, le reste en français) | 🟢 | Désordre, mauvais pour le référencement. |
| **Commission non publiée** (« contactez-nous ») | 🟢 | Les restaurateurs ne peuvent pas comparer. |
| Page statique non mise en cache, icônes depuis un CDN tiers bloquant | 🟢 | Chargement plus lent qu'il ne faut. |

### Hiérarchie et lecture
L'œil va d'abord au titre jaune et turquoise, puis aux badges de téléchargement : **c'est correct**. Le défilement vertical est long (~6 700 px) mais rythmé par des blocs de couleurs alternées. La page raconte une histoire à **trois publics** sans les mélanger.

## 5. Où Speedfood est déjà meilleur, et où il est en retard

| Sujet | Madifood | Speedfood aujourd'hui | Verdict |
|---|---|---|---|
| Commander **sans installer** | Impossible (application obligatoire) | Oui, sur le web, sans compte | ✅ **Notre atout n°1**, à mettre au centre du discours |
| Poids pour le client | Application de 131,9 Mo | Aucune installation, pages légères | ✅ |
| Données demandées | Compte + localisation + coordonnées | Nom, téléphone, adresse seulement pour la commande, conservation limitée et affichée | ✅ |
| **Disponibilité prouvée** | Promesse « 45 min » invérifiable | « Confirmé il y a 12 min », « à confirmer » jamais présenté comme disponible | ✅ **Notre atout n°2** |
| Chiffres honnêtes | Chiffres contradictoires | Aucun chiffre inventé | ✅ à conserver |
| Sécurité HTTP | HSTS seulement | CSP stricte, X-Frame-Options, etc. | ✅ |
| Accessibilité | Lang erroné, cibles petites | Audit du 4 octobre, 14 écrans corrigés | ✅ |
| Identité visuelle | **Très forte** (jaune/turquoise) | Correcte mais moins mémorable | ⚠️ à renforcer |
| Moyens de paiement affichés | Mis en avant (mobile money) | « Vous payez le restaurant » seulement | ⚠️ à enrichir sans encaisser |
| Aide / FAQ | Page FAQ complète | Aucune page d'aide | ⚠️ à créer |
| Inscription restaurateur | Formulaire guidé avec GPS, réponse en 48 h | Compte immédiat + validation | ⚠️ à guider mieux |
| Référencement et partage | Faible aussi | Aperçu de partage sur les fiches, **pas de sitemap ni robots.txt** | ⚠️ à compléter |
| **Alerte de nouvelle commande** | Application mobile (notifications) | **Aucune alerte sonore ou push** : le restaurateur doit rafraîchir sa console | 🔴 **Notre plus gros retard** |
| Installation sur l'écran d'accueil | Application native | **Pas de manifeste ni de service worker** | 🔴 |

## 6. Recommandations pour faire nettement mieux (par ordre d'impact)

> Principe : **ne pas répondre à Madifood sur son terrain (application lourde, livraison), mais sur ce qu'il ne peut pas faire** : un service qui s'ouvre en une seconde, sans installation, sans compte, et dont chaque information est vérifiable.

### Lot A — Alerte de nouvelle commande pour le restaurateur (impact très fort, effort moyen)
Aujourd'hui, une commande reste « à traiter » tant que le restaurateur n'ouvre pas la page. Madifood a des notifications natives ; Speedfood doit mieux faire **sur le web** :
1. **Son d'alerte et titre d'onglet clignotant** quand une commande arrive (console ouverte), avec rafraîchissement automatique de la liste « À traiter ».
2. **Notification push web** après activation volontaire (« Être averti d'une nouvelle commande »), sur la base du chantier déjà décrit dans `NOTIFICATIONS-ICONES-OUTILS.md` (Service Worker, consentement, préférences, aucune donnée sensible dans l'aperçu). Sur iPhone : web app ajoutée à l'écran d'accueil.
3. **Relance** : si une commande « à traiter » dépasse X minutes, la mettre en évidence.

### Lot B — Application installable sans magasin (impact fort, effort faible à moyen)
Manifeste web, icônes, écran de démarrage, mode « application » : **« Ajouter à l'écran d'accueil »** pour clients et restaurateurs. Le poids d'une page reste de quelques dizaines de Ko, contre 131,9 Mo pour l'application concurrente. C'est aussi le préalable des notifications push (lot A).

### Lot C — Un discours web qui assume la différence (impact fort, effort faible)
Page d'accueil réellement tournée vers **la preuve et la simplicité** :
- Promesse : « Commandez en 30 secondes, sans application, sans compte. »
- Bloc **« Plats confirmés maintenant »** alimenté en direct par la base (nombre de restaurants ouverts, plats confirmés dans l'heure) : une preuve sociale **vraie**, que Madifood ne peut pas copier sans changer son modèle.
- Trois étapes (chercher, vérifier la confirmation, commander), avec nos vraies captures.
- Aucun chiffre qui ne soit pas calculé.

### Lot D — Confiance et information (impact moyen, effort faible)
- **Page « Aide / FAQ »** (commande, annulation, paiement, données, restaurateurs).
- **Moyens de paiement acceptés par le restaurant**, affichés sur chaque fiche (espèces, Orange Money, MTN MoMo…) comme **information déclarée par le restaurateur**, sans que Speedfood encaisse. Répond à la question que se pose tout client.
- **Commission et conditions de partenariat publiées** pour les restaurateurs, ou au minimum la phrase exacte sur la gratuité du pilote si elle est vraie (à valider avec vous).

### Lot E — Inscription restaurateur guidée (impact moyen, effort moyen)
S'inspirer de la structure de leur formulaire (choix du type, commune, quartier, indications, **position sur carte**, catégories, spécialités) mais **mieux** : étapes courtes, brouillon de page visible immédiatement, état d'avancement (« en validation, réponse sous X jours ») et lien WhatsApp d'assistance. La position GPS pourrait utiliser une carte libre plutôt que Google Maps (coût et dépendance).

### Lot F — Référencement et partage (impact moyen, effort faible)
- `robots.txt` et **sitemap** des restaurants publiés (Madifood renvoie des pages HTML à leur place).
- **Données structurées** « Restaurant » et « Menu » sur les fiches.
- Aperçu de partage (Open Graph) sur toutes les pages, pas seulement les fiches.
- Adresses cohérentes en français (`/devenir-partenaire`, `/aide`).

### Lot G — Identité plus mémorable (impact moyen, effort moyen)
Madifood doit sa notoriété à **un jaune et un turquoise reconnaissables**. Speedfood a rouge, orange et crème, mais pas encore de signature immédiate. Pistes (à décider ensemble, pas de copie de leurs couleurs) :
- Une **mascotte ou un motif** propre (par exemple la « carte de table » déjà évoquée dans la proposition de refonte).
- Des **photos de plats réels** (déjà prévu), avec un traitement uniforme.
- Un **nom de promesse** court et répétable, comme leur « moins de 45 min » (par exemple « Confirmé, pas supposé »), tant qu'il reste vrai.

### À ne pas faire
- **Ne pas inventer de chiffres** de téléchargements ou de notes.
- **Ne pas promettre un délai de livraison** : Speedfood n'assure pas la livraison.
- **Ne pas rendre l'application obligatoire.**
- **Ne pas encaisser de paiement** avant d'avoir statué sur la conformité et les coûts.

## 7. Décisions à prendre par Malika

1. Lancer le **lot A (alertes de commande)** en premier, avec la base du Service Worker ? (Recommandé : c'est le retard le plus coûteux pour un restaurateur.)
2. Quelle **phrase de promesse** adopter pour la page d'accueil ?
3. Le pilote est-il **gratuit pour les restaurateurs** (à écrire noir sur blanc) ? Quelle commission ensuite ?
4. Afficher les **moyens de paiement** déclarés par chaque restaurateur ?
5. Direction d'identité (lot G) : poursuivre la « carte de table » ou chercher une signature plus marquée ?

## 8. Sources consultées (publiques)

`madifood.com` (accueil, `/restaurant_partner`, `/become-deliver`, `/faq`, `/login` en lecture seule), en-têtes HTTP et code source public de la page d'accueil, fiche App Store de l'application (consultée le 4 octobre 2026).
