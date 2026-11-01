# Lot connexion client Expo

Objectif : connexion réelle par e-mail/mot de passe existant, session protégée sur Android/iOS, lectures privées par l’API unique. Aucun envoi de commande.

Fichiers : API configuration publique, CORS des seules lectures privées et câblage différé ; module mobile connexion (transport, gestion de session, coffre et formulaire), bouton du catalogue, plugin SecureStore et verrou npm ; tests et documents de reprise.

Étapes : spécification ; tests rouges ; implémentation ; tests verts ; cinq mutations et restauration ; relecture ; commit ; contrôle du paquet workerd et déploiement API isolé sans fichier de secrets ; lectures publiques de contrôle ; formulaire vérifié sans identifiants ; essai réel par saisie personnelle de Malika. Les appareils et le coffre système restent une vérification distincte.

Retour arrière : revenir à la version API 22542e7e-fdfe-4cd1-beb2-f978f9923aff, si toujours précédente et sans changement ultérieur à conserver, et retirer l’entrée connexion mobile. Ne pas supprimer de compte ni altérer catalogue/panier/ADR-021. Le coffre natif doit être effacé par une déconnexion normale avant retrait chez les testeurs. Aucun SQL à annuler.

Suivi : docs/specs/2026-11-01-connexion-client-expo.md et documents de statut. La connexion d’un vrai compte ne doit pas être déclarée vérifiée sur la seule base des tests simulés.
