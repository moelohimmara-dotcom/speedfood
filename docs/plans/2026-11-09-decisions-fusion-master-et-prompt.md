# Préparation des décisions : fusion dans master et fichier de prompt — 9 novembre 2026

> **Analyse en lecture seule : rien n'est fusionné, rien n'est réécrit, rien n'est poussé par ce document.** Chaque opération ci-dessous exige un « oui » distinct et explicite de Malika (voir aussi `docs/plans/2026-11-06-decisions-suite-appli.md`). Constats relevés le 9 novembre 2026 après `git fetch`.

## 1. Fusion de la branche `etape-adr021-deblocage-commandes` dans `master`

### Constats
- La branche a **101 commits d'avance** sur `origin/master` et **0 de retard** : `master` n'a pas bougé depuis le point de départ (`63a95b8`). Une fusion se ferait en avance rapide, sans commit de fusion et sans conflit (contrôle `git merge-tree` : aucun conflit).
- Elle contient tout le chantier : lots A à D5, notifications E1 à E3 et F, protocole I2, livreur G1 et G2, refonte du site public (phase 1), mais aussi des travaux antérieurs d'ADR-021.
- **Fusionner ne déploie rien** par soi-même (le déploiement reste une commande séparée, `cf:deploy` ou `wrangler deploy`). Mais `master` devient alors la référence : tout agent qui part de `master` reprend ces 101 commits.
- Production : l'API a été déployée trois fois depuis le 8 novembre ; la version du site n'a pas été relue. L'identité exacte du code en ligne n'est pas prouvée (voir `PASSATION-CHANTIER-SPEEDFOOD-APP.md` §3).
- Le relais « commandes » du site vers l'API doit rester éteint ; la fusion ne change aucune variable d'environnement.

### Avant de fusionner (je peux le préparer sur demande, sans fusionner)
1. Relancer toutes les suites sur `HEAD` (déjà fait aujourd'hui : tout est vert, voir la passation).
2. Décider du sort de `docs/PROMPT-CODEX-CHEF-DE-PROJET.md` (section 2), **avant** la fusion : après la fusion, le retirer de l'historique de `master` serait une réécriture beaucoup plus grave.
3. Garder les fichiers non suivis de Malika hors du dépôt (`.tmp-*`, `supabase/.temp/`) : ils ne sont pas concernés par une fusion.

### Options
| Option | Effet | Risque | Recommandation |
|---|---|---|---|
| F1. Fusion en avance rapide dans `master` (`git merge --ff-only`), poussée de `master` | `master` = la branche, historique linéaire conservé | Faible techniquement ; `master` reçoit tout d'un coup | Après décision de la section 2 |
| F2. Pull request sur GitHub puis fusion (fusion classique ou « squash ») | Relecture visible ; un « squash » aplatirait les 101 commits | Un squash fait perdre l'historique par lot utile à la reprise | Préférer F1 ou une PR sans squash |
| F3. Ne pas fusionner pour l'instant | Rien ne change | Les agents doivent partir de la branche de travail (comme aujourd'hui) | Acceptable tant que le prompt de reprise le dit |

## 2. Fichier `docs/PROMPT-CODEX-CHEF-DE-PROJET.md`

### Constats
- Fichier de **11 626 octets, ajouté par erreur dans le commit `744ec55`** (message « restitue les noms de fichiers du compte rendu E3 », deux fichiers : ce prompt et le plan des notifications). Il est suivi par Git à `HEAD`.
- Il n'existe **que sur la branche de travail** (`origin/etape-adr021-deblocage-commandes`) : absent de `master`, absent des autres branches distantes.
- **25 commits** ont été faits après `744ec55` sur la même branche.
- Recherche de motifs de vraies clés dans son contenu (jetons, clés privées, longues chaînes encodées) : **aucun**. Les mots « secret » et « mot de passe » n'y figurent que dans des règles (« jamais de mot de passe… »). Aucune clé n'est donc à révoquer.

### Options
| Option | Ce que ça fait | Conséquences | Recommandation |
|---|---|---|---|
| P1. **Le laisser** | Rien | Un fichier de consignes personnelles reste visible dans le dépôt privé et dans l'historique ; aucun secret exposé | Acceptable si le dépôt est privé et que le fichier ne gêne pas |
| P2. **Le retirer du dernier état seulement** (`git rm` puis un commit normal) | Disparaît de `HEAD`, **reste dans l'historique** | Aucun risque ; pas de réécriture ; pas de force-push | **Recommandé** si le contenu n'est pas sensible |
| P3. **Le retirer de tout l'historique** (réécriture des 26 commits depuis `744ec55`, puis `git push --force-with-lease`) | Disparaît partout | Tous les identifiants de commit après `744ec55` changent ; les références écrites dans les documents (`744ec55`, `57f80f1`, `e996900`…) et les liens CI deviennent faux ; toute copie locale d'un autre agent diverge ; opération irréversible côté distant | Seulement si le contenu est réellement sensible ; **jamais** après la fusion dans `master` |

Je n'ai pas lu ni affiché le contenu du fichier au-delà des contrôles de motifs ci-dessus. Malika peut le relire elle-même et trancher.

### Si P3 est choisi (procédure à n'exécuter qu'avec un « oui » explicite, jamais seule)
1. Sauvegarder la branche (`git branch sauvegarde-avant-reecriture`), pousser cette sauvegarde sous un autre nom.
2. Réécrire avec `git filter-repo` ou un rebase interactif limité à `744ec55^..HEAD` pour retirer ce seul fichier ; vérifier que l'arbre final est identique sauf ce fichier (`git diff sauvegarde..HEAD --stat`).
3. Relancer les suites ; pousser avec `--force-with-lease` sur la seule branche de travail ; mettre à jour les identifiants cités dans `PASSATION-CHANTIER-SPEEDFOOD-APP.md` et les plans.

## 3. Nettoyage des restes d'espèces
Voir `docs/plans/2026-11-09-inventaire-restes-especes.md` : inventaire fait, zéro ligne en base, lot N1 (code seulement) proposé, deux questions (D1, D2).

## Ordre recommandé
1. **P2** (retirer le fichier du dernier état, sans réécriture) — ou P1 si tu préfères le laisser.
2. **F1** (avance rapide dans `master`) seulement ensuite, et seulement si tu veux que `master` devienne la référence.
3. **N1** (nettoyage des espèces, code seulement) après tes réponses D1 à D3.

## Décisions demandées à Malika
- **Prompt :** P1 (laisser), P2 (retirer du dernier état) ou P3 (réécrire l'historique) ?
- **Fusion :** F1, F2 ou F3 ?
- **Espèces :** voir D1, D2, D3 de l'inventaire.
