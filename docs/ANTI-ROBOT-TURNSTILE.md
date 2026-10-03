# Anti-robot à la commande (Cloudflare Turnstile)

Réponse au risque résiduel du point 9 de `REVUE-SECURITE-2026-10-03.md` : un script qui passe
des commandes valides pouvait saturer le plafond par téléphone ou par restaurant. Turnstile
demande à chaque commande une preuve que le visiteur n'est pas un robot, sans énigme à
résoudre dans la plupart des cas. Gratuit, dans le compte Cloudflare qui héberge déjà le Worker.

## État (3 octobre 2026)

- Le widget Cloudflare `speedfood` est **créé** (mode Géré, nom d'hôte
  `speedfood-app.moelohimmara.workers.dev`). Sa clé de site, publique, est déjà dans
  `wrangler.jsonc` (`TURNSTILE_SITE_KEY`).
- Le code est livré. La vérification reste **inactive** tant que le secret du Worker
  `TURNSTILE_SECRET_KEY` n'est pas posé : la commande fonctionne comme avant.
- **Reste à faire par Malika : la clé secrète seulement** (voir ci-dessous). Elle n'a pas été
  posée par un agent : la pose et la rotation d'un secret relèvent du propriétaire.
- **La clé secrète actuelle est à remplacer** : elle a été affichée par erreur dans une session de
  travail. Il faut donc la faire pivoter AVANT de la poser, ce qui rend la fuite sans effet.

## Ce que Malika doit faire pour finir (environ cinq minutes)

1. Dans le tableau de bord Cloudflare : Sécurité des applications, **Turnstile**, widget
   `speedfood`, menu « … », **Modifier le widget**.
2. Cliquer **Faire pivoter la clé secrète**, confirmer. L'ancienne clé cesse de fonctionner.
3. Cliquer **Afficher** sur la nouvelle clé secrète puis **Cliquer pour copier**. Ne la coller dans
   aucune conversation.
4. Dans un terminal, dans le dossier du projet :

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

   Coller la clé quand Wrangler la demande (rien ne s'affiche), valider.
5. Demander le déploiement dans la conversation. Un test de bout en bout en production est fait
   ensuite.

## Procédure d'origine (pour mémoire, si le widget devait être recréé)

1. Ouvrir le tableau de bord Cloudflare, section **Turnstile**, puis **Ajouter un widget**.
2. Nom : `speedfood`. Domaines : `speedfood-app.moelohimmara.workers.dev` (puis le vrai nom de
   domaine quand il existera). Mode : **Géré** (Managed). Valider.
3. Cloudflare affiche une **clé de site** (publique) et une **clé secrète** (à ne montrer à
   personne, pas même dans la conversation).
4. Poser la clé de site : dans `wrangler.jsonc`, section `vars`, ajouter
   `"TURNSTILE_SITE_KEY": "<la clé de site>"`. Cette valeur est publique.
5. Poser la clé secrète depuis un terminal, dans le dossier du projet :

   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

   Wrangler demande la valeur : la coller (rien ne s'affiche), valider.
6. Demander un déploiement. Les deux valeurs doivent exister **ensemble** : si seule la clé secrète
   est posée, le formulaire n'affiche pas de widget et plus aucune commande ne passe.

## Comportement

- Jeton valable cinq minutes et utilisable une seule fois (documentation Cloudflare) : le
  formulaire en redemande un neuf après chaque envoi.
- Si Cloudflare ne répond pas, la commande est refusée avec un message clair (échec fermé) : le
  client réessaie.
- La vérification passe avant les plafonds de débit : un jeton invalide ne consomme aucun plafond.
- Ne concerne que la création de commande. La réponse à une proposition est protégée par le jeton
  de suivi et par son plafond par adresse.

## Retour arrière

Supprimer le secret du Worker (`npx wrangler secret delete TURNSTILE_SECRET_KEY`) et redéployer :
la vérification est de nouveau désactivée.

## Limites

Turnstile réduit l'abus automatisé. Il n'empêche pas une personne réelle de passer de vraies
commandes, ni l'usurpation du numéro d'un tiers : seule une confirmation par code envoyé à ce
numéro (SMS ou WhatsApp, payant) y répondrait. À reconsidérer avec le canal de notification.
