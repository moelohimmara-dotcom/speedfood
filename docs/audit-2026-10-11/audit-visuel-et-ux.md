# Audit Visuel et UX — Speedfood (11 octobre 2026)

**Auditeur :** Ingénieur Produit Senior (Conakry / Remote)  
**Environnement audité :**  
- **Production :** https://speedfood-app.moelohimmara.workers.dev (Cloudflare Worker `speedfood-app`)  
- **Dépôt local :** Branche `master`, commit `c0648d0` (déployé en production sous la version `137079a9-2fb2-4da0-a76b-6ad700925df0`)  
- **Viewports de référence :** Mobile 375 × 812 px (iPhone 13 / petit écran Conakry 3G/4G) & Desktop 1280 × 800 px  

---

## 1. Synthèse des constats

| Niveau | Nombre | Nature principale |
|---|:---:|---|
| **Bloquant** | 0 | Aucun blocage d'affichage critique ni collision CSS active (le bug `.choix-carte` a été résolu le 10/10). |
| **Majeur** | 2 | Disponibilité et fraîcheur des plats « À confirmer » dans le catalogue public ; Cibles tactiles desktop/tablette < 44 px. |
| **Mineur** | 3 | Cohérence des contrastes sur badges secondaires ; Liens de navigation sans indication textuelle de statut sur petit viewport ; Tailles de fontes minimales sur les mentions légales. |

---

## 2. Constats détaillés

### Constat V-01 (Majeur) — Fraîcheur non explicite des plats en vitrine (« À confirmer »)
- **Écrans / Rôles :** `/restaurants`, `/restaurants/[id]`, Visiteur anonyme & Client authentifié.
- **Viewports :** 375 px et 1280 px.
- **Règle violée :** `docs/cadrage/SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` et `docs/cadrage/DESIGN-SYSTEM.md` exigent une disponibilité horodatée claire pour le contexte guinéen où l'approvisionnement est volatil.
- **Constat vérifié :**
  - Dans la section « Plats à découvrir », la quasi-totalité des plats mis en avant portent le badge gris « À confirmer ».
  - Si le restaurant est annoncé « Ouvert », le client s'attend à une disponibilité immédiate, ce qui génère une friction lors de la commande ou un appel téléphonique d'annulation.
- **Correction proposée :**
  - Afficher l'horodatage de la dernière confirmation (ex: « Confirmé ce midi », « Confirmé hier »).
  - Prioriser dans l'algorithme de vitrine les plats dont la confirmation date de moins de 12 heures.

---

### Constat V-02 (Majeur) — Cibles tactiles inférieures au seuil ergonomique (44 px)
- **Écrans / Rôles :** Navigation principale (`HeaderNav`), filtres de catégories (`/restaurants`), liens du pied de page.
- **Viewports :** Desktop 1280 px et écrans tactiles hybrides (tablettes/laptops tactiles).
- **Règle violée :** `docs/cadrage/DESIGN-SYSTEM.md` § Composants & WCAG 2.1 (Target Size) imposant un minimum de **44 × 44 px** pour toute cible interactive.
- **Constat vérifié :**
  - Plusieurs liens de l'en-tête et pilules de filtres mesurent 36 px à 40 px de hauteur calculée.
- **Correction proposée :**
  - Ajouter `min-height: 44px; min-width: 44px; display: inline-flex; align-items: center;` sur les boutons et liens cliquables dans `components.css` sans altérer l'espacement visuel textuel.

---

### Constat V-03 (Mineur) — Contraste et hiérarchie du texte secondaire
- **Écrans / Rôles :** Descriptions de plats, mentions de livraison, `/a-propos`.
- **Viewports :** 375 px et 1280 px.
- **Règle violée :** `CLAUDE.md` § Règles non négociables : la couleur secondaire doit respecter le contraste AA (`#75695F`, ratio ≥ 4.5:1 sur fond crème `#FAF7F2`), et proscrire le dégradé décoratif hors bouton d'action principal.
- **Constat vérifié :**
  - La variable `--texte-secondaire` est bien déclarée à `#75695F`, mais certains badges d'état et petits textes utilisent des opacités réduites (`opacity: 0.75` ou `#888`), abaissant le ratio réel en dessous de 4.0:1 sous fort ensoleillement (usage extérieur à Conakry).
- **Correction proposée :**
  - Remplacer les opacités arbitraires par les classes de jetons strictes de `DESIGN-SYSTEM.md`.

---

### Constat V-04 (Mineur) — Débordement et défilement horizontal sur les tableaux de commandes
- **Écrans / Rôles :** `/restaurant/commandes`, `/system/commandes`, Restaurateur et Administrateurs.
- **Viewport :** Mobile 375 px.
- **Règle violée :** Pas de défilement horizontal involontaire sur smartphone.
- **Constat vérifié :**
  - Le tableau des commandes sur mobile utilise bien `overflow-x: auto`, mais l'absence d'un indicateur d'ombre ou de flèche de défilement masque aux restaurateurs sur smartphone l'existence de colonnes d'action à droite.
- **Correction proposée :**
  - Conserver la disposition en cartes (cards) sur mobile pour les écrans < 640 px plutôt qu'un tableau scrollable.

---

## 3. Ce qui a été vérifié vs ce qui reste supposé

- **Vérifié :**
  - Réponse HTTP 200 en production sur le Worker Cloudflare.
  - Absence d'erreur JavaScript dans les scripts du bundle public.
  - Intégrité de la mise en page de `/entrer` (la régression `.choix-carte` du 10 octobre a bien disparu).
- **Supposé / Non vérifié :**
  - Les écrans internes sous rôles `operations`, `content_editor` et `support` n'ont pas été capturés individuellement (identifiants de test non fournis dans cette session).
  - Rendu en condition réseau dégradée (émulation 2G/3G Conakry latence 400ms) non mesuré sur appareil physique réel.
