# Paiement par code marchand et reçu numérique

Lots 1 et 2 de l'option B (5 octobre 2026). **Speedfood ne reçoit, ne détient et ne vérifie aucun argent.** Le client règle le
restaurant avec le code marchand de ce dernier (Orange Money, MTN MoMo) ou en espèces. Le client **déclare** son paiement, le
restaurateur le **confirme**.

## Parcours

1. Le restaurateur renseigne son code Orange et/ou MTN dans *Mon restaurant > Profil* (le moyen de paiement correspondant doit
   être coché).
2. Le client commande. Tant que le restaurant n'a pas accepté (ou qu'une proposition de prix est en cours), **aucun code n'est
   envoyé au navigateur** : le client ne doit rien payer d'une commande qui peut encore être refusée ou modifiée.
3. Après acceptation, la page de suivi affiche : le code (copiable), le montant, les étapes. Le client saisit une référence de
   transaction facultative et appuie sur « J'ai payé ». Option espèces : « Je paierai en espèces ».
4. Le restaurateur voit le mode et la référence sur la carte de commande, puis « Paiement reçu » ou « Pas reçu » (espèces :
   « Espèces encaissées »).
5. Une fois « reçu » : page de reçu `/suivi/<jeton>/recu` (numérique d'abord), partage par WhatsApp (lien `wa.me`, la personne
   appuie elle-même sur « Envoyer »), copie du lien, impression en option (CSS d'impression).

## Garanties (vérifiées par `scripts/tests/paiement.test.mts` et le test de bout en bout)

- Codes dans une table à part, `restaurant_codes_marchand` : invisible au public, lue côté serveur seulement quand le paiement
  est ouvert. Écrite uniquement par les membres du restaurant ; changements tracés dans l'audit, valeur masquée (`****56`).
- La base impose les règles (déclencheur `fn_valider_paiement_commande`), pas l'interface : un membre ne peut ni écrire le mode,
  la référence ou la date de déclaration, ni se déclarer à la place du client, ni confirmer avant acceptation ; « non reçu » ne
  s'applique qu'à une déclaration ; « reçu » est définitif ; la date de réception est posée par la base.
- Le client écrit via une action serveur avec son jeton de suivi, limitée en débit (20 par 10 min et par IP).
- Jamais de code secret demandé ni stocké. Montants GNF entiers.
- Le reçu n'affiche ni téléphone ni adresse du client, n'est pas indexé, et dit explicitement qu'il n'est pas une facture fiscale.

## Hors périmètre (lots suivants)

Lien court et QR (3), QR de table (4), e-mail (5, compte externe à valider), facture fiscale optionnelle (6, NIF, TVA, numérotation :
validation d'un comptable), API WhatsApp officielle (7, payante).

## Fichiers

Migration `20261005171122_paiement_code_marchand.sql` ; règles pures `src/lib/paiement/regles.ts` ; client `PanneauPaiement.tsx` ;
reçu `src/app/suivi/[jeton]/recu/` ; restaurateur `CommandeCarte.tsx` ; styles `src/app/paiement.css`.
