# Audit et reprise — 11 octobre 2026

Ce dossier est la source documentaire unique pour l'audit du 11 octobre 2026.

## Documents

- `audit-visuel-et-ux.md` — constats visuels et UX du site public.
- `audit-logique-securite-performance.md` — logique métier, sécurité et performance.
- `feuille-de-route.md` — décisions et chantiers à venir.
- `journal-deploiement.md` — historique des déploiements et contrôles associés.
- `captures/` — captures de l'audit visuel.

## État réconcilié

- Dépôt : branche `master`, commit `ae226bd`, synchronisé avec `origin/master`.
- Production : version Cloudflare `137079a9-2fb2-4da0-a76b-6ad700925df0`.
- Test connecté : la fiche restaurant super-admin a été ouverte en production avec le compte fourni par le propriétaire. Le formulaire « Demander une correction » a été soumis avec un motif vide ; l'erreur serveur est restée visible dans la fenêtre, le motif a été conservé et aucun restaurant n'a été modifié.
- Aucun commit local non poussé n'est à trier. Les anciens rapports non suivis ont été classés ici au lieu de rester à la racine.

## Limites restantes

- Le test positif d'une modération réussie n'a pas été exécuté afin de ne pas modifier les données de production sans nécessité.
- Le dépôt est encore situé sous OneDrive ; son déplacement vers `C:\Users\moelo\dev\speedfood` doit être effectué par le propriétaire, session MiniMax fermée.
- Les secrets déjà exposés doivent être tournés manuellement : clé de service Supabase, clés VAPID, jetons concernés et mot de passe du compte de test partagé.
