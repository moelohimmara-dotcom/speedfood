# Feuille de Route — Améliorations et Continuité Speedfood (11 octobre 2026)

Ce document consigne les travaux effectués, les chantiers en cours, et les décisions soumises au propriétaire Mo elohim.

---

## 1. Ce qui a été vérifié et déployé en Production

### A. Déploiement Cloudflare Worker du 11 octobre 2026 (Version `137079a9-2fb2-4da0-a76b-6ad700925df0`)
- **Cibles tactiles minimales à 44 px :** (Commit `ad7ac92`) Ajustement dans `src/app/public.css` de la hauteur minimale des pilules de navigation d'en-tête de 40 px à **44 px**, en stricte conformité avec WCAG 2.1 et `DESIGN-SYSTEM.md`.
- **Horodatage explicite de la fraîcheur des plats vedettes :** (Commit `0dfb1d2`) Remplacement du badge opaque « À confirmer » dans `src/app/restaurants/page.tsx` par le composant officiel `<StampFraicheur>` affichant le détail précis calculé (ex. *« dernière confirmation il y a 8 h »* ou *« pas encore confirmé »*).
- **Vérification en production :** Réponse HTTP 200 OK sur toutes les routes publiques (`/`, `/restaurants`), classe `stamp-fraicheur` activement servie dans le HTML.
- **Socle de production :** Maintien de Next.js `16.3.6` et OpenNext `1.20.6` pour garantir la stabilité d'exécution sur le runtime Cloudflare `workerd`.
- **Validation qualité :** 74 tests unitaires validés (100%), 0 erreur TypeScript.

---

## 2. Ce qui attend une décision ou une action du propriétaire

### Décision 1 : Nettoyage des 4 restaurants de test en base Supabase
- **Contexte :** Quatre fiches de test polluent les données de la console super-administrateur.
- **Action requise :** Valider la liste exacte des restaurants à supprimer/archiver avant exécution d'un script ou d'une migration de purge.

### Décision 2 : Exposition des jetons de suivi dans les journaux Cloudflare
- **Contexte :** Les URL `/suivi/[jeton]` peuvent apparaître dans les logs Cloudflare conservés 7 jours. Le `proxy.ts` ne contrôle pas cette collecte et ne peut donc pas masquer seul le paramètre de chemin.
- **Options :**
  - Option A : Accepter provisoirement le risque pour un pilote restreint, avec accès aux logs limité et rotation de tout jeton Cloudflare sur-scopé.
  - Option B : Vérifier une capacité native Cloudflare de redaction des chemins avant persistance.
  - Option C : Concevoir un nouveau mécanisme de suivi avec échange serveur contre une session courte ; cette option invalidera ou migrera les liens existants et doit faire l'objet d'un chantier dédié.

### Décision 3 : Attribution des rôles pour l'équipe (Opérations, Contenu, Support)
- **Contexte :** Votre compte est le seul administrateur actif (`super_admin`).
- **Action requise :** Indiquer si vous souhaitez affecter des rôles à d'autres adresses email via `/system/acces/roles`.

---

## 3. Ce qui est reporté (et pourquoi)

| Sujet | Raison du report |
|---|---|
| Montée de version Next.js vers 16.4+ | Suspendue en attente d'une version d'OpenNext supportant officiellement les patches de Next.js 16.4 sous `workerd` (l'essai précédent a déclenché l'erreur Cloudflare 1101, immédiatement annulée par rollback). |
| Résolution des 5 vulnérabilités de dev `braces` (ESLint) | Dépendance transitive de développement (`eslint-config-next`), sans aucun impact sur le code servi en production. |
| Tests réseaux physiques 3G à Conakry | Nécessite un test sur terminal mobile physique sur le terrain avec SIM locale (Orange Guinée / MTN). |
