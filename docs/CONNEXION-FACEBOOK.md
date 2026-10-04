# Connexion Facebook des clients : mise en service pas à pas

État au 4 octobre 2026 : le code est prêt (pages `/entrer`, `/bienvenue`, `/compte`, route `/auth/client`, interrupteur dans `/system/parametres`). **Rien ne fonctionne tant que Facebook n'est pas configuré**, et le bouton reste caché. Les étapes ci-dessous sont à faire par Malika : l'application Meta et ses deux identifiants lui appartiennent, ils ne passent jamais dans une conversation ni dans le dépôt.

Adresses utiles (à copier telles quelles) :

- Site : `https://speedfood-app.moelohimmara.workers.dev`
- Retour de connexion de Supabase : `https://ggldjdizqrtpetdiohxy.supabase.co/auth/v1/callback`
- Page de confidentialité : `https://speedfood-app.moelohimmara.workers.dev/confidentialite`

## Étape 1 : créer l'application Meta (gratuit)

1. Ouvrir https://developers.facebook.com et se connecter avec le compte Facebook de Malika.
2. « Mes applications », puis « Créer une application ».
3. Cas d'utilisation : **Authentification et création de compte** (connexion avec Facebook). Nom de l'application : « Speedfood ».
4. Dans « Paramètres de l'application », « Général » :
   - **URL de la politique de confidentialité** : l'adresse de la page de confidentialité ci-dessus.
   - **Instructions de suppression des données** : la même adresse (la page explique que le client supprime son compte lui-même depuis « Mon compte »).
   - **Domaines de l'application** : `speedfood-app.moelohimmara.workers.dev`.
   - Catégorie : « Alimentation et boissons » (ou la plus proche).
5. Dans le cas d'utilisation « Authentification et création de compte », vérifier que les autorisations **public_profile** et **email** sont présentes (« Prêt pour les tests »).
6. Dans « Connexion avec Facebook », « Paramètres » : ajouter dans **URI de redirection OAuth valides** l'adresse « Retour de connexion de Supabase » ci-dessus.
7. Noter l'**ID de l'application** et la **Clé secrète** (Paramètres, Général, « Afficher »). La clé secrète ne se partage avec personne.

## Étape 2 : brancher Facebook dans Supabase

1. Ouvrir le tableau de bord Supabase du projet `ggldjdizqrtpetdiohxy`.
2. **Authentication, Sign In / Providers, Facebook** : activer, coller l'ID de l'application et la clé secrète, enregistrer.
3. **Authentication, URL Configuration** :
   - « Site URL » : `https://speedfood-app.moelohimmara.workers.dev`.
   - « Redirect URLs » : ajouter `https://speedfood-app.moelohimmara.workers.dev/**`. Sans cette ligne, Supabase renvoie les clients vers la mauvaise page après la connexion.

## Étape 3 : activer dans Speedfood

1. Ouvrir `/system/parametres` (compte super admin).
2. Bloc « Comptes clients » : cocher « Activer la connexion Facebook des clients », enregistrer.
3. Le lien « Mon compte » apparaît dans l'en-tête du site ; la page `/entrer` affiche « Continuer avec Facebook ».

## Étape 4 : tester

1. Pendant que l'application Meta est en **mode développement**, seuls les comptes ayant un rôle sur l'application (administrateurs, développeurs, testeurs, à ajouter dans « Rôles de l'application ») peuvent se connecter. C'est normal.
2. Se connecter avec un tel compte : on arrive sur l'écran de bienvenue (avatar, pseudo), puis sur « Mon compte ».
3. Vérifier « Modifier », « Se déconnecter » et « Supprimer mon compte » (avec un compte de test uniquement).

## Étape 5 : ouvrir au public

Passer l'application Meta en mode **Live** (« Publier » dans le tableau de bord Meta). Meta peut demander des vérifications supplémentaires selon l'état du compte : c'est un point que le code ne contrôle pas et qui n'a pas été vérifié ici.

## Points de vigilance

- **Comptes Facebook sans adresse e-mail** (fréquents quand le compte a été créé avec un numéro de téléphone) : Supabase exige l'e-mail, la connexion peut échouer pour ces personnes. Le numéro de téléphone avec code (SMS ou WhatsApp) est prévu pour elles : payant, décision de budget en attente.
- **Désactiver rapidement** : décocher la case dans `/system/parametres` suffit à masquer le bouton et à bloquer le départ de la connexion.
- **Données gardées** : identifiant du compte, pseudo, avatar (table `client_profils`, visible du seul client). Rien d'autre n'est repris de Facebook. Voir la page de confidentialité (section « Si vous créez un compte »).
- Les commandes ne sont **pas encore liées au compte** : pas d'historique, pas d'informations préremplies, pas de favoris. Ce sont les prochaines étapes.
