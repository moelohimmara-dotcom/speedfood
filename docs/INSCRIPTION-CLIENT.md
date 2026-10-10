# Inscription client (formulaire ou Facebook)

Page unique `/entrer` : deux chemins proposés côte à côte, au choix du client.

## Ce que fait la page

1. **Formulaire complet** — nom, téléphone (format guinéen guidé), adresse e-mail, double mot de passe,
   adresse (résidence, ville, quartier, pays **Guinée** prérempli et expliqué).
2. **Facebook** — uniquement si l'administrateur a activé le réglage
   (`connexion_facebook_active`, console `/system`). Sinon la page explique honnêtement que
   l'option n'est pas disponible, plutôt que d'afficher un bouton qui échouerait.

L'ancien formulaire « e-mail + mot de passe » n'est plus utilisé : `inscriptionAction` est un alias
de `inscriptionCompleteAction`.

## Le parcours réel (et ses pièges)

### 1. Confirmation d'e-mail : pas de session à l'inscription

En production, la confirmation d'e-mail est activée. À l'instant du `signUp`, **aucune session
n'existe** : la RLS de `client_profils` n'autorise qu'un client connecté à écrire son propre profil.
Toute écriture à ce moment-là échouerait.

La solution retenue, sans secret supplémentaire dans le Worker :

- l'inscription dépose les coordonnées dans les **métadonnées du compte** (`nom_commande`,
  `telephone`, `adresse`) — elles ne sont donc jamais perdues ;
- `assurerProfilClient` (`src/lib/client/profil-serveur.ts`) reprend ces métadonnées et crée le profil
  à la **première visite authentifiée** : `/compte`, ou la connexion via `connexionAction`.

C'est idempotent (rien n'est fait si le profil existe déjà) et jamais bloquant (un échec est journalisé
puis oublié : le client reste utilisable).

### 2. Les contraintes de la table sont strictes

`client_profils` refuse, et le refus fait échouer **toute** l'insertion :

| Colonne  | Contrainte                                                        |
| -------- | ----------------------------------------------------------------- |
| `pseudo` | 3 à 24 caractères, `^[A-Za-zÀ-ÿ0-9 _.-]+$`                        |
| `avatar` | liste fermée : burger, pizza, riz, poulet, poisson, cafe, pain, salade, brochette, glace |

`src/lib/client/profil.ts` fournit les deux générateurs purs et testés (`pseudoPourCompte`,
`avatarPourGraine`) : le nom saisi quand il est conforme, un pseudo amusant sinon ; l'avatar est choisi
de façon **stable** à partir de l'identifiant du compte.

> Une première version écrivait `avatar: "default"` et `pseudo: nom.slice(0, 50)` : les deux valeurs
> violaient la contrainte. Le profil n'était jamais créé, sans message d'erreur visible pour le client.

### 3. Redirections

- Le lien de l'e-mail de confirmation Ramène vers **`/compte`**, pas vers l'inscription d'un restaurant.
- `inscriptionCompleteAction` respecte le champ `suite` (chemin interne obligatoire), `/compte` par défaut.
- `connexionAction` route selon le type de compte réel : `/system` (admin), `/restaurant` (restaurateur),
  **`/compte` (client)**. Sans cette branche, un client atterrissait sur « Configurons votre établissement ».
- La page `/connexion` a un intitulé **neutre** (« Connexion ») : elle sert aussi les clients, dont
  l'écran de confirmation renvoie « Aller à la connexion ».

## Tests

`scripts/tests/profil.test.mts` (17 tests) : le nom devient le pseudo quand il est conforme, un pseudo
amusant sinon, et dans tous les cas une valeur acceptée par `validerPseudo` ; l'avatar est toujours dans
la liste fermée et stable pour un même compte.

Vérification de terrain (10 octobre 2026) : inscription réelle en production, confirmation du compte,
connexion, profil créé avec le bon pseudo, l'avatar, le nom, le téléphone normalisé (`+224622123456`)
et l'adresse complète.