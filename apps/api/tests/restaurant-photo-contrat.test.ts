import { test } from "node:test";
import assert from "node:assert/strict";
import { PHOTO_CORPS_MAX_OCTETS, PHOTO_TAILLE_MAX_OCTETS, lireDemandePhotoApp } from "@speedfood/shared/contracts/restaurant-photo";

/** Contrat du lot D4c (`packages/shared/src/contracts/restaurant-photo.ts`) : ce que l'API ET l'application acceptent comme demande de photo. */
const PLAT = "44444444-4444-4444-8444-444444444444";
const fichier = (size: number, type = "image/jpeg") => ({ size, type });

test("D4c contrat : les bornes sont celles du site (5 Mo) et le corps entier a une marge bornée", () => {
  assert.equal(PHOTO_TAILLE_MAX_OCTETS, 5 * 1024 * 1024);
  assert.ok(PHOTO_CORPS_MAX_OCTETS > PHOTO_TAILLE_MAX_OCTETS && PHOTO_CORPS_MAX_OCTETS - PHOTO_TAILLE_MAX_OCTETS <= 128 * 1024);
});

test("D4c contrat : envoi valide (JPEG, PNG, WebP, de 1 octet à 5 Mo exactement)", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    for (const size of [1, 1000, PHOTO_TAILLE_MAX_OCTETS]) {
      const f = fichier(size, type);
      const lu = lireDemandePhotoApp({ platId: PLAT, photo: f, retirer: undefined });
      assert.ok(lu.ok, `${type} ${size}`);
      if (lu.ok) assert.deepEqual(lu.demande, { action: "definir", platId: PLAT, fichier: f });
    }
  }
});

test("D4c contrat : retrait valide = platId + retirer « 1 » sans fichier ; null et absent sont équivalents", () => {
  for (const photo of [undefined, null]) {
    const lu = lireDemandePhotoApp({ platId: PLAT, photo, retirer: "1" });
    assert.ok(lu.ok);
    if (lu.ok) assert.deepEqual(lu.demande, { action: "retirer", platId: PLAT });
  }
});

test("D4c contrat : un plat qui n'est pas un UUID est refusé (envoi comme retrait)", () => {
  for (const platId of [undefined, null, "", "abc", "44444444-4444-4444-8444-44444444444", PLAT + "x", `${PLAT}\n`, 3, [PLAT], { id: PLAT }, "../../etc/passwd"]) {
    for (const [photo, retirer] of [[fichier(10), undefined], [undefined, "1"]] as const) {
      const lu = lireDemandePhotoApp({ platId, photo, retirer });
      assert.equal(lu.ok, false, JSON.stringify(platId));
      if (!lu.ok) assert.equal(lu.message, "Plat inconnu.");
    }
  }
});

test("D4c contrat : retirer autre que « 1 », ou accompagné d'un fichier, est refusé", () => {
  for (const retirer of ["0", "true", "oui", "", " 1", "1 ", 1, true, [1], "11"]) {
    assert.equal(lireDemandePhotoApp({ platId: PLAT, photo: undefined, retirer }).ok, false, JSON.stringify(retirer));
  }
  assert.equal(lireDemandePhotoApp({ platId: PLAT, photo: fichier(10), retirer: "1" }).ok, false, "retrait ET fichier : demande ambiguë");
});

test("D4c contrat : champ photo absent, texte, nul, vide ou sans taille lisible = refus", () => {
  for (const photo of [undefined, null, "", "contenu", 12, true, [], {}, { size: "10", type: "image/jpeg" }, { size: 10 }, { type: "image/jpeg" }, fichier(0), fichier(-1), fichier(1.5), fichier(Number.NaN), fichier(Number.POSITIVE_INFINITY)]) {
    const lu = lireDemandePhotoApp({ platId: PLAT, photo, retirer: undefined });
    assert.equal(lu.ok, false, JSON.stringify(photo));
  }
});

test("D4c contrat : plus de 5 Mo = refus signalé « tropGros » (l'API répond 413) ; type hors JPEG, PNG, WebP = refus", () => {
  const gros = lireDemandePhotoApp({ platId: PLAT, photo: fichier(PHOTO_TAILLE_MAX_OCTETS + 1), retirer: undefined });
  assert.equal(gros.ok, false);
  if (!gros.ok) { assert.equal(gros.tropGros, true); assert.equal(gros.message, "La photo ne peut pas dépasser 5 Mo."); }
  for (const type of ["image/gif", "image/svg+xml", "application/pdf", "text/html", "image/JPEG", "image/jpeg; charset=x", "", "image/heic"]) {
    const lu = lireDemandePhotoApp({ platId: PLAT, photo: fichier(100, type), retirer: undefined });
    assert.equal(lu.ok, false, type);
    if (!lu.ok) assert.equal(lu.tropGros, undefined);
  }
});

test("D4c contrat : la demande ne contient que le plat et le fichier (aucun restaurant n'existe dans ce contrat)", () => {
  const lu = lireDemandePhotoApp({ platId: PLAT, photo: fichier(10), retirer: undefined, restaurantId: "autre", restaurant_id: "autre" } as never);
  assert.ok(lu.ok);
  if (lu.ok) assert.deepEqual(Object.keys(lu.demande).sort(), ["action", "fichier", "platId"]);
});
