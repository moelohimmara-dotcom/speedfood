# Conservation des données et confidentialité — Speedfood

**Version :** 0.1 — proposition du 3 octobre 2026, **à valider par Malika**  
**Statut :** les durées ci-dessous sont des **propositions de travail**, pas des décisions ni un avis juridique. Les obligations en Guinée (protection des données, notification, durées minimales de conservation) doivent être confirmées avec un conseil compétent avant le pilote avec de vraies données (`PROCEDURE-SECURITE.md` §7).

## 1. Ce que la base contient réellement

Relevé fait dans le schéma de production le 3 octobre 2026 (colonnes dont le nom évoque une donnée personnelle, puis vérification des tables).

| Donnée | Où | Qui l'a fournie | Sensible ? |
|---|---|---|---|
| Nom du client | `orders.client_nom` | Le client, à la commande | Oui (personnelle) |
| Téléphone du client | `orders.client_telephone` | Le client | **Oui** |
| Adresse de livraison | `orders.client_adresse` (seulement si livraison demandée) | Le client | **Oui** |
| Lien de suivi (jeton secret) | `orders.jeton_suivi` | Généré par Speedfood | Oui : c'est la clé d'accès à la commande |
| Contenu de la commande | `order_items`, `order_item_options` | Le client | Peu (plats et prix) |
| Email des restaurateurs et du personnel | `auth.users` (Supabase Auth) | La personne | Oui |
| Motifs de modération, suspension, accès | `audit_events.motif`, `restaurants.motif_correction`, `restaurants.suspendu_motif` | Le personnel Speedfood | Peu, mais ne doit jamais contenir de téléphone ni d'adresse |
| Compteurs de limitation de débit | `rate_limits` | Calculé | Non : empreintes irréversibles, effacées par un nettoyage opportuniste (au bout d'un jour ou plus selon le trafic) |
| Photos et logos | stockage `medias` | Les restaurants | Non personnelles (à ne pas y mettre de visages sans accord) |

Ne sont **pas** collectés : paiement, position GPS, contenu de conversations WhatsApp, identifiants publicitaires, outils de statistiques tiers.

Hébergement : base Supabase en Irlande (`eu-west-1`), application sur Cloudflare Workers. Cloudflare voit l'adresse IP des visiteurs dans ses propres journaux, selon sa politique ; Speedfood n'enregistre jamais l'IP en clair.

**État au 3 octobre 2026 :** 3 commandes, toutes des commandes de test ; 12 comptes, essentiellement de test ; aucune vraie donnée client.

## 2. Durées de conservation proposées

| Donnée | Proposition | Raison |
|---|---|---|
| Nom, téléphone, adresse d'une commande | **90 jours après la clôture** de la commande (terminée, refusée ou annulée), puis **anonymisation** : nom remplacé par « Client », téléphone et adresse effacés | Assez long pour traiter une réclamation ou un litige de livraison ; pas plus que nécessaire |
| Montants et lignes d'une commande anonymisée | Conservés | Utiles au restaurant (historique) et aux indicateurs, sans identifier personne |
| Commande jamais clôturée | Traitée comme clôturée 30 jours après sa création | Évite des coordonnées conservées indéfiniment |
| Journal d'audit | 12 mois | Traçabilité des actions sensibles ; ne contient pas de coordonnées client |
| Email d'un compte restaurateur | Tant que le compte existe ; effacé à la fermeture du compte sur demande | Nécessaire pour se connecter |
| Compte de test | Supprimé dès la fin du test (c'est déjà la règle) | |

À trancher par toi : ces 90 jours, et si un restaurateur a besoin de retrouver un client plus longtemps (dans ce cas, c'est au restaurateur de le noter lui-même, hors Speedfood).

## 3. Droits des personnes et demandes

Une personne peut demander de **voir, corriger ou effacer** ses données. Procédure proposée tant qu'il n'y a pas d'écran dédié :
1. La demande arrive à l'adresse de contact publiée (à définir, voir §5).
2. Un `super_admin` retrouve la commande par sa référence (`SF-XXXXX`) dans le CMS, vérifie que la personne connaît la référence ou le téléphone concerné.
3. Il anonymise la commande (même opération que l'anonymisation automatique) et **journalise la demande** dans l'audit avec un motif, sans recopier le téléphone ni l'adresse dans le journal.
4. Réponse écrite à la personne sous 30 jours.

## 4. État de l'implémentation

- **Fait :** coordonnées masquées par défaut pour le support, révélation seulement avec motif obligatoire et trace d'audit (bloc 8d) ; la page de suivi publique n'affiche ni téléphone ni adresse ; consentement explicite à la commande ; clés de limitation de débit sous forme d'empreintes.
- **Pas fait :** **aucune purge ni anonymisation automatique n'existe.** Tant qu'elle n'est pas construite, les coordonnées sont conservées sans limite de durée, ce qui est exactement ce que cette proposition veut éviter. À construire après ta validation des durées : une fonction SQL d'anonymisation, appelée chaque nuit (extension `pg_cron` si disponible sur ton offre, sinon un déclenchement planifié côté application) ; en attendant, un nettoyage manuel mensuel par le `super_admin`.
- **Pas fait :** page publique de confidentialité (le texte du §5 est prêt à y être publié) ; écran de demande d'effacement.

## 5. Texte de confidentialité (brouillon à publier sur `/confidentialite`)

> **Vos données sur Speedfood**
>
> Speedfood est un portail qui vous aide à trouver un restaurant et à lui envoyer une demande de commande. Voici, simplement, ce qui se passe avec vos informations.
>
> **Ce que nous demandons.** Pour envoyer une demande, nous vous demandons votre nom et votre numéro de téléphone, et votre adresse seulement si vous demandez une livraison. Rien d'autre. Vous n'avez pas besoin de créer de compte.
>
> **Pourquoi.** Uniquement pour que le restaurant puisse traiter votre commande et vous joindre. Nous ne vous envoyons pas de publicité et nous ne vendons pas vos informations.
>
> **Qui peut les voir.** Le restaurant que vous avez choisi, pour votre commande. L'équipe Speedfood ne voit votre téléphone et votre adresse que si une aide est nécessaire, avec un motif obligatoire qui est enregistré. Votre lien de suivi est secret : ne le partagez pas.
>
> **Paiement.** Speedfood ne reçoit aucun paiement. Vous réglez directement avec le restaurant.
>
> **Combien de temps.** Votre nom, votre téléphone et votre adresse sont effacés de nos systèmes 90 jours après la fin de votre commande. Les montants restent, sans vous identifier.
>
> **Vos droits.** Vous pouvez demander à voir, corriger ou effacer vos informations, à tout moment, en écrivant à **[adresse de contact à compléter]**. Nous répondons sous 30 jours.
>
> **Où sont-elles stockées.** Dans un service d'hébergement situé en Irlande (Supabase) et servies par Cloudflare. Ces prestataires peuvent voir des informations techniques de connexion (comme l'adresse IP) selon leurs propres règles ; Speedfood ne les conserve pas.
>
> **Responsable :** **[nom de la structure ou de la personne à compléter]**. Dernière mise à jour : **[date]**.

Les trois champs entre crochets ne peuvent pas être inventés : ils dépendent de toi (adresse de contact, identité du responsable, date de publication).
