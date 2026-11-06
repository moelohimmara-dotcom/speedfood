# Notifications restaurateur Expo — plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implantementeur : sonnet. Relecture sécurité : opus, après F1 et après F2. Essai F3 sur émulateur avant de dire « livré ».

**Goal:** Un membre restaurant dans Expo reçoit « Nouvelle commande » et un appui ouvre l’Espace restaurateur.

**Architecture:** Réutiliser le serveur FCM existant (`commande_nouvelle` / `alerte_commande`). Étendre seulement `apps/mobile/src/notifications/` et les branchements UI. Autorisation **C** (connexion membre + ouverture espace, un seul drapeau). Spec : `docs/specs/2026-11-05-notifications-restaurateur-expo-design.md`.

**Tech Stack:** Expo SDK 57, `expo-notifications`, FCM v1 (serveur inchangé), Hono API déjà déployée pour `/appareils`.

## Global Constraints

- Français UI, tokens `DESIGN-SYSTEM` / tokens mobile existants ; pas de `style={{}}` de mise en page hors motifs déjà présents.
- Aucun secret, jeton, mot de passe dans code / logs / chat / commits.
- L’identifiant restaurant ou le booléen UI « restaurateur » n’est jamais une autorisation ; le serveur tranche.
- Une seule demande d’autorisation système ; même SecureStore `speedfood.notifications.demandee.v1`.
- Pas d’écriture barbie food / déploiement / secret sans « oui » explicite de Malika.
- Compte concepteur `moelohimmara` / double rôle d’essai : utile pour F3, **aucune** exception code (pas de liste blanche e-mail).
- Montants GNF entiers (hors sujet ici). Branche de travail seulement, pas `master`.
- Trailer commit : `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Après F1/F2 : `cd apps/mobile && npm test` et `npx tsc --noEmit` (exit 0). Mutations ciblées doivent échouer puis être restaurées.

---

## File map

| Fichier | Responsabilité |
|---|---|
| `apps/mobile/src/notifications/natif.ts` | Créer les 3 canaux Android |
| `apps/mobile/src/notifications/ouverture.ts` | Listes blanches + routage suivi vs resto |
| `apps/mobile/src/notifications/autorisation.ts` | Déclencheur « contexte resto » (même `decider` / drapeau) + messages |
| `apps/mobile/src/notifications/service.ts` | `apresContexteRestaurateur`, brancher ouverture resto |
| `apps/mobile/src/notifications/index.ts` | `brancherOuvertureRestaurateur` |
| `apps/mobile/src/connexion/CompteReel.tsx` | Appels C à l’ouverture espace ; ouverture depuis notif |
| `apps/mobile/src/catalogue/CatalogueReel.tsx` (ou point de session) | Appel C quand session + `moi` restaurateur |
| `apps/mobile/tests/notifications.test.ts` | Tests + mutations F1/F2 |

Serveur / API / migrations : **ne pas toucher**.

---

### Task F1: Canaux Android + ouverture `commande_nouvelle`

**Files:**
- Modify: `apps/mobile/src/notifications/natif.ts`
- Modify: `apps/mobile/src/notifications/ouverture.ts`
- Modify: `apps/mobile/src/notifications/service.ts`
- Modify: `apps/mobile/src/notifications/index.ts`
- Modify: `apps/mobile/src/catalogue/CatalogueReel.tsx` (brancher callback resto — ouverture compte + espace)
- Modify: `apps/mobile/src/connexion/CompteReel.tsx` (exposer ouverture espace depuis l’extérieur si besoin)
- Test: `apps/mobile/tests/notifications.test.ts`

**Interfaces:**
- Consumes: `demarrerOuverture` actuel ; `Notifications.setNotificationChannelAsync`
- Produces: `CANAUX_ANDROID` (ou constantes `CANAL_ALERTE`, `CANAL_OFFRE`) ; `TYPES_NOTIFICATION_RESTAURATEUR = ['commande_nouvelle']` ; `demarrerOuverture({ ouvrirSuivi, ouvrirRestaurateur })` ; `brancherOuvertureRestaurateur(f)`

- [ ] **Step 1: Write the failing tests (ouverture + canaux)**

Dans `notifications.test.ts`, ajouter (noms exacts libres tant que l’intention est couverte) :

```ts
test('ouverture : commande_nouvelle ouvre le restaurateur, pas le suivi', () => {
  let suivi = 0, resto = 0;
  const p = portOuverture();
  demarrerOuverture({
    port: p.port,
    ouvrirSuivi: () => { suivi++; },
    ouvrirRestaurateur: () => { resto++; },
  });
  p.appui(reponse('commande_nouvelle', 'n1'));
  assert.equal(suivi, 0);
  assert.equal(resto, 1);
});

test('ouverture : type client n’ouvre pas le restaurateur', () => {
  let suivi = 0, resto = 0;
  const p = portOuverture();
  demarrerOuverture({ port: p.port, ouvrirSuivi: () => { suivi++; }, ouvrirRestaurateur: () => { resto++; } });
  p.appui(reponse('commande_prete', 'c1'));
  assert.equal(suivi, 1);
  assert.equal(resto, 0);
});

test('canaux : le port natif crée suivi, alerte_commande et offre_course', async () => {
  // journaliser les ids passés à creerCanal / setNotificationChannelAsync selon l’API du port
});
```

Adapter le test existant qui appelle `demarrerOuverture` avec seulement `ouvrirSuivi` : exiger le 2ᵉ callback (ou défaut no-op **interdit** en prod — mieux : signature obligatoire pour faire échouer les oublis).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/mobile && npm test -- tests/notifications.test.ts`  
Expected: FAIL (signature / types resto absents).

- [ ] **Step 3: Implement canaux in `natif.ts`**

```ts
export const CANAL_SUIVI = 'suivi_commande';
export const CANAL_ALERTE = 'alerte_commande';
export const CANAL_OFFRE = 'offre_course';

async creerCanal() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_SUIVI, { name: 'Suivi de commande', importance: Notifications.AndroidImportance.HIGH });
  await Notifications.setNotificationChannelAsync(CANAL_ALERTE, { name: 'Nouvelles commandes', importance: Notifications.AndroidImportance.HIGH });
  await Notifications.setNotificationChannelAsync(CANAL_OFFRE, { name: 'Nouvelles courses', importance: Notifications.AndroidImportance.HIGH });
},
```

- [ ] **Step 4: Implement routage in `ouverture.ts`**

```ts
export const TYPES_NOTIFICATION_RESTAURATEUR = ['commande_nouvelle'] as const;

export function typeDeRestaurateur(reponse: ReponseNotification | null | undefined): string | null { /* même forme que typeDeSuivi */ }

export function demarrerOuverture(d: {
  port: PortOuverture;
  ouvrirSuivi(): void;
  ouvrirRestaurateur(): void;
}): () => void {
  // une seule fois par identifier ; si type resto → ouvrirRestaurateur ; sinon si type suivi → ouvrirSuivi
}
```

- [ ] **Step 5: Wire `service.ts` + `index.ts` + UI**

- `DepsService` gagne `ouvrirRestaurateur(): void`.
- `index.ts` : `brancherOuvertureRestaurateur` miroir de `brancherOuvertureSuivi`.
- `CatalogueReel` / `CompteReel` : brancher un callback qui ouvre Mon compte **et** l’espace restaurateur (modal). Si le compte n’est pas encore monté, ouvrir le compte puis l’espace dès que possible (même esprit que `lecture-differee` pour le suivi) — **sans** lire la liste commandes automatiquement au-delà de l’existant `RestaurateurReel` à l’ouverture.

- [ ] **Step 6: Run tests — expect PASS ; mutations**

Mutations à faire échouer puis restaurer :
1. `commande_nouvelle` appelle `ouvrirSuivi`.
2. `creerCanal` ne crée que `suivi_commande`.

Run: `cd apps/mobile && npm test && npx tsc --noEmit`

- [ ] **Step 7: Commit (branche de travail)**

```bash
git add apps/mobile/src/notifications apps/mobile/src/catalogue apps/mobile/src/connexion apps/mobile/tests/notifications.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): canaux alerte/offre et ouverture resto sur commande_nouvelle

EOF
)"
```

Ajouter `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

- [ ] **Step 8: Relecture sécurité (opus)** — focus : pas de fuite de données dans le routage ; callbacks sans escalade de privilège.

---

### Task F2: Autorisation C + messages resto

**Files:**
- Modify: `apps/mobile/src/notifications/autorisation.ts`
- Modify: `apps/mobile/src/notifications/service.ts`
- Modify: `apps/mobile/src/connexion/CompteReel.tsx`
- Modify: point d’appel `sessionOuverte` / post-connexion (là où `notifications.sessionOuverte()` est déjà appelé)
- Test: `apps/mobile/tests/notifications.test.ts`

**Interfaces:**
- Consumes: `decider`, `apresCommandeEnvoyee`, `memoireDemande`, `gestion.moi()`
- Produces: `apresContexteRestaurateur({ port, memoire })` (même forme de retour que `apresCommandeEnvoyee`) ; `MESSAGES_ETAT_RESTO` ; `service.apresContexteRestaurateur()`

- [ ] **Step 1: Write failing tests**

```ts
test('autorisation C : sans rôle resto, déclencheur contexte → rien (même si jamais demandé)', async () => {
  // API pure : fonction qui prend { estRestaurateur: false, ... } → decision rien sans appeler demander
});

test('autorisation C : membre + jamais demandé → demander une fois ; second déclencheur → rien', async () => {
  // deux appels apresContexteRestaurateur avec estRestaurateur true
});

test('autorisation C : même drapeau que après commande — commande puis contexte ne redemande pas', async () => {
  await apresCommandeEnvoyee(...);
  await apresContexteRestaurateur(...);
  assert.equal(journal.demandes, 1);
});
```

Réutiliser `decider({ commandeEnvoyee: true, ... })` **ou** renommer sémantiquement en `declencheurMetier: boolean` dans une PR claire — **ne pas** dupliquer la machine à états. Si rename : mettre à jour tous les tests existants dans le même commit.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `apresContexteRestaurateur`**

Si `!estRestaurateur` → `{ decision: 'rien', affiche: null }` sans lire le drapeau de façon à demander.  
Si restaurateur → même flux que `apresCommandeEnvoyee` (marquer avant demander).

Messages :

```ts
export const MESSAGES_ETAT_RESTO: Record<EtatAffiche, string> = {
  actives: 'Vous serez prévenu des nouvelles commandes.',
  desactivees: 'Notifications désactivées : ouvrez l’espace restaurateur et actualisez.',
};
```

- [ ] **Step 4: Branch UI**

1. Après `moi()` concluant `restaurateur !== null` (session ouverte / CompteReel montage connecté) : `void notifications.apresContexteRestaurateur().then(...)` — afficher le message resto si non null (sans écraser inutilement le message client si les deux rôles : préférer le message le plus récemment obtenu, ou concaténer en une seule ligne courte si déjà un bandeau — rester simple : **dernier message gagne**).
2. Au tap « Espace restaurateur » : appeler `apresContexteRestaurateur` puis ouvrir le modal (l’espace s’ouvre même si la demande échoue).

`sessionOuverte()` reste : réenregistrement si déjà accordée, **sans** demande. La demande membre passe par `apresContexteRestaurateur` après connaissance du rôle.

- [ ] **Step 5: Tests PASS + mutations**

Mutations :
1. Demander même si `estRestaurateur === false`.
2. Deuxième déclencheur C rappelle `demander`.

Run: `cd apps/mobile && npm test && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(mobile): autorisation notifications restaurateur (choix C)

EOF
)"
```

- [ ] **Step 7: Relecture sécurité (opus)** — focus : pas de demande pour non-membre ; drapeau unique ; pas de jeton loggé.

---

### Task F3: Essai réel émulateur + journal

**Files:**
- Modify: `docs/PASSATION-CHANTIER-SPEEDFOOD-APP.md`
- Modify: ce plan (cocher F3 + constats)
- Optionally: note dans `docs/plans/2026-11-04-notifications-push-client-expo.md` (lien croisé)

- [ ] **Step 1: Prérequis**

- AVD `speedfood_pixel` (Play Store), `private_dns_mode off`, Wi-Fi CONNECTED.
- APK Expo avec Firebase (`google-services` / CI) installée `com.speedfood.clientdemo`.
- Compte membre (essai : double rôle concepteur / `elohim`) connecté ; `POST_NOTIFICATIONS` possible.
- **Oui de Malika** pour une seule commande TEST barbie food (écriture).

- [ ] **Step 2: Parcours**

1. Connexion membre → constater demande d’autorisation **ou** déjà accordée (C).
2. (Optionnel) Fermer / rouvrir Espace restaurateur → pas de 2ᵉ boîte.
3. Depuis un second contexte (autre session client, ou même compte en flux commande) : créer **une** commande TEST retrait minimale (oui Malika).
4. Sur l’appareil resto : notification **« Nouvelle commande »** / « Une commande attend votre réponse… » (canal `alerte_commande`).
5. Appui (appli en arrière-plan ou fermée) → Espace restaurateur.
6. Preuve annexe : `dumpsys notification` / capture tiroir ; ne jamais coller de jeton FCM.

- [ ] **Step 3: Journal passation**

Mettre à jour §1, §5, §6 P1.2, §9 de `PASSATION-CHANTIER-SPEEDFOOD-APP.md` : F1–F3 faits / constats / prochaine action (ex. livreur ou vrai téléphone).

- [ ] **Step 4: Commit docs seulement** (si Malika le demande) — sinon laisser le journal en working tree jusqu’à son feu vert commit.

---

## Hors plan

Livreur (`course_offre` → UI), équipe (`equipe_commande`), iPhone, bascule `com.speedfood.app`, déploiement API/site.

## Risques (rappel)

Silence sans `FCM_SERVICE_ACCOUNT` ; flakiness Google Play Services sur AVD ; double rôle = deux familles de notifs sur un jeton (voulu).

## Self-review du plan

- Spec §2–§10 couverts par F1–F3.
- Pas de TBD / « similar to ».
- Serveur non modifié (spec §4).
- Choix C et exceptions `moelohimmara` sans trou de sécurité (spec §3, §5, §9).

## Reprise du 6 novembre 2026 (en cours)

- Accord de Malika pour poursuivre les notifications restaurateur. Aucun déploiement ni nouvelle écriture barbie food réalisé pendant cette reprise ; chaque écriture nécessitera son oui distinct sur l'action exacte.
- État réel : F1-F2 sont déjà committés et poussés (362d8c7), contrairement à la section 9 de la passation qui les annonce non committés. F3 reste à prouver. La capture « prête » du second passage du 5 novembre est documentée ; aucun nouvel essai physique prétendu.
- Méthode : Claude Code installé, session Sonnet dédiée à l'implémentation/corrections, session Opus indépendante de relecture, sources sélectionnées uniquement. Aucun fichier de secrets donné aux modèles, aucun accès aux sessions personnelles. Le contrôleur relance lui-même les suites.
- Premier audit Sonnet : B1 ouverture à chaud de commande_nouvelle ne réagit pas au changement de demande alors que la session est déjà ouverte ; B2 deux déclencheurs simultanés peuvent demander deux fois l'autorisation. Tests rouges demandés à Sonnet avant correctif ; relecture Opus en cours. Aucun verdict « livré ».
- Objectif du correctif : demande restaurateur consommée une seule fois, à chaud et à froid, sans ouverture pour non-membre ; exclusion des demandes d'autorisation simultanées client/restaurateur, sans nouveau drapeau ni affaiblissement serveur. Corrections par le même Sonnet, puis Opus, mutations avec restauration garantie.
- Fichiers prévus : notifications/autorisation.ts ou service.ts, petit domaine pur d'ouverture si nécessaire, connexion/CompteReel.tsx, tests mobiles ciblés. Retour arrière : rétablir les fichiers de 362d8c7 ; aucun changement serveur, base ou réglage de production.
- Après vert : toutes les suites prescrites, paquet Android de contrôle, essai émulateur (canal Nouvelle commande puis appui à chaud et à froid). Une commande TEST seulement après accord distinct. Protéger toute écriture incertaine : aucune relance automatique.
- Autres décisions : Malika a répondu « Oui et ok pour tout cela » après rappel du retrait du prompt de l'historique, de la fusion et du nettoyage des espèces. Préparer séparément chaque opération et sa portée. Aucun retrait d'historique, force-push ou modification de master effectué ici ; contrainte actuelle : seul le push de la branche de travail est permis.

- Choix C confirmé par Malika le 6 novembre : demande unique après reconnaissance du rôle restaurateur, y compris réouverture ; contradiction de la spec corrigée explicitement. Rouge B1/B2 constaté par le contrôleur (10 échecs sur 11 tests). Après correction par le même Sonnet : 14 tests ciblés et types mobiles code 0. Relecture Opus ciblée et mutations en cours ; aucun essai F3 prétendu.

### Correctif B1/B2 — contrôles locaux terminés le 6 novembre

- Implémentation : même session Sonnet, corrections reprises par message. Relecture indépendante Opus : prêt pour essai F3 seulement. Une réserve sur le verrou a été levée après lecture du nettoyage existant de RestaurateurReel (signalerOccupe(false) au démontage), sans correctif inutile.
- Rouge : 10 échecs / 11 tests avant code ; vert : 14 ciblés. Mutations exécutées personnellement : partage supprimé, demande non consommée, rôle inconnu mal traité, garde occupé retirée, armement débranché ; cinq codes 1, sources restaurées octet pour octet via finally, ciblé final code 0.
- Relancés personnellement après correctifs : npm run typecheck, test:api, test:unit, test:cloisonnement (489 contrôles), build:api ; npm test mobile (500/500) et tsc mobile. Tous codes 0. Journaux locaux hors dépôt : C:/Users/moelo/dev/reprise-f3-final-*.log.
- Preuve native restante : nouveau paquet contenant le correctif, installation par-dessus le paquet de contrôle sans effacement des données, notification Nouvelle commande et ouverture espace à chaud/froid. Aucun verdict livré. I1/I2 hérités et autres cas E3 restent ouverts.
