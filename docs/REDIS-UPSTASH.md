# Redis (Upstash, offre gratuite) : limitation de débit (30 octobre 2026)

Décision de Malika (30 octobre 2026) : insérer Upstash Redis, offre gratuite, dans l'architecture, avant la migration vers React Native. Elle compte monter en gamme plus tard.

## Ce que Redis fait, et ne fait pas

- **Fait** : la limitation de débit (essais de connexion, commandes, mot de passe oublié…). Une action qui avait besoin de 3 ou 4 appels à la base envoie maintenant **une seule requête groupée** à Redis.
- **Ne fait pas** : il n'est **jamais la source de vérité** (tout est reconstruit depuis Supabase), ne garde ni sessions ni argent, et l'application mobile ne lui parle **jamais** (seul le Worker, avec des secrets).
- **Cache des lectures publiques** : volontairement pas fait maintenant. Les routes concernées ont déjà un cache HTTP (ex. `/api/v1/aide`, 5 minutes) et l'application lit le catalogue directement chez Supabase : Redis n'y apporterait presque rien. Il entrera avec l'API du catalogue (architecture cible), où il servira à invalider le cache de tous les téléphones quand un menu change.
- **Anti-doublon d'envoi** (clé d'idempotence) : option laissée pour plus tard ; la base le fait déjà.

## Ce qui se passe en cas de panne

Tant que les deux secrets ci-dessous ne sont pas posés, **rien ne change** : la limitation reste dans la base (`fn_limiter_debit`). Une fois posés, si Redis est injoignable, trop lent (500 ms), refuse le jeton ou atteint la limite de l'offre gratuite, le Worker écrit `redis_indisponible_repli_base` dans ses journaux et **retombe sur la base**. Une commande n'est jamais refusée à cause de Redis. Interrupteur de secours sans toucher au code : définir `LIMITEUR_REDIS` à `non`.

## À faire par Malika (aucun agent ne peut le faire : création de compte et secrets)

1. Créer un compte sur `upstash.com` (offre gratuite, **sans carte bancaire**).
2. Créer une base Redis : nom `speedfood`, type **Regional**, région **EU West 1 (Ireland)** (la même que la base Supabase, `eu-west-1`), offre **Free**, chiffrement TLS activé.
3. Dans la page de la base, section **REST API**, copier deux valeurs : l'adresse (`UPSTASH_REDIS_REST_URL`) et le jeton **lecture et écriture** (`UPSTASH_REDIS_REST_TOKEN`). Ne pas prendre le jeton « read-only ».
4. Dans un terminal, depuis le dossier du site, enregistrer les deux secrets (rien ne s'affiche quand on colle, c'est normal) :

```bash
cd C:\Users\moelo\dev\speedfood\web
npx wrangler versions secret put UPSTASH_REDIS_REST_URL
npx wrangler versions secret put UPSTASH_REDIS_REST_TOKEN
```

5. Dire à l'agent de développement « oui, déploie la version » : il la met en ligne (il ne voit jamais les valeurs).

## Vérifier que ça marche

- Dans la console Upstash (**Data Browser**), des clés `sf:v1:rl:…` apparaissent après quelques actions, ainsi que `sf:v1:conso:AAAA-MM` (consommation du mois).
- Les journaux du Worker ne montrent pas `redis_indisponible_repli_base` en continu.

## Quota et surveillance

L'offre gratuite donne environ 500 000 commandes Redis par mois (à confirmer sur la page d'Upstash). Chaque limite coûte 2 commandes, plus 1 pour le compteur de consommation. Le Worker écrit `redis_quota_atteint 70` puis `redis_quota_atteint 90` dans ses journaux, une seule fois par seuil. Ce que fait Upstash exactement à la limite de l'offre gratuite n'est **pas vérifié** : dans le doute, le repli sur la base protège le service. Réglage : `UPSTASH_QUOTA_MENSUEL` (500000 par défaut).

## Sécurité

- Le jeton est un secret du Worker : jamais dans le code, dans Git, dans un journal ni dans l'application mobile.
- Les clés Redis ne contiennent **aucune donnée personnelle** : l'adresse IP, le téléphone ou l'e-mail sont remplacés par une empreinte HMAC (clé serveur), exactement comme pour la limitation dans la base. Aucun contrôle ne lit ces clés en clair.
- En cas de fuite du jeton : le renouveler dans la console Upstash, puis remplacer le secret du Worker.

## Évolution prévue

Le code est derrière un seul point d'entrée (`appliquerLimites`, `web/src/lib/securite/limitation-debit.ts`) : il suivra sans changement dans l'API unique de l'architecture cible. Monter en gamme chez Upstash ne demande que de changer d'offre, pas de code.
