# Banc réservation de table (lot M4a) — usage local uniquement

Ce projet séparé n'est importé ni par `src/app`, ni par la configuration normale, ni par le paquet de production. Il sert à essayer la réservation de table de l'application Expo (client et restaurateur) **sans toucher à la production**.

Il réutilise **les vrais écrans** (`ReserverTableReel`, `MesReservationsReel`, `ReservationsRestaurateurReel`), **les vrais contrôles**, **GestionSession**, **le vrai client réseau** (`creerAuth`, neuf méthodes de réservation), **les vraies routes Hono** et **les vrais services** de l'API (règles de statut, de temps, plafond de 3, doublon de créneau, capacité). Seule la base est factice, EN MÉMOIRE : aucune écriture réelle, aucun appel sortant, aucun secret. Le coffre est une variable en mémoire.

Le transport (`transport.ts`) n'accepte que `http://127.0.0.1:8798`, les chemins de la réservation et trois porteurs factices ; les redirections sont refusées. Toute autre méthode du client produit est branchée sur un `fetch` qui refuse avant réseau.

## Contrôle automatique sans émulateur (aucun serveur, aucun réseau)

Depuis la racine du dépôt (terminal cmd) :

```bash
node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-reservation/parcours-reservation.mjs
```

Treize parcours, sortie « PARCOURS RESERVATION : 13 parcours OK », code 0. Le même parcours est lancé par `npm test` (`tests/reservation-banc.test.ts`).

## Lancement par le contrôleur (essai à l'écran)

Vérifier que 8798 et 8081 sont libres. Ne jamais effacer les données de l'APK ni déconnecter le compte réel.

Banc (racine du dépôt, un terminal) :

```bash
node --experimental-strip-types --import ./apps/api/scripts/enregistrer-resolveur.mjs ./apps/mobile/controle-reservation/serveur.mjs
```

Metro du banc (racine du dépôt, un autre terminal) :

```bash
set EXPO_NO_DOTENV=1&& set EXPO_NO_TELEMETRY=1&& set CI=1&& set NODE_OPTIONS=--dns-result-order=ipv4first&& node node_modules/expo/bin/cli start apps/mobile/controle-reservation --localhost --port 8081 --clear
```

Relais ADB seulement si le contrôleur le décide : `adb reverse tcp:8081 tcp:8081` et `adb reverse tcp:8798 tcp:8798`. Le bandeau doit annoncer « CONTRÔLE LOCAL — DONNÉES FACTICES ». Trois boutons : Client A, Client B, Restaurateur.

## Scénarios

Choisir par un POST local, puis agir dans l'application (cmd, depuis n'importe quel dossier) :

```bat
curl -s -X POST "http://127.0.0.1:8798/__scenario?cas=reservation_ouverte"
curl -s http://127.0.0.1:8798/__etat
```

| Scénario | Situation |
| --- | --- |
| `reservation_ouverte` | le restaurant accepte les réservations ; le client A n'a aucune réservation |
| `reservation_fermee` | le restaurant n'accepte PAS : le bouton « Réserver une table » doit rester masqué |
| `reservations_compte` | le client A a trois réservations : demandée, confirmée, refusée avec motif « Complet ce soir » |
| `restaurateur_demandes` | restaurateur : deux demandes à venir (demain 12 h et 19 h) et une réservation confirmée (demain 20 h) ; choisir le jour de demain pour voir les trois |
| `restaurateur_reglage` | restaurateur : réservations ouvertes, capacité de 20 couverts, aucune réservation |

Choisir un scénario réinitialise le monde factice (réservations, réglages, faute programmée, journal).

## Fautes (pour la PROCHAINE écriture seulement)

```bat
curl -s -X POST "http://127.0.0.1:8798/__faute?type=incertain_applique"
curl -s -X POST "http://127.0.0.1:8798/__faute?type=incertain_perdue"
curl -s -X POST "http://127.0.0.1:8798/__faute?type=capacite_pleine"
```

- `incertain_applique` : l'écriture est appliquée puis le serveur répond par une panne. L'écran affiche « à vérifier », l'envoi est verrouillé ; « Vérifier mes réservations » (ou « Actualiser ») montre que l'écriture a bien eu lieu et lève le verrou.
- `incertain_perdue` : panne avant l'écriture ; la relecture ne trouve rien, le verrou tombe, l'utilisateur peut renvoyer.
- `capacite_pleine` : la prochaine demande est refusée faute de places (message du serveur, aucun verrou).

`/__etat` expose le scénario, la faute programmée, le journal des écritures (`client:creer`, `client:annuler`, `resto:confirmee`…), le nombre de lectures, le nombre de réservations par état et le réglage du restaurant. **Jamais** un nom, un téléphone, une note ni un porteur.

## Parcours à jouer à l'écran

Bouton masqué quand le restaurant est fermé ; jour, heure, minutes par boutons ; récapitulatif « Demande de réservation : table pour N personnes… Aucun paiement » ; envoi unique ; les trois fautes ; plafond de 3 réservations à venir ; créneau en double ; « Mes réservations » (détail, annulation avec confirmation) ; restaurateur : Confirmer, Refuser (motif de 3 à 200 caractères et confirmation), Annuler, réglage (interrupteur, capacité). Vérifier qu'aucune action absente de ce que propose le serveur n'apparaît.

## Retour à l'application normale

Arrêter uniquement ces deux processus de contrôle. Relancer Metro depuis `apps/mobile` (configuration normale). Ne pas annoncer « livré en production » : les routes de réservation ne sont pas déployées.
