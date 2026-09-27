@AGENTS.md

# Speedfood — MVP réel

Ce dépôt est le code de production du portail Speedfood (Conakry), distinct du prototype de démonstration.

## Sources de vérité (dans le dossier de cadrage, hors de ce dépôt)

Le cadrage produit vit dans `Jarvis/speedfood/` (OneDrive), pas ici. Avant toute tâche, lire :

- `TDR.md` : mandat, périmètre, règles métier, critères d'acceptation
- `ADR.md` : décisions d'architecture (Next.js App Router + TypeScript, Supabase/Postgres + RLS, un restaurant = un tenant, commande invité sans paiement)
- `PLAN-EXECUTION.md` : blocs délégables, dépendances, propriété des fichiers
- `AGENT-INSTRUCTIONS.md` : brief commun et règles de sécurité pour toute tâche de code
- `DESIGN-SYSTEM.md` : tokens visuels verrouillés (couleurs, typographie, icônes, composants)
- `AUDIT-BLOC-0.md` : état du dépôt au moment de la reprise

Le dossier `speedfood/prototype/` (démo cliquable sans backend) reste une **référence visuelle figée** : ne pas le modifier depuis ce dépôt, ne pas copier ses données fictives (`data.js`) comme données réelles.

## Règles non négociables (résumé de AGENT-INSTRUCTIONS.md)

- Aucune donnée sensible (mot de passe, clé, jeton) dans le code ou les logs.
- L'identifiant de restaurant reçu du navigateur n'est jamais une autorisation ; toute vérification d'accès et tout calcul de prix se fait côté serveur.
- Ne pas créer de service externe, compte, projet cloud, ni engager de coût sans consigne explicite de Malika.
- Montants GNF en entiers, jamais en flottant.
- Respecter les tokens de `DESIGN-SYSTEM.md` tels quels : ne pas réintroduire de dégradé décoratif hors bouton d'action principal, ne pas revenir à la couleur secondaire non conforme au contraste AA.
