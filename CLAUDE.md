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
- Après toute migration touchant RLS ou une fonction `SECURITY DEFINER`, lancer
  `get_advisors(type: "security")` et corriger ce qui est signalé avant de
  continuer (voir l'historique Git des blocs 2 et 4 pour des exemples de ce que
  ça a déjà trouvé).
- Ce projet cible Next.js 16 : le fichier de garde de requêtes s'appelle
  `proxy.ts`, pas `middleware.ts` (déprécié). Vérifier
  `node_modules/next/dist/docs/` avant de s'appuyer sur un souvenir d'une version
  antérieure de Next.js.
