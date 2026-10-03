# Brief commun pour les agents de coding — Speedfood

À copier au début de chaque tâche déléguée. Joindre le bloc ciblé de `PLAN-EXECUTION.md`.

## Mission

Tu contribues au MVP de Speedfood, un portail web français de découverte et commande auprès de restaurants à Conakry. Le TDR, les ADR, l’architecture/design, le système de design, le cahier d’exécution frontend, le plan de tâches, `SPEC-PILOTE-DISCOVERY-IDENTITE-DESIGN.md`, `PARCOURS-CIBLE-CLIENT-MVP.md` et `NOTIFICATIONS-ICONES-OUTILS.md` sont les sources de vérité. Les nouveaux documents contiennent les décisions récentes; le parcours cible explique comment évoluer depuis la démo existante sans jeter ses éléments utiles. Ils prévalent sur les passages antérieurs en contradiction. Si une consigne locale du dépôt existe, lis-la aussi et respecte-la.

## Contrat de travail

1. Inspecte l’arborescence, l’état Git, les scripts, les conventions et les consignes locales avant toute modification. Préserve les changements déjà présents.
2. Travaille uniquement le bloc assigné et les fichiers explicitement attribués. Ne réécris pas le produit ou la pile de ton propre chef.
3. Lis les dépendances du bloc; n’invente pas un contrat d’API ou de base. Si un contrat manque, formule une proposition concise et bloque seulement la partie qui en dépend.
4. Ne crée aucun service externe, compte, projet cloud, déploiement, coût ou secret. Ne mets aucune clé dans le code. Utilise `.env.example` pour documenter les noms de variables sans valeurs réelles.
5. Ne présente pas une simulation comme intégration fonctionnelle. Le partage sortant vers WhatsApp est prévu; les messages automatisés, WhatsApp Business API, commandes synchronisées, paiement et livraison restent hors périmètre tant qu’ils ne sont pas explicitement autorisés et configurés. L’OTP téléphone est conditionné à un fournisseur SMS validé pour la Guinée.
6. L’accès, les prix et les transitions de commande doivent être validés côté serveur. L’identifiant de restaurant reçu du navigateur ne constitue jamais une autorisation.
7. Respecte accessibilité, mobile-first, français, montants GNF entiers et états de chargement/vide/erreur/succès.
   Pour l’interface, applique `DESIGN-SYSTEM.md` et `FRONTEND-DESIGN-BRIEF.md`; une direction marquée « proposée » n’est pas verrouillée tant qu’elle n’a pas été validée.
8. Applique `PROCEDURE-SECURITE.md` pour tout changement. N’accepte ni ne demande de secrets de production ou de données client réelles; aucun agent ne déploie directement en production. Toute modification d’authentification, d’autorisation, de données personnelles, de commandes, de rôles, de migrations, de cache ou de configuration est signalée et revue indépendamment.
9. N’ajoute pas de dépendance sans expliquer le besoin, le coût opérationnel et l’alternative intégrée. Consulte la documentation officielle pour les versions/API qui peuvent avoir changé.
10. Ne modifie pas les migrations déjà fusionnées. Ajoute une nouvelle migration versionnée et indique les impacts de mise à niveau. Aucun changement de schéma directement dans la base Supabase de production sans le fichier correspondant dans `supabase/migrations/` : le fichier et l'application en base vont ensemble, et une migration touchant RLS ou une fonction `SECURITY DEFINER` est suivie de `get_advisors(type: "security")`.
11. À la fin, fournis : résumé, fichiers touchés, décisions/assumptions, commandes réellement exécutées et résultats, limites, risques ou blocages. Ne prétends jamais avoir exécuté une vérification non faite.
12. Pour la recherche, respecte les groupes exact/disponible, exact/à confirmer, équivalent confirmé et suggestions. Affiche l’horodatage de disponibilité; ne promets jamais stock, distance, livraison ou commande confirmée que Speedfood ne connaît pas.
13. Il existe deux bases de travail distinctes : le **prototype** (démo HTML/CSS/JS hors dépôt, données fictives) et l'**application réelle** de ce dépôt (Next.js + Supabase, déjà en production). Les consignes sur « la démo » concernent le prototype comme référence d'interaction ; tout code se fait dans l'application réelle, qu'il faut inspecter avant de la modifier (`docs/STATUT-PROJET.md` donne l'état bloc par bloc). Conserve les éléments utiles et distingue explicitement les actions fictives des fonctions connectées. Simplifie le parcours au lieu d’ajouter des étapes. Favorise une habitude de retour utile et volontaire; n’ajoute pas de dark patterns, de notifications insistantes ou de preuves sociales inventées.
14. Distingue toast, confirmation, centre in-app et push. Ne demande pas l’autorisation push au premier chargement; ne la demande qu’après une action volontaire qui explique l’intérêt. Une push ne change jamais à elle seule l’état d’une commande.

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

> Réalise le bloc **[ID et titre]** de `PLAN-EXECUTION.md`. Fichiers dont tu es propriétaire : **[liste]**. Dépendances déjà acceptées : **[IDs]**. Respecte `AGENT-INSTRUCTIONS.md`, `PROCEDURE-SECURITE.md`, `TDR.md`, `ADR.md`, `ARCHITECTURE-DESIGN.md`, `DESIGN-SYSTEM.md`, `FRONTEND-DESIGN-BRIEF.md` et `PARCOURS-UTILISATEUR.md`. N’implémente pas les éléments hors périmètre. Critères d’acceptation à satisfaire : **[copier critères du bloc]**. À la fin, rapporte les changements, vérifications réellement réalisées, risques et décisions restant au propriétaire. Si le bloc touche la sécurité ou des données réelles, joins le rapport de sécurité indépendant requis.
