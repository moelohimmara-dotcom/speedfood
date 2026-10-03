# Conservation des données et confidentialité — Speedfood

**Version :** 0.2 — 3 octobre 2026  
**Statut :** Malika a **validé le 3 octobre 2026 la durée de 90 jours**, avec la possibilité de la **raccourcir ou de l'allonger** (voir §6). Ce n'est **pas un avis juridique**. Les obligations en Guinée (protection des données, notification, durées minimales de conservation) doivent être confirmées avec un conseil compétent avant le pilote avec de vraies données (`PROCEDURE-SECURITE.md` §7).

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

**Décision de Malika (3 octobre 2026) : 90 jours retenus, réglables** dans `/system/parametres` (§6). Si un restaurateur a besoin de retrouver un client plus longtemps, c'est à lui de le noter lui-même, hors Speedfood.

## 3. Droits des personnes et demandes

Une personne peut demander de **voir, corriger ou effacer** ses données. Procédure proposée tant qu'il n'y a pas d'écran dédié :
1. La demande arrive à l'adresse de contact publiée (à définir, voir §5).
2. Un `super_admin` retrouve la commande par sa référence (`SF-XXXXX`) dans le CMS, vérifie que la personne connaît la référence ou le téléphone concerné.
3. Il anonymise la commande (même opération que l'anonymisation automatique) et **journalise la demande** dans l'audit avec un motif, sans recopier le téléphone ni l'adresse dans le journal.
4. Réponse écrite à la personne sous 30 jours.

## 4. État de l'implémentation

- **Fait :** coordonnées masquées par défaut pour le support, révélation seulement avec motif obligatoire et trace d'audit (bloc 8d) ; la page de suivi publique n'affiche ni téléphone ni adresse ; consentement explicite à la commande ; clés de limitation de débit sous forme d'empreintes.
- **Fait le 3 octobre 2026 :** anonymisation et purge automatiques (migration `conservation_donnees`). La fonction `fn_anonymiser_donnees()` tourne **chaque nuit à 3 h 15 UTC** par `pg_cron` (job `speedfood-anonymisation`, extension activée dans Supabase) ; les trois durées sont réglables par le `super_admin` dans `/system/parametres`. Testé en base avec des commandes de dates variées (voir §6).
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

## 6. Régler et exploiter la conservation : mode d'emploi (humain ou agent)

### 6.1 Ce qui est réglable

| Réglage (`/system/parametres`) | Colonne de `parametres_application` | Défaut | Bornes | Effet |
|---|---|---|---|---|
| Coordonnées d'une commande terminée, refusée ou annulée | `conservation_coordonnees_jours` | 90 | 7 à 3650 jours | Délai compté depuis la **dernière mise à jour du statut** (la clôture) |
| Commande jamais clôturée | `conservation_non_cloturee_jours` | 30 | 7 à 3650 jours | Délai compté depuis la **création** pour une commande restée en attente, acceptée ou prête |
| Journal d'audit | `conservation_audit_mois` | 12 | 1 à 120 mois | Les événements plus anciens sont **supprimés** |

Les bornes sont imposées par la base (contraintes `CHECK`) : impossible d'enregistrer 0 ou une valeur négative. Le minimum de
7 jours protège d'une faute de frappe, car **l'anonymisation est irréversible**.

### 6.2 Ce que fait l'anonymisation

Chaque nuit, `fn_anonymiser_donnees()` remplace sur les commandes échues le nom par « Client », le téléphone par du vide, l'adresse par
« rien », et date l'opération (`orders.anonymise_le`). Une commande déjà anonymisée n'est jamais retraitée. Les montants, les plats, les
suppléments, l'historique de statut et les propositions sont conservés. Elle supprime aussi les événements d'audit plus anciens que la durée
réglée, puis écrit **un** événement d'audit sans donnée personnelle (« N commande(s) anonymisée(s), M événement(s) purgé(s) »).
La fonction n'est appelable par aucun rôle de l'API (ni visiteur, ni compte connecté) : seulement par la planification interne.

### 6.3 Raccourcir ou allonger : conséquences

- **Raccourcir (par exemple 90 vers 30 jours)** : dès la nuit suivante, toutes les commandes clôturées depuis plus de 30 jours perdent leurs
  coordonnées, **définitivement**. Vérifier avant que personne n'en a besoin (réclamation en cours, litige). Les exports de sauvegarde
  déjà réalisés gardent les anciennes coordonnées jusqu'à leur rotation (voir `RUNBOOK-EXPORT.md` §7).
- **Allonger (par exemple 90 vers 180 jours)** : n'a d'effet que pour l'avenir. Les commandes **déjà anonymisées ne reviennent pas**.
- **Dans tous les cas** : mettre à jour le texte de la page de confidentialité (§5) pour qu'il affiche la durée réellement appliquée. Une durée
  annoncée différente de la durée appliquée est un manquement, quelle que soit la direction. Une durée supérieure à 90 jours demande aussi de
  confirmer sa justification (obligation légale ou besoin réel), puisque le principe est de ne pas conserver plus que nécessaire.
- Toute modification est journalisée dans l'audit (`parametres.modification`, avec les nouvelles valeurs).

### 6.4 Vérifier et exploiter

```sql
-- Le job tourne-t-il ? (dernières exécutions)
select jobname, schedule, active from cron.job where jobname = 'speedfood-anonymisation';
select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;

-- Réglages actuels
select conservation_coordonnees_jours, conservation_non_cloturee_jours, conservation_audit_mois from parametres_application;

-- Combien de commandes sont anonymisées ou encore identifiantes (compteurs seulement)
select count(*) filter (where anonymise_le is not null) as anonymisees, count(*) filter (where anonymise_le is null) as identifiantes from orders;
```

Lancer l'anonymisation tout de suite (administrateur de base, par exemple depuis l'éditeur SQL de Supabase) : `select public.fn_anonymiser_donnees();`
renvoie les nombres traités. **Ne jamais écrire de téléphone ou d'adresse dans un motif d'audit ni dans une conversation.**

**Si le job ne tourne plus** (extension désactivée, projet en pause) : le relancer en recréant la planification
(`select cron.schedule('speedfood-anonymisation', '15 3 * * *', 'select public.fn_anonymiser_donnees()');`) ou, à défaut, appeler la fonction à la main chaque
semaine. Un projet Supabase gratuit en pause n'exécute rien : l'anonymisation reprend à sa réactivation.

### 6.5 Effacement à la demande d'une personne

(Cette section concerne les **clients**. La suppression d'un **compte** de restaurateur ou de test se fait par le `super_admin` dans `/system/acces/comptes`, bouton « Supprimer ce compte » : voir `STATUT-PROJET.md`.)

Procédure du §3 inchangée. Pour anonymiser **une** commande sans attendre, le `super_admin` exécute en base :
`update orders set client_nom = 'Client', client_telephone = '', client_adresse = null, anonymise_le = now() where reference = 'SF-XXXXX';`
puis journalise la demande dans l'audit **avec un motif sans coordonnées**. Penser aux exports de sauvegarde existants (rotation à 4).

### 6.6 Ce qui reste à faire

- Publier la page `/confidentialite` (le texte du §5 est prêt). **Responsable indiqué par Malika le 3 octobre 2026 : Mo elohim.** Il manque encore l'adresse de contact à publier ; la date de mise à jour sera celle de la publication.
- Faire valider les durées et les obligations en Guinée par un conseil compétent avant le pilote avec de vraies données.
