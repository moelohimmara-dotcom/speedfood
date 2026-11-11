import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** M4c : contrôles STATIQUES du source (câblage de production et discipline des journaux). Les tests de comportement injectent des doublures ; ceux-ci lisent ce que les fichiers font vraiment. */
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const sansCommentaires = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");

test("M4c câblage : le service client alerte par `fournirAlerteReservationSite`, le service restaurateur prévient par `fournirMessageReservationSite`, liaison lue à l'appel", () => {
  const c = sansCommentaires(lire("../src/reservation/cablage.ts"));
  assert.match(c, /alerterNouvelleDemande: \(restaurantId, environnement\) => fournirAlerteReservationSite\(\(\) => environnement\)\(restaurantId\)/);
  assert.match(c, /prevenirClient: \(reservationId, statut, environnement\) => fournirMessageReservationSite\(\(\) => environnement\)\(reservationId, statut\)/);
  assert.doesNotMatch(c, /fournirAlerteSite|commandes\/alerte-site/, "l'alerte des commandes n'est pas touchée ni réutilisée");
});

test("M4c worker : le câblage de production ne change pas (aucune alerte de commande ajoutée ni retirée, aucun relais touché)", () => {
  const w = sansCommentaires(lire("../src/worker.ts"));
  assert.equal((w.match(/fournirAlerteSite\(/g) ?? []).length, 1);
  assert.doesNotMatch(w, /fournirAlerteReservationSite|fournirMessageReservationSite/);
});

test("M4c : le fichier de la liaison n'écrit que le code fixe `alerte_reservation_site_echec` et appelle uniquement les deux méthodes RPC prévues", () => {
  const s = sansCommentaires(lire("../src/notifications/reservation-site.ts"));
  const sorties = [...s.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(sorties, ['"alerte_reservation_site_echec"']);
  assert.match(s, /alerterReservation/);
  assert.match(s, /prevenirClientReservation/);
  assert.doesNotMatch(s, /\.alerter\b|\balerter\(/, "jamais la méthode des commandes");
  assert.doesNotMatch(s, /\bfetch\(|https?:\/\//, "aucun appel HTTP public, aucune adresse");
});

test("M4c : aucun fichier de la réservation (hors la liaison) n'écrit dans les journaux", () => {
  const dossier = fileURLToPath(new URL("../src/reservation/", import.meta.url));
  for (const f of readdirSync(dossier).filter((x) => x.endsWith(".ts"))) {
    assert.doesNotMatch(sansCommentaires(lire("../src/reservation/" + f)), /console\./, f);
  }
  assert.doesNotMatch(sansCommentaires(lire("../src/routes/reservation.ts")), /console\./);
});

test("M4c : les services ne planifient qu'APRÈS une écriture réussie et absorbent toute panne de la notification", () => {
  const client = sansCommentaires(lire("../src/reservation/client.ts"));
  // Création : la planification vient APRÈS le refus (`!r.ok`) et le rejeu, jamais avant.
  const creer = client.slice(client.indexOf("async creer("), client.indexOf("async disponibilite("));
  const iRefus = creer.indexOf("if (!r.ok) return refus(");
  const iRejeu = creer.indexOf('if (r.etat === "rejeu") return');
  const iPlanifier = creer.indexOf("planifier(apres, p.alerterNouvelleDemande");
  assert.ok(iRefus > 0 && iRejeu > iRefus && iPlanifier > iRejeu, "refus, puis rejeu, puis planification");
  assert.equal((creer.match(/planifier\(/g) ?? []).length, 1, "une seule planification dans la création");
  const resto = sansCommentaires(lire("../src/reservation/restaurateur.ts"));
  assert.match(resto, /if \(r\.ok\) \{\s*if \(MESSAGE_AU_CLIENT\.has\(cible\)\)/);
});
