# Audit de sécurité du 4 octobre 2026

Deux auditeurs indépendants (agents distincts de celui qui a écrit le code, lecture seule) ont relu le côté serveur, le côté
client et les 48 migrations. En parallèle, un test d'intrusion a été joué contre la production et la base : requêtes
anonymes, deux restaurateurs de test l'un contre l'autre, élévation de privilèges, en-têtes, redirections, cookies,
authentification. Aucun constat critique. Les scripts de test ne sont pas dans le dépôt ; les comptes et restaurants de test
ont été supprimés (base revenue à 19 restaurants, 3 comptes, 3 commandes).

Verdict des auditeurs : **proche du pilote, pas encore prêt** tant que les points « à décider » ci-dessous ne sont pas traités.

## Corrigé (code et migrations `bornes_textes_contenus` et `securite_audit_4_octobre`)

| Constat | Correctif |
|---|---|
| Cookies de session sans HttpOnly, durée de 400 jours | HttpOnly, Secure, 30 jours (`src/lib/db/cookies.ts`, serveur et proxy). Vérifié : connexion OK, cookie invisible pour JavaScript |
| Origine du site déduite de `x-forwarded-host` (liens d'e-mail, retours d'identification) | Hôte lu uniquement dans `host` et comparé à une liste fixe (`src/lib/partage/origine.ts`) ; variable `SITE_URL` pour un futur domaine |
| Vol de fichier d'un autre restaurant par une URL vers un autre `*.supabase.co` | Hôte figé sur le projet, dans le trigger et dans `cheminMediaDepuisUrl` |
| CSS injectable par `couleur_accent` | Contrainte `#RRGGBB` en base |
| Un restaurateur pouvait empêcher l'anonymisation de ses commandes (`anonymise_le`, `mis_a_jour_le`) | Colonnes protégées dans `fn_limiter_maj_commande` |
| Le rôle `operations` pouvait s'ajouter à un restaurant sans trace | Déclencheur d'audit sur `restaurant_memberships` |
| Double authentification non vérifiée dans chaque action `/system` | Contrôle aal2 dans `chargerContexteSysteme` |
| Textes sans limite de longueur (nom de 100 000 caractères accepté), prix non borné | Contraintes en base |
| Plats archivés et mises en avant de restaurants non publiés lisibles publiquement | Politiques de lecture publique resserrées (migration `securite_lecture_publique_resserree`) |
| Limite de corps des actions serveur à 1 Mo alors que le code accepte 5 Mo (les photos de plus de 1 Mo échouaient) | Relevée à 6 Mo |
| HSTS absent, `X-Powered-By`, `/system` listé dans robots.txt, `in` sur objets, échappement JSON-LD de la page d'aide | Corrigés |

## À décider ou à faire avant un pilote avec de vraies données

1. **Fonction de réinitialisation totale en production** : la garde en base est solide (super admin, double authentification,
   jeton de 5 minutes, une fois par heure), mais la sauvegarde préalable et la phrase de confirmation sont des contrôles de
   l'application. Une session volée pourrait tout effacer. À retirer ou à doubler d'un second super admin une fois la production
   lancée.
2. **Double authentification obligatoire** pour les rôles système (aujourd'hui facultative, non activée sur le compte réel).
3. **Jeton de suivi dans les journaux Cloudflare** (`observability` persistants, jeton dans le chemin `/suivi/<jeton>`) :
   désactiver les journaux d'invocation ou accepter le risque (visible uniquement avec accès au compte Cloudflare, 7 jours).
4. **Réglages Supabase Auth à vérifier dans le tableau de bord** : liste des adresses de redirection (sans joker), captcha,
   protection contre les mots de passe fuités (offre payante).
5. Secrets de production à confirmer : `TURNSTILE_SECRET_KEY` (sans lui, la vérification anti-robot est silencieusement
   désactivée), `COMMANDE_JETON_SECRET` dédié (sinon dérivé de la clé de service).

## Mineurs restants (non corrigés)

Colonnes publiques un peu larges (`motif_correction`, `donnees_demo`, `auteur_id` ; sans effet sur les restaurants publiés),
propositions de prix insérables en direct sans bornes, rétention du journal d'audit réglable à 1 mois, abonnement push d'un
ancien membre conservé, téléversement sans quota ni nettoyage des orphelins, limites de débit par IP à reconsidérer pour les réseaux
mobiles partagés, suppression de compte client sans ré-authentification, audit non atomique avec la mutation,
`script-src 'unsafe-inline'` (accepté, nécessaire au framework).

Non vérifié : configuration réelle de Supabase Auth, secrets effectivement posés en production, comportement de Cloudflare
vis-à-vis de `x-forwarded-host`, vraie commande avec Turnstile, concurrence réelle à deux connexions.

## Mesure du temps de calcul (4 octobre 2026, soir)

Sur la production : pages publiques 5 à 448 ms de calcul (la plus lourde, `/restaurants`, au premier appel), pages connectées 20 à 171 ms, toutes terminées avec succès (39 + 18 requêtes). L'erreur Cloudflare 1102 vue pendant les tests visuels n'a pas été reproduite. La route d'alertes (`/restaurant/alertes`, interrogée toutes les 15 s par console ouverte) coûte 23 à 171 ms : à surveiller si le nombre de restaurants simultanés grandit.
