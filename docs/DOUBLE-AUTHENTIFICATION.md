# Double authentification (facultative) : guide

**Version :** 1.0, 3 octobre 2026. Décision de Malika : **facultative**, avec un rappel visible qui explique son importance.

## 1. Ce que c'est, pour une utilisatrice ou un utilisateur

Après le mot de passe, l'application demande un **code à 6 chiffres** qui change toutes les 30 secondes et qu'affiche une
application sur le téléphone (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS…). Un mot de passe volé ou deviné ne suffit
alors plus.

- **Où l'activer :** page `Sécurité du compte` (`/compte/securite`), accessible depuis la console restaurant et la console d'administration.
- **Activation :** « Activer la double authentification », scanner le QR code (ou saisir la clé), saisir le premier code. Deux minutes.
- **Facultative :** personne n'est obligé. Tant qu'elle n'est pas activée, un **rappel** s'affiche en haut des consoles : discret pour un
  restaurateur, **rouge et plus explicite pour un compte d'administration**.
- **Une fois activée, elle est exigée** à chaque connexion. Elle peut être désactivée depuis la même page (avec confirmation).
- **Pas de code de secours.** Supabase n'en fournit pas pour ce type de protection. **Conseiller de noter la clé affichée à l'activation
  dans un gestionnaire de mots de passe** : c'est le seul moyen de reconfigurer l'application si le téléphone est perdu.

## 2. Si quelqu'un a perdu son téléphone (récupération par un administrateur de base)

La personne ne peut plus passer la vérification. Un administrateur de la base (propriétaire du projet Supabase, ou un agent autorisé avec
l'accès à la base) retire sa protection, **après avoir vérifié son identité par un autre moyen** (appel, message d'un canal connu : ne jamais
retirer une protection sur la seule demande d'un email inconnu, c'est précisément l'attaque que la double authentification empêche) :

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'adresse@exemple.com');
insert into audit_events (acteur_id, action, cible_type, cible_id, motif)
select null, 'compte.retrait_double_authentification', 'utilisateur', id::text,
       'Protection retirée après perte du téléphone, identité vérifiée par <moyen>'
from auth.users where email = 'adresse@exemple.com';
```

La personne se reconnecte avec son mot de passe seul, puis peut réactiver la protection avec un nouveau téléphone. **Si le seul `super_admin`
perd son téléphone**, seule cette voie (tableau de bord Supabase, éditeur SQL) permet de rentrer : garder l'accès au tableau de bord Supabase
en lieu sûr.

## 3. Comment c'est protégé techniquement

| Couche | Ce qui est fait |
|---|---|
| Application (`src/proxy.ts`) | Pour `/restaurant` et `/system` : si le compte a une protection active et que la session est au seul mot de passe (niveau `aal1`), redirection vers `/connexion/verification` |
| Pages (`src/app/connexion/verification`, `src/app/compte/securite`) | Saisie du code, activation, désactivation. Actions serveur dans `src/lib/auth/mfa.ts` |
| Base de données (migration `double_authentification_aal2`) | `fn_est_admin_systeme` et `fn_est_membre_restaurant`, utilisées par **toutes** les règles de gestion, ne donnent leurs droits à un compte protégé qu'avec une session renforcée (`aal2`). Un appel direct à l'API avec un mot de passe seul ne lit donc plus rien de protégé |
| Rappel | `src/components/RappelDoubleAuthentification.tsx`, affiché dans les deux consoles tant qu'aucune protection n'est active |

Les comptes **sans** protection ne sont touchés par rien : comportement inchangé.

## 4. Vérifications faites (3 octobre 2026)

- En base, avec des sessions simulées : sans protection, tout fonctionne ; avec protection et session `aal1`, l'administrateur n'est plus reconnu, ne voit
  plus le journal d'audit, et un membre de restaurant ne voit plus ses commandes ; avec session `aal2`, tout fonctionne ; la lecture publique reste intacte.
- Dans l'application, avec un compte de test (supprimé ensuite) : rappel visible, activation avec un vrai code TOTP calculé, rappel disparu, nouvelle
  connexion redirigée vers la vérification, mauvais code refusé, bon code accepté, désactivation.

## 5. Limites connues

- Pas de codes de secours (voir §1 et §2).
- La protection ne couvre que la connexion par mot de passe de ce projet ; elle ne protège pas le tableau de bord Supabase ni Cloudflare, qui ont leur propre
  double authentification à activer séparément (**à faire pour les comptes de Malika** : Supabase, Cloudflare, GitHub, messagerie).
- Une session déjà ouverte avant l'activation garde sa validité jusqu'à sa prochaine expiration : après activation, la session courante passe au niveau renforcé,
  mais d'autres appareils connectés au mot de passe seul doivent se reconnecter (ils sont alors redirigés vers la vérification).
- Facultative : un compte qui ne l'active pas reste protégé par son seul mot de passe. Pour un compte d'administration, **activer la protection est fortement
  recommandé** ; elle pourra être rendue obligatoire pour les rôles système si Malika le décide (changement de `src/proxy.ts` et d'une règle de base).
