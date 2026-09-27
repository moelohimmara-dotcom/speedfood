# Statut du projet — pour reprise par un autre développeur

**Dernière mise à jour : 27 septembre 2026.** Ce document existe pour qu'une
personne qui n'a jamais touché ce projet puisse comprendre en 5 minutes où ça en
est, ce qui est vérifié contre ce qui est juste supposé, et par où continuer.

## Projet Supabase

- ID : `ggldjdizqrtpetdiohxy`, région `eu-west-1` (Irlande — pas `eu-west-3`/Paris
  qui aurait été légèrement plus proche de Conakry ; le projet a été créé
  manuellement par Malika et ce choix a été accepté tel quel plutôt que de
  recréer un projet, voir historique Git du bloc 1)
- Compte : `mistermarcket@gmail.com`
- **Deux réglages d'Auth ont été changés à la main dans le dashboard Supabase,
  aucun outil ne permet de les gérer par migration ou API MCP :**
  - "Confirm email" est **désactivé** (compte actif immédiatement après
    inscription, sans clic sur un lien reçu par email). À reconsidérer avant un
    vrai pilote public — voir plus bas.
  - "Leaked password protection" (HaveIBeenPwned) est encore **désactivée** au
    27/09/2026, signalé par l'audit de sécurité Supabase. Recommandé de
    l'activer avant le pilote.

## Ce qui est fait, bloc par bloc (voir `docs/cadrage/PLAN-EXECUTION.md`)

| Bloc | Contenu | Statut | Vérifié comment |
|---|---|---|---|
| 0 | Audit du dépôt de départ | Fait | `docs/cadrage/AUDIT-BLOC-0.md` |
| 1 | Socle Next.js, contrats TypeScript, tokens de design | Fait | `npm run typecheck`/`lint`, rendu visuel dans le navigateur |
| 2 | Schéma Supabase (14 tables), RLS, isolation tenant | Fait | Requêtes REST réelles avec la clé anon (restaurant non publié invisible, `orders` vide, RPC interne refusé) |
| 3 | Composants UI partagés (bouton, champ, carte, badge, alerte) | Fait, sous-ensemble volontaire | Rendu visuel dans le navigateur |
| 4 | Authentification, onboarding restaurateur | Fait | **Deux comptes réels créés**, isolation confirmée à l'écran (le compte B ne voit jamais le restaurant du compte A) |
| 5 | Catalogue public connecté | En cours | — |
| 6 | Console restaurant (menu, commandes, horaires) | Pas commencé | — |
| 7 | Panier, commande, suivi client | Pas commencé | — |
| 8 | CMS système | Pas commencé (tables prêtes avec RLS restrictive, aucun écran) | — |
| 9 | PWA installable | Pas commencé | — |
| 10 | Notifications pilote | Bloqué par design (ADR-007) tant que le canal n'est pas choisi avec de vrais restaurateurs | — |
| 11 | Préproduction / lancement | Pas commencé | — |

## Décisions prises en cours de route (pas dans les documents de cadrage d'origine)

- **Inscription restaurateur** : auto-inscription libre (email + mot de passe),
  restaurant créé non publié par défaut, validation manuelle par un admin en
  attendant le vrai CMS d'invitation. Confirmé par Malika (répondait à la
  question ouverte #2 de `ADR.md`). Il n'existe **aucun écran admin** pour
  publier un restaurant pour l'instant — ça se fait à la main en SQL
  (`update restaurants set publie = true where id = '...'`) jusqu'au bloc 8.
- **Next.js 16** utilise `proxy.ts`, pas `middleware.ts` (renommage de la
  plateforme elle-même, sans rapport avec ce projet). Voir
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Fonctions `SECURITY DEFINER`** (`fn_est_membre_restaurant`,
  `fn_est_admin_systeme`, `fn_creer_restaurant_et_owner`) : Supabase accorde par
  défaut l'exécution au rôle `anon` à la création d'une fonction, même après un
  `REVOKE ... FROM PUBLIC`. Il faut un `REVOKE ... FROM anon` explicite en plus.
  Repéré deux fois par `get_advisors(type: "security")` (blocs 2 et 4) — **lancer
  systématiquement cette vérification après toute migration touchant une
  fonction ou une policy RLS.**
- **Données de seed** : `supabase/seed.sql` contient des lignes préfixées
  `[DEV]`, déjà appliquées au projet Supabase actuel (pas seulement au fichier
  local). Volontairement différentes des données du prototype de démonstration.

## Ce qui n'est pas testé / connu comme incomplet

- Aucun test automatisé (unitaire, intégration, e2e) n'existe encore. Toute la
  vérification jusqu'ici s'est faite manuellement (navigateur + requêtes REST
  directes), documentée dans les messages de commit Git.
- Aucun écran admin/CMS (bloc 8) : impossible de publier un restaurant ou gérer
  un rôle système autrement qu'en SQL direct.
- Aucune route serveur de commande (bloc 7) : `orders` et tables liées existent
  en base avec RLS, mais rien ne les écrit encore.
- Pas de CI/CD.

## Comment vérifier soi-même que tout est toujours cohérent

```bash
npm run typecheck
npm run lint
npm run dev   # puis tester manuellement /connexion, /inscription, /restaurant
```

Pour vérifier la RLS indépendamment du code applicatif (utile après toute
modification de policy) :

```bash
# Doit renvoyer uniquement les restaurants publiés
curl -s "https://ggldjdizqrtpetdiohxy.supabase.co/rest/v1/restaurants?select=nom,publie" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# Doit renvoyer un tableau vide (aucune policy anon sur les commandes)
curl -s "https://ggldjdizqrtpetdiohxy.supabase.co/rest/v1/orders?select=*" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```
