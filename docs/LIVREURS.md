# Livreurs : fiche, accès, approbation, création groupée

**Version :** 0.1, 17 octobre 2026. **Statut : conception validée par la propriétaire le 17 octobre 2026 ; implémentation en cours (voir §7).** Complète `docs/LIVRAISON.md`.

## 1. Décisions de la propriétaire

| Sujet | Décision |
|---|---|
| Création | **Individuelle**, plus **création groupée** : coller une liste **et** importer un fichier CSV |
| Validation | **Avec approbation** par l'exploitation avant toute course (réglable : peut être éteinte dans la console) |
| Accès du livreur | **Lien d'activation à envoyer par WhatsApp** : usage unique, valable 7 jours (réglable) |
| Informations | **Minimum** (nom, téléphone, véhicule) **ou plus** (pièce d'identité, contact d'urgence), **au choix, réglable dans la console du super administrateur** |

## 2. Cycle de vie d'une fiche livreur

Séparé de l'état de travail (hors ligne, en ligne, en course) : l'un dit **qui est ce livreur** pour Speedfood, l'autre **ce qu'il fait maintenant**.

```
cree ──(lien envoyé)──> invite ──(le livreur active son compte)──> candidat ──(approbation)──> actif ⇄ suspendu
                                                                       │                           │
                                                                       └──(refus)──> archive <─────┘
```

- **cree** : fiche créée par l'exploitation, aucun lien encore généré (cas d'un import dont on n'a pas encore envoyé les liens).
- **invite** : un lien d'activation valide existe.
- **candidat** : le livreur a activé son compte (et rempli son dossier) ; il **attend l'approbation**. Si l'approbation est éteinte dans les réglages, l'activation le rend directement **actif**.
- **actif** : peut se mettre en ligne et recevoir des offres.
- **suspendu** : plus d'offres ni de mise en ligne ; motif obligatoire, journalisé ; refusé tant qu'il est **en course** (terminer ou réaffecter d'abord).
- **archive** : plus visible dans les listes courantes, **jamais supprimé** s'il a des courses (l'historique et les comptes restent exacts). Un livreur sans aucune course peut être supprimé.

Seul un livreur **actif** peut passer « en ligne » et être sollicité par la répartition. Les livreurs de démonstration sont **actifs** d'office.

## 3. Règles métier

1. **Téléphone** : obligatoire, normalisé `+224XXXXXXXXX`, **unique parmi les fiches non archivées** (un même numéro ne peut pas avoir deux fiches).
2. **Un compte, une fiche** : un compte ne peut être lié qu'à une seule fiche livreur ; un compte déjà restaurateur ou administrateur **peut** être livreur (avertissement affiché), la séparation des consoles reste stricte.
3. **Lien d'activation** : 24 octets aléatoires ; seule l'**empreinte** est stockée ; **usage unique** ; expire après 7 jours (réglable) ; un nouveau lien invalide les précédents ; un lien utilisé ou expiré ne dit pas pourquoi il échoue en détail (« lien invalide ou expiré »).
4. **Activation** : le livreur doit être connecté (ou créer son compte), voit le nom de la fiche, remplit les champs que la console exige, accepte les conditions, puis la fiche est liée à **son** compte ; il ne peut activer que la fiche à laquelle le lien correspond.
5. **Approbation** : par `commande.support` (super administrateur, support), motif facultatif à l'approbation, **obligatoire au refus** ; les deux sont journalisés. Le refus archive la fiche.
6. **Suspension** : motif obligatoire ; réaffecte les offres en attente ; un livreur suspendu qui se connecte voit son statut et le motif.
7. **Création groupée** : jusqu'à **100 lignes** par envoi ; contrôle ligne par ligne **avant** toute création (téléphone invalide, doublon dans la liste, doublon avec une fiche existante, véhicule inconnu, nom trop court) ; seules les lignes valides sont créées, les autres sont rapportées avec leur raison ; un récapitulatif des liens est copiable et exportable.
8. **Données sensibles** (pièce d'identité, contact d'urgence) : seulement si la console les exige ; lisibles par le **super administrateur** uniquement ; jamais envoyées au navigateur d'un autre rôle ; durée de conservation à ajouter à `CONSERVATION-ET-CONFIDENTIALITE.md` (livreur archivé : suppression du dossier sous 12 mois, à valider).

## 4. Réglages de la console (super administrateur)

Dans `/system/parametres/livraison`, section **Livreurs** :

| Réglage | Par défaut | Effet |
|---|---|---|
| Approbation requise | **Oui** | Activation → candidat → approbation. Non : activation → actif |
| Pièce d'identité demandée | Non | Champs « type » et « numéro » exigés à l'activation |
| Contact d'urgence demandé | Non | Nom et téléphone d'un proche exigés à l'activation |
| Validité du lien (jours) | 7 | De 1 à 30 |

## 5. Modèle de données

- `livreurs` : + `cycle` (`cree`, `invite`, `candidat`, `actif`, `suspendu`, `archive`) ; + `motif_cycle` ; + `email_invitation` facultatif. Les fiches existantes (livreurs de démonstration) passent `actif`. Unicité du téléphone parmi les non archivées.
- `livreur_invitations` : `livreur_id`, empreinte du jeton, expiration, date d'utilisation, auteur. **Aucune lecture par l'API.**
- `livreur_dossiers` : `livreur_id`, type et numéro de pièce, contact d'urgence (nom, téléphone), date de consentement. Lecture super administrateur seulement ; écriture par le serveur.
- `parametres_livraison` : + les quatre réglages du §4.

## 6. Écrans

- `/system/livraisons/livreurs` : compteurs, filtre par cycle (**Candidats à approuver** en tête), création individuelle, création groupée (coller / CSV), approbation, suspension, archivage, regénération du lien.
- `/livreur/activer?jeton=…` : activation par le livreur (dossier selon les réglages).
- `/livreur` : selon le cycle, console de travail, « en attente d'approbation », « suspendu (motif) ».

## 7. Étapes

| Étape | Contenu | État |
|---|---|---|
| L1 | Règles pures (cycle, validation, analyse d'une liste ou d'un CSV, jeton, dossier) avec 45 tests ; migration `20261017220000` ; 18 contrôles de cloisonnement | **Fait, migration non appliquée** |
| L2 | Création individuelle et groupée (liste collée ou fichier CSV, aperçu ligne par ligne), liens d'activation (WhatsApp, copie, CSV), page `/livreur/activer`, dossier selon les réglages | **Déployé le 17 octobre 2026 (version `9642a39e`)** |
| L3 | Approbation, refus, suspension, réactivation, archivage (avec motif, journalisés) ; réglages de la console ; répartition et mise en ligne réservées aux fiches actives ; écrans « en attente » et « suspendu » pour le livreur | **Déployé le 17 octobre 2026 (version `9642a39e`), parcours dans un navigateur non joué** |

**Migration appliquée en production le 17 octobre 2026** (alertes de sécurité relues : seule la table des liens, sans règle d'accès, est ajoutée). Rappel : appliquer la migration `20261017220000_livreurs_cycle_dossiers.sql` (le code lit `livreurs.cycle`) et lancer `get_advisors`. Les livreurs de démonstration existants passent « actifs » par défaut.

**Pas encore fait** : écran de lecture du dossier (pièce, contact d'urgence) par le super administrateur ; dépôt de scans de documents ; suppression automatique du dossier d'un livreur archivé (12 mois, à confirmer) ; notification d'un livreur dont la fiche est approuvée (il doit revenir sur `/livreur`).
