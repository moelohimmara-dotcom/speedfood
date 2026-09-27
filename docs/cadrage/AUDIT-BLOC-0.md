# Bloc 0 — Audit du dépôt et reprise du prototype

**Date :** 27 septembre 2026
**Agent :** audit, aucune modification de fichier existant.

## 1. État du dépôt

- **Git : absent.** Aucun `.git` dans `speedfood/` ni dans le workspace `Jarvis/`. Tout le travail repose sur OneDrive (historisation de synchronisation, pas de versions).
- **Contenu :** 9 fichiers de cadrage + 2 applis statiques.

| Élément | Fichiers | Lignes JS/CSS/HTML | État |
|---|---|---|---|
| Prototype | `prototype/` (index.html, app.js, data.js, styles.css, README) | 982 JS, 1353 CSS | Syntaxe JS validée (Node), sans backend, localStorage, données fictives |
| Landing | `landing/` (index.html, app.js, styles.css) | 39 JS, 424 CSS | Statique, formulaire stocké en local |

- **Pile actuelle :** HTML/CSS/JavaScript pur, aucune dépendance, aucun `package.json`, aucun outil de build/test/lint.
- **Environnement disponible :** Node v26.7.0, npm 11.19.0 installés. Git disponible en ligne de commande (binaire présent, dépôt absent).

## 2. Écart avec le plan

Le `PLAN-EXECUTION.md` (bloc 0) situe le prototype dans `outputs/portail-restaurants`. **Il se trouve en réalité dans `speedfood/prototype/`**, et le produit a été renommé « Bon » → « Speedfood » dans certains fichiers de cadrage (TDR, ADR parlent encore de « Bon » ; README et PLAN parlent de Speedfood). Aucune branche, aucun asset de design séparé, pas de `DESIGN-SYSTEM.md` dans ce workspace alors que le bloc 3 le référence.

## 3. Ce qui est réutilisable pour le MVP (block 1+)

Réutilisable sans risquer de transporter des données fictives :
- Le **vocabulaire et la structure des écrans** du prototype (accueil/recherche, fiche restaurant, panier mono-restaurant, checkout, suivi, espace restaurant) : modèle mental validé pour les blocs 3, 5, 6, 7.
- La **sémantics des statuts** (`en_attente`, `acceptee`, `prete`, `terminee`, `refusee`) conforme au TDR.
- Les règles affichées : prix GNF entier, adresse conditionnelle à la livraison, réinitialisation des données démo.

À ne pas transporter : `data.js` (restaurants/prix/note/emoji fictifs), toute valeur affichée dans le prototype.

## 4. Risques de reprise

1. **Pas de Git.** Deux agents ne peuvent pas cohabiter proprement sans versions. Avant le bloc 1 : `git init`, commit initial, convention de commits.
2. **Incohérence de nommage** Bon/Speedfood dans TDR.md, ADR.md, CADRAGE.md. À harmoniser avant de déléguer les blocs.
3. **`DESIGN-SYSTEM.md` référencé (bloc 3) mais absent** du dépôt : le bloc 3 ne peut pas démarrer sans lui.
4. **OneDrive synchronise le dossier** : un socle Next.js (`node_modules` centaines de milliers de fichiers + `.next`) dans OneDrive est lent à synchroniser et fragile. Recommandation : code du MVP dans un dossier local hors OneDrive (ex. `C:\Users\moelo\dev\speedfood`), docs de cadrage restent dans Jarvis.
5. **Aucune intégration continue** : acceptable au MVP, noter comme non-bloquant.

## 5. Plan de migration proposé

1. **Immédiat :** `git init` + commit initial dans `speedfood/`, harmonisation Bon → Speedfood dans les 3 fichiers de cadrage,))
   création de `DESIGN-SYSTEM.md` ou report du bloc 3.
2. **Bloc 1 :** nouveau projet Next.js App Router + TypeScript dans un dépôt dédié hors OneDrive ; le dossier `speedfood/prototype/` reste référence visuelle figée (cesser de l'éditer).
3. **Blocs 2+ :** schéma Supabase/RLS, puis reprise progressive des écrans sans copier les données fictives.

## 6. Questions bloquantes

**Mise à jour (27 septembre 2026, après audit Supabase) :** la pile est tranchée — Next.js App Router + TypeScript (ADR-002) et Supabase managé (ADR-003, projet `ggldjdizqrtpetdiohxy`). Git est initialisé; `DESIGN-SYSTEM.md` existe; les noms sont harmonisés en « Speedfood ». Voir `AUDIT-SUPABASE.md` pour l’état de la base. Restent ouvertes les questions 2 (emplacement du code MVP) et 5 (validations terrain).

1. Valides-tu `git init` dans `speedfood/` ? *(fait)*
2. Le code MVP doit-il vivre hors OneDrive (recommandé) ? Si oui, quel chemin ?
3. Harmoniser les noms (Bon → Speedfood) : oui ?
4. `DESIGN-SYSTEM.md` : il manque ; qui le produit (toi ou le bloc 3) ?
5. Prochaines validations terrain (paiement, livraison, canal notif, segment) : toujours planifiées avant bloc 10, ou tu veux avancer le socle en parallèle ?
