@AGENTS.md

# Speedfood — MVP réel

Ce dépôt est le code de production du portail Speedfood (Conakry), distinct du
prototype de démonstration (`docs/cadrage` en parle, le prototype lui-même vit
dans le dépôt OneDrive `...\Jarvis\speedfood\` avec la landing — voir
`docs/PROTOCOLE-COLLABORATION.md` pour la répartition exacte).

## Sources de vérité (dans ce dépôt, sous `docs/cadrage/`)

Avant toute tâche, lire dans cet ordre :

1. `docs/cadrage/TDR.md` : mandat, périmètre, règles métier, critères d'acceptation
2. `docs/cadrage/ADR.md` : décisions d'architecture (Next.js App Router + TypeScript,
   Supabase/Postgres + RLS, un restaurant = un tenant, commande invité sans paiement)
   et questions encore ouvertes
3. `docs/cadrage/PLAN-EXECUTION.md` : blocs délégables, dépendances, propriété des
   fichiers — **toujours vérifier qu'un bloc est accepté avant de démarrer le
   suivant qui en dépend**
4. `docs/cadrage/AGENT-INSTRUCTIONS.md` : brief commun et règles de sécurité pour
   toute tâche de code
5. `docs/cadrage/DESIGN-SYSTEM.md` : tokens visuels verrouillés (couleurs,
   typographie, icônes, composants) — déjà portés dans `src/app/globals.css` et
   `src/app/components.css`, ne pas les redéfinir ailleurs
6. `docs/STATUT-PROJET.md` : où en est le projet bloc par bloc, ce qui est vérifié
   contre ce qui est juste supposé, les décisions prises en cours de route
7. `docs/cadrage/SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md` (direction du 3 octobre
   2026 : recherche locale, disponibilité horodatée, alternatives, Google/téléphone,
   partage WhatsApp) et `docs/cadrage/PARCOURS-CIBLE-CLIENT-MVP.md` : **cibles
   produit**, pas état actuel. Elles prévalent sur les anciens passages pour ces
   sujets, mais ne décrivent pas ce qui existe (voir STATUT-PROJET).
8. `docs/cadrage/PROCEDURE-SECURITE.md` : procédure de livraison et portes avant
   pilote ; sa section 9 donne l'état réel de chaque porte (plusieurs sont
   bloquantes). `NOTIFICATIONS-ICONES-OUTILS.md` pour toast/push/icônes.

**En cas de contradiction entre un document et le code, ne pas trancher en
silence** : le code, `STATUT-PROJET.md`, l'ADR-011 et la section 0 de
`DESIGN-SYSTEM.md` décrivent l'application réelle. Les documents « parlent de la
démo » quand ils citent `index.html`/`localStorage` : c'est le prototype hors dépôt,
pas cette application. Les ADR 015 à 018 sont les décisions du 3 octobre
(renumérotées : l'ADR-011 désigne la commande invitée par routes serveur).

Ces fichiers sont une **copie synchronisée manuellement** depuis le dossier de
travail personnel de Malika (voir `docs/cadrage/README.md`) — c'est la référence
pour ce dépôt, pas une copie secondaire à ignorer.

## Règles non négociables (résumé de AGENT-INSTRUCTIONS.md)

- Aucune donnée sensible (mot de passe, clé, jeton) dans le code, les commits ou
  les logs. `.env.local` n'est jamais commité (voir `.gitignore`).
- L'identifiant de restaurant reçu du navigateur n'est jamais une autorisation ;
  toute vérification d'accès et tout calcul de prix se fait côté serveur ou par
  policy RLS — jamais en confiance côté client.
- Ne pas créer de service externe, compte, projet cloud, ni engager de coût sans
  consigne explicite de Malika.
- Montants GNF en entiers, jamais en flottant.
- Respecter les tokens de `DESIGN-SYSTEM.md` tels quels : ne pas réintroduire de
  dégradé décoratif hors bouton d'action principal, ne pas revenir à la couleur
  secondaire non conforme au contraste AA (`#75695F`, pas `#80736C`).
- Avant d'écrire `className="…"` dans une page ou un composant, vérifier qu'aucune
  feuille CSS existante ne définit déjà ce nom : le CSS est global (pas de modules),
  donc un nom réemployé ailleurs s'applique aussi et casse la mise en page sans
  erreur. Cas vécu le 10/10/2026 : `.choix-carte` (cartes radio de la commande,
  `src/app/marche.css`, en `display:flex` horizontal) réutilisé sur `/entrer` →
  formulaire écrasé en pilules. Règle : un nom de classe nouveau est préfixé par le
  contexte de la page (`inscription-…`, `commande-…`), et le style va dans la feuille
  CSS — pas de `style={{ … }}` pour la mise en page.
- Toute migration appliquée en base (`apply_migration`) a son fichier dans
  `supabase/migrations/`, **dans le même commit** (le dépôt doit pouvoir reconstruire
  la base ; chaque migration en base a son fichier, même nombre des deux côtés). Les policies réservées aux membres
  portent `to authenticated`, jamais aucune restriction de rôle : sinon elles sont
  évaluées pour `anon` et cassent la lecture publique voisine (`fn_est_membre_restaurant`
  n'est pas exécutable par `anon`).
- Aucun agent ne déploie en production sans feu vert explicite de Malika dans la
  conversation (`PROCEDURE-SECURITE.md`).
- Après toute migration touchant RLS ou une fonction `SECURITY DEFINER`, lancer
  `get_advisors(type: "security")` et corriger ce qui est signalé avant de
  continuer (voir l'historique Git des blocs 2 et 4 pour des exemples de ce que
  ça a déjà trouvé).
- Ce projet cible Next.js 16 : le fichier de garde de requêtes s'appelle
  `proxy.ts`, pas `middleware.ts` (déprécié). Vérifier
  `node_modules/next/dist/docs/` avant de s'appuyer sur un souvenir d'une version
  antérieure de Next.js.
