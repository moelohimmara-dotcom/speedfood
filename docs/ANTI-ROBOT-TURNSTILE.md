# Anti-robot à la commande (Cloudflare Turnstile)

Réponse au risque résiduel du point 9 de `REVUE-SECURITE-2026-10-03.md` : un script qui passe
des commandes valides pouvait saturer le plafond par téléphone ou par restaurant. Turnstile
demande à chaque commande une preuve que le visiteur n'est pas un robot, sans énigme à
résoudre dans la plupart des cas. Gratuit, dans le compte Cloudflare qui héberge déjà le Worker.

## État

Le code est livré et **inactif**. Il s'active quand les deux valeurs ci-dessous existent. Tant
qu'elles n'existent pas, la commande fonctionne comme avant.

## Ce que Malika doit faire (une fois, environ dix minutes)

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
