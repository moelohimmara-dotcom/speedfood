# Brief commun pour les agents de coding — Speedfood

À copier au début de chaque tâche déléguée. Joindre le bloc ciblé de `PLAN-EXECUTION.md`.

## Mission

Tu contribues au MVP de Speedfood, un portail web français de découverte et commande auprès de restaurants à Conakry. Le TDR, les ADR, l’architecture/design, le système de design, le cahier d’exécution frontend et le plan de tâches joints sont les sources de vérité. Si une consigne locale du dépôt existe, lis-la aussi et respecte-la.

## Contrat de travail

1. Inspecte l’arborescence, l’état Git, les scripts, les conventions et les consignes locales avant toute modification. Préserve les changements déjà présents.
2. Travaille uniquement le bloc assigné et les fichiers explicitement attribués. Ne réécris pas le produit ou la pile de ton propre chef.
3. Lis les dépendances du bloc; n’invente pas un contrat d’API ou de base. Si un contrat manque, formule une proposition concise et bloque seulement la partie qui en dépend.
4. Ne crée aucun service externe, compte, projet cloud, déploiement, coût ou secret. Ne mets aucune clé dans le code. Utilise `.env.example` pour documenter les noms de variables sans valeurs réelles.
5. Ne présente pas une simulation comme intégration fonctionnelle. Les paiements, WhatsApp/SMS et livraison restent hors périmètre tant qu’ils ne sont pas explicitement autorisés et configurés.
6. L’accès, les prix et les transitions de commande doivent être validés côté serveur. L’identifiant de restaurant reçu du navigateur ne constitue jamais une autorisation.
7. Respecte accessibilité, mobile-first, français, montants GNF entiers et états de chargement/vide/erreur/succès.
   Pour l’interface, applique `DESIGN-SYSTEM.md` et `FRONTEND-DESIGN-BRIEF.md`; une direction marquée « proposée » n’est pas verrouillée tant qu’elle n’a pas été validée.
8. N’ajoute pas de dépendance sans expliquer le besoin, le coût opérationnel et l’alternative intégrée. Consulte la documentation officielle pour les versions/API qui peuvent avoir changé.
9. Ne modifie pas les migrations déjà fusionnées. Ajoute une nouvelle migration versionnée et indique les impacts de mise à niveau. Aucun changement de schéma directement dans la base Supabase de production : tout changement passe par une migration versionnée dans `supabase/migrations/`, appliquée ensuite.
10. À la fin, fournis : résumé, fichiers touchés, décisions/assumptions, commandes réellement exécutées et résultats, limites, risques ou blocages. Ne prétends jamais avoir exécuté une vérification non faite.

## Règles de sécurité minimales

- Refuser par défaut les accès non explicitement accordés.
- Pour toute lecture/écriture restaurant, vérifier le membre connecté, son rôle et son établissement sur le serveur et appliquer les règles correspondantes en base.
- N’exposer au public que les restaurants publiés et actifs, ainsi que les champs nécessaires à la découverte.
- Valider les entrées côté serveur, borner longueur/quantités, recalculer prix et total depuis la base, et utiliser des transitions d’état autorisées.
- Si prix, frais ou conditions de livraison changent après l’envoi, ne jamais confirmer ni préparer avant acceptation explicite de la proposition révisée par le client. Enregistrer les conditions proposées/acceptées et rejeter un accord sur une proposition périmée.
- Protéger l’accès de suivi client par un jeton aléatoire opaque; ne pas utiliser seulement un numéro de commande séquentiel.
- Ne pas journaliser mots de passe, clés, jetons de session/suivi, téléphone complet ou adresse complète.
- Ne jamais exposer la clé/service-role Supabase au navigateur. Les opérations privilégiées passent côté serveur.
- Ajouter la politique RLS dans la même livraison que toute table exposée; vérifier aussi les privilèges SQL.
- Maintenir une séparation stricte des rôles : membership restaurant n’accorde jamais un rôle système; séparer les surfaces `/restaurant` et `/system`.
- Toute mutation CMS vérifie une permission système spécifique côté serveur. L’accès au téléphone/adresse client est masqué par défaut; tout accès support exceptionnel exige permission, motif et audit.
- Dans la PWA, ne mettre en cache que le shell et les assets statiques versionnés. Ne pas mettre en cache les menus dynamiques, commandes, suivi, session, téléphone, adresse, pages de gestion ou CMS. Aucune mutation hors ligne ou confirmation optimiste non acquittée.

## Gestion des agents parallèles

- Un seul agent possède un fichier à la fois. Le propriétaire de tâche attribue les fichiers avant lancement.
- Les blocs en parallèle ne doivent pas toucher les mêmes fichiers de navigation, schéma, types ou composants globaux.
- Les blocs d’intégration démarrent seulement après gel du contrat de données/API concerné.
- Chaque agent rend un changement local ou une proposition claire; le propriétaire principal examine puis intègre. Ne pas créer de PR, pousser ou publier sans consigne distincte.

## Prompt d’assignation à compléter

> Réalise le bloc **[ID et titre]** de `PLAN-EXECUTION.md`. Fichiers dont tu es propriétaire : **[liste]**. Dépendances déjà acceptées : **[IDs]**. Respecte `AGENT-INSTRUCTIONS.md`, `TDR.md`, `ADR.md`, `ARCHITECTURE-DESIGN.md`, `DESIGN-SYSTEM.md`, `FRONTEND-DESIGN-BRIEF.md` et `PARCOURS-UTILISATEUR.md`. N’implémente pas les éléments hors périmètre. Critères d’acceptation à satisfaire : **[copier critères du bloc]**. À la fin, rapporte les changements, vérifications réellement réalisées, risques et décisions restant au propriétaire.
