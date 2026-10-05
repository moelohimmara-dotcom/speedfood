# Lien court, affiche, scans, reçus et factures

Lot 3 de l'option B (5 octobre 2026). Suite de `PAIEMENT-CODE-MARCHAND.md` : Speedfood ne reçoit toujours aucun argent.

## Lien court et affiche

- Chaque restaurant a un `code_court` de 6 caractères (`/r/ab12cd`), généré par la base, **non modifiable** par le restaurateur.
- `/r/<code>?s=<source>` compte la visite puis redirige vers la page du restaurant. Sources : `qr`, `affiche`, `whatsapp`, `carte`, `table`, `lien`
  (toute autre valeur devient `lien`). Les aperçus de liens (WhatsApp, réseaux), robots et appels sans agent ne sont pas comptés. Un restaurant
  non publié ou suspendu n'a pas de lien actif (retour à la liste).
- Compteur `restaurant_scans` : un total par restaurant, jour et source. Aucune IP, aucune donnée personnelle. Écriture réservée au serveur
  (`fn_compter_scan`, exécutable par `service_role` seulement). Chaque ouverture compte : une personne peut être comptée plusieurs fois.
- Le QR (`/restaurants/<id>/qr`) encode maintenant le lien court avec la source (`?s=qr` par défaut, `?s=affiche` pour l'affiche).
- Console : « Affiche et QR code » (`/restaurant/affiche`) : aperçu A4, impression (seule l'affiche s'imprime), téléchargement SVG, visites par source sur 7 et 30 jours.

## Reçus et factures (fiscaux ou non)

- Console : « Reçus et factures » (`/restaurant/documents`) : identité sur les documents + liste des derniers documents.
- **Reçu** : établi automatiquement à la confirmation du paiement (bouton de secours « Établir le reçu numéroté »). **Facture** : à la demande, dès l'acceptation.
- Numérotation continue par restaurant, type et année : `R-2026-0001`, `F-2026-0001` (compteur atomique en base).
- Émission uniquement par `fn_emettre_document` (membre du restaurant, commande acceptée, reçu seulement après paiement confirmé, idempotente). Les
  documents sont **figés** à l'émission (émetteur, lignes, totaux) et n'ont aucune écriture directe (ni modification, ni suppression, ni insertion).
- **Non fiscal par défaut.** « Fiscal déclaré » (option) affiche le NIF, le RCCM et la TVA incluse saisis par le restaurant, sous sa responsabilité. Le
  document dit qu'il est établi par le restaurant et que Speedfood ne le certifie pas. À faire valider par un comptable avant usage fiscal réel.
- Côté client : `/suivi/<jeton>/recu` (reçu) et `?doc=facture`, avec onglets quand les deux existent ; partage WhatsApp (`wa.me`), copie du lien,
  impression. Ni téléphone ni adresse du client ; le nom du client n'apparaît que sur une facture.

## Limites connues

- Pas de signature ni de numéro certifié par l'administration fiscale : ce n'est pas un logiciel de facturation certifié.
- Pas d'avoir (annulation) ni de correction d'un document émis : un document émis ne se modifie pas (à traiter avec un comptable si besoin).
- Le comptage des scans n'est pas limité en débit ; l'impact d'une inflation est limité aux statistiques d'un restaurant.

Migration : `20261005173049_lien_court_scans_documents.sql`. Tests : `scripts/tests/documents.test.mts` (27) + test de bout en bout (sécurité en base, lien court, interface, parcours client).
