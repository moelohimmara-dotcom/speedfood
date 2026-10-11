# Audit Logique, Sécurité et Performance — Speedfood (11 octobre 2026)

**Auditeur :** Ingénieur Produit Senior (Conakry / Remote)  
**Périmètre :** Logique métier, intégrité Supabase / RLS, sécurité Cloudflare Worker, conformité réglementaire & performance réseau Conakry.  

---

## 1. Sécurité et Contrôle d'Accès

### S-01 (Majeur) — Exposition potentielle des jetons de suivi dans les journaux d'invocation Cloudflare
- **Constat vérifié :**
  - Les commandes invitées génèrent un jeton unique HMAC SHA-256 dans l'URL : `/suivi/[jeton]`.
  - Cloudflare Worker a `logs.invocation_logs` activé avec conservation sur 7 jours. Le masquage natif Cloudflare ne masque que les query strings (`?token=...`), pas les fragments de chemin (`/suivi/...`).
  - Toute personne ayant accès aux logs du compte Cloudflare (ou via token API partagé) peut lire les jetons et accéder aux adresses, numéros de téléphone et contenus de commandes en cours.
- **État actuel :** Risque consigné comme « accepté provisoirement » dans `STATUT-PROJET.md` le 7 octobre 2026.
- **Limite technique constatée :** `proxy.ts` et les handlers OpenNext ne contrôlent pas la collecte des URLs par les journaux d'invocation Cloudflare ; ils peuvent éviter les logs applicatifs, mais pas réécrire l'URL déjà observée par la plateforme. La configuration actuelle masque les query strings, pas les paramètres de chemin.
- **Décision requise avant lancement élargi :** vérifier dans l'offre et la configuration Cloudflare disponibles s'il existe une redaction des chemins avant persistance. À défaut, le vrai correctif est un redesign du lien de suivi (par exemple identifiant public non suffisant seul + échange serveur contre une session courte), avec migration des liens existants. Ne pas présenter une modification de `proxy.ts` comme solution à ce risque.

### S-02 (Majeur) — Portée excessive et rotation attendue des jetons d'API Cloudflare
- **Constat vérifié :**
  - Le jeton d'accès Cloudflare partagé précédemment a un scope étendu à l'ensemble du compte (englobant d'autres applications : `batipilot`, `garage-auto-hr`, `lucepress-gestion`) sans restriction au seul Worker `speedfood-app`.
  - La rotation et la restriction de ce jeton doivent être faites manuellement par le propriétaire sur le tableau de bord Cloudflare.

### S-03 (Majeur) — Vulnérabilité `braces` / `micromatch` dans l'arbre d'outillage
- **Constat vérifié :**
  - `npm audit` remonte 5 vulnérabilités de sévérité **High** (DDoS / stack-exhaustion via `braces` <=3.0.3 dans la chaîne `eslint-config-next` / `@next/eslint-plugin-next` / `micromatch`).
  - **Impact en production :** Nul, car `eslint-config-next` est en `devDependencies` et n'est pas injecté dans le bundle client/serveur du Worker généré par OpenNext. Mais à assainir pour la sécurité de la CI/CD.

### S-04 (Conforme) — Respect strict des montants GNF et RLS Supabase
- **Constat vérifié :**
  - Toutes les colonnes de montants (`total_gnf`, `prix_gnf`, `frais_livraison_gnf`) sont stockées et manipulées sous forme d'entiers stricts (`BIGINT` / `INTEGER` / `Math.round`). Aucun calcul monétaire en virgule flottante JavaScript n'est admis.
  - Les 62 migrations Supabase appliquent bien les règles RLS `to authenticated` pour les accès réservés et ne cassent pas les accès anonymes (`anon`).

---

## 2. Logique Métier

### L-01 (Majeur) — Couverture des alertes de commande sur les restaurants publiés
- **Constat vérifié :**
  - Sur les 13 restaurants publiés en catalogue, l'indicateur d'alertes (« alerte push / page fermée ») est à 0 / 13.
  - Dans le contexte de Conakry (coupures d'électricité, connexions instables), un restaurateur qui ne reçoit pas de push risque de manquer la commande, ce qui conduit à l'expiration de la proposition sous le délai imparti (`COMMANDE_PROPOSITION_DELAI_MINUTES`).
- **Correction recommandée :** Rendre la configuration d'un numéro d'alerte WhatsApp / SMS ou l'activation de la notification push obligatoire avant le passage du statut d'un restaurant à `publié`.

### L-02 (Majeur) — Présence de restaurants de test en base de production
- **Constat vérifié :**
  - La base recense 4 restaurants créés à des fins de test (dont « barbie food »).
  - « barbie food » est non publiée mais ouverte aux commandes, ce qui valide l'isolation, mais encombre les rapports d'audit de la console super-administrateur.
- **Recommandation :** Procéder à l'archivage ou la suppression propre (avec accord explicite préalable) avant le lancement officiel du pilote.

---

## 3. Performance (Contexte Conakry 3G/4G)

### P-01 (Vérifié) — Poids du bundle et génération statique
- **Résultats de compilation (`npm run cf:build`) :**
  - 51 routes statiques et dynamiques compilées sans anomalie.
  - Bundle Worker OpenNext généré dans `.open-next\worker.js` (taille gzip ~3.3 Mo, démarrage à froid ~26ms sur Cloudflare Workers).
  - Feuilles de styles principales optimisées et préchargées (`Link: rel=preload; as="style"`).
- **Point de vigilance :** Le chargement des images de plats depuis Supabase Storage doit systématiquement utiliser le format WebP et un redimensionnement adapté au viewport mobile pour limiter la consommation de données mobiles des clients guinéens.

---

## 4. Ce qui a été vérifié vs ce qui reste supposé

| Élément | Statut | Justification |
|---|:---:|---|
| Réponse HTTP 200 Worker Cloudflare | **Vérifié** | Test réseau direct (`curl -I`) |
| Réponse HTTP 401 Supabase REST (sans clé) | **Vérifié** | Test réseau direct (`curl -I`) |
| Absence d'erreur de types TypeScript | **Vérifié** | `tsc --noEmit` avec code retour 0 |
| Suite de tests unitaires (74 tests) | **Vérifié** | `npm run test:unit` validé à 100% |
| Lint ESLint | **Vérifié** | 0 erreur, 8 avertissements mineurs |
| Compilation Cloudflare Worker | **Vérifié** | `npm run cf:build` réussi |
| Isolation effective des 4 rôles système | **Supposé** | Comptes `operations`, `content_editor`, `support` non fournis |
