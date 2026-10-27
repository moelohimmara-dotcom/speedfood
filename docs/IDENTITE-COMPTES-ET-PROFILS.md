# Identité, comptes et profils : ce qui garantit « une personne, un compte » (27 octobre 2026)

Question de Malika : un restaurateur inscrit revient créer un compte consommateur avec la même adresse e-mail, ou avec des indices qui lui ressemblent. Comment éviter les doublons et garder une base cohérente, pour tous les profils ?

## 1. Principe retenu
**Une personne = un compte (l'identité). Le profil est un chapeau, pas un compte.**
- L'identité est unique : une adresse e-mail vérifiée (ou un numéro de téléphone) pour un compte.
- Les **droits** (restaurateur d'un établissement, livreur, équipe) sont des lignes en base, attachées au compte, **toujours accordées côté serveur par l'équipe**. Ni l'écran de choix, ni « Changer de profil » n'accordent quoi que ce soit : ils décident seulement quelle coque on affiche.
- Un même compte peut donc être consommateur ET restaurateur ET livreur. Il n'y a jamais besoin d'un deuxième compte pour changer de rôle.

## 2. Ce que font les grandes plateformes (et ce qu'on a pu vérifier)
- **Uber** : un compte par personne et par application, avec l'exigence d'avoir « son propre compte actif » ; le partage de compte est interdit ([règles de la communauté Uber](https://www.uber.com/gb/en/safety/uber-community-guidelines/keep-safe/)). Quand on a à la fois un compte de course et un compte de conduite, l'aide Uber indique qu'ils s'articulent et que le compte conducteur met à jour le profil passager ([aide Uber](https://help.uber.com/h/53cf8809-a0fc-4856-8706-de637266d4f3)).
- **Adresses e-mail « quasi identiques »** : chez Gmail, les points dans l'adresse ne comptent pas. Un article de Vice raconte comment deux adresses presque identiques menaient à la même boîte, avec des courses Uber reçues par la mauvaise personne ([Vice](https://vice.com/en/article/mg7nav/australian-woman-kept-getting-emails-for-uber-rides-in-kenya)). Leçon : il faut comparer des adresses **canoniques**, pas des chaînes brutes.
- **Supabase (notre fournisseur d'authentification)** : il relie automatiquement les identités qui partagent une même adresse **vérifiée**, et refuse de le faire pour une adresse non vérifiée, à cause du risque de « prise de contrôle préalable » du compte ; la liaison manuelle est désactivée par défaut ([documentation](https://supabase.com/docs/guides/auth/auth-identity-linking)).
- Non vérifié par mes recherches (je ne l'affirme donc pas) : les règles exactes d'Airbnb (mode voyageur/hôte sur un seul compte) et de DoorDash (comptes livreur et client). Le schéma « un compte, plusieurs rôles » d'Airbnb est largement connu, mais je n'ai pas pu le sourcer ici.

## 3. Où en est Speedfood aujourd'hui
Déjà protégé :
- L'authentification (Supabase) n'accepte qu'**un seul compte par adresse exacte**. Une seconde inscription avec la même adresse ne crée rien ; avec la confirmation d'e-mail active, le serveur répond de façon neutre (anti-énumération) et l'application dit « Si cette adresse a déjà un compte, connectez-vous ».
- **Aucun droit professionnel ne s'obtient par soi-même** : l'équipe approuve, crée l'établissement et rattache le compte (« semi-automatique », décision humaine).
- Une seule candidature ouverte par compte (index unique `referencement_demandes_une_ouverte_par_compte`).
- Une normalisation du **téléphone** existe déjà (`src/lib/commande/telephone.ts`).

Pas encore protégé :
1. Les **variantes d'adresse** d'une même boîte (points Gmail, `+étiquette`) créent des comptes distincts.
2. Le **téléphone** n'est pas utilisé comme indice de recoupement entre un compte client et une candidature.
3. Une **candidature en double** (même téléphone, même nom et même quartier) n'est pas signalée à l'équipe.
4. Un restaurateur dont l'établissement **existe déjà** n'a pas de chemin « rattacher mon compte à un établissement existant » : l'équipe créerait un doublon de fiche.
5. Aucun outil de **fusion** de deux comptes pour le support.
6. Les connexions Google/Facebook : à vérifier côté tableau de bord Supabase (liaison manuelle désactivée, e-mail non vérifié refusé).

## 4. Garde-fous proposés
| # | Garde-fou | Effet | Nature |
|---|---|---|---|
| G1 | **Adresse canonique** : minuscules, espaces retirés ; pour Gmail/Googlemail, points et « +étiquette » retirés ; pour les autres fournisseurs, « +étiquette » retirée. Stockée à l'inscription ; une inscription dont la forme canonique existe déjà est **refusée** avec un message qui nomme l'adresse masquée (« m***@gmail.com ») et propose de se connecter | Supprime le cas « je me recrée un compte avec la même boîte » | Blocage |
| G2 | **Même adresse exacte** : l'écran d'inscription propose « Me connecter » et « Mot de passe oublié » (le message neutre reste, pour ne pas révéler quelles adresses existent) | Le retour d'un restaurateur le mène à son compte, avec le profil consommateur | Guidage |
| G3 | **Téléphone comme indice, jamais comme preuve** : numéro normalisé comparé entre comptes clients, candidatures et livreurs ; une correspondance est **affichée à l'équipe** (« ce numéro est aussi sur le compte X ») | Repère les personnes qui reviennent avec une autre adresse | Alerte humaine |
| G4 | **Candidatures** : doublon possible signalé (même téléphone, ou même nom + quartier) avec lien vers la fiche existante ; nouvelle action de l'équipe « **Rattacher à un établissement existant** » (après un appel de vérification) au lieu de créer une seconde fiche | Une fiche par établissement réel | Alerte + décision |
| G5 | **Les droits ne se prennent jamais seuls** (déjà vrai) : à garder comme règle écrite ; « Changer de profil » ne change que l'affichage | Aucune élévation de droits par l'application | Règle |
| G6 | **Connexions sociales** : liaison automatique seulement sur e-mail vérifié ; liaison manuelle désactivée ; un fournisseur qui ne donne pas d'e-mail vérifié est traité comme une adresse à confirmer | Pas de prise de contrôle préalable, pas de doublon Google/Facebook | À vérifier chez Supabase (action de Malika dans le tableau de bord) |
| G7 | **Fusion de doublons** (support) : l'équipe réunit deux comptes (commandes, favoris, rattachements) vers le compte conservé et désactive l'autre, avec une trace d'audit | Remède quand un doublon est déjà là | Outil d'équipe, protégé |
| G8 | **Message d'accueil intelligent** après connexion : « Ce compte est aussi restaurateur : touchez Changer de profil pour y accéder » | Le profil n'est plus un mystère | Guidage |

## 5. Ordre de réalisation proposé
- **Lot I1** (court, utile tout de suite) : G1 (fonction d'adresse canonique + refus à l'inscription, côté serveur par une route appelée avant l'inscription ; contrôle de base sur les comptes existants pour repérer d'éventuels doublons déjà présents), G2 (boutons « Me connecter » / « Mot de passe oublié » sur l'écran d'inscription), G8.
- **Lot I2** : G3 et G4 (alertes dans le dossier de candidature de l'équipe, rattachement à un établissement existant).
- **Lot I3** : G7 (fusion), après avoir observé si des doublons existent vraiment en base.
- **G6** : vérification dans le tableau de bord Supabase (Authentication > Providers/Settings) avec Malika.

## 6. Choix à faire
1. **G1 : bloquer ou avertir ?** Recommandation : bloquer l'inscription quand la forme canonique existe déjà. C'est la même boîte aux lettres ; en laisser créer un second compte, c'est créer un doublon certain.
2. **G3 : le téléphone n'est qu'un indice**, pas un blocage : deux personnes peuvent partager un numéro (famille, gérant et employé). La décision reste humaine.
