import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { verifierJetonLocal } from "../src/identite/jeton.ts";

const ISSUER = "https://exemple.supabase.co/auth/v1";

async function fabrique() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  const config = { cles: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER };
  const signer = (surcharge: { iss?: string; aud?: string; sub?: string | null; exp?: string | number; cle?: CryptoKey; alg?: string } = {}) => {
    const jeton = new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: (surcharge.alg ?? "ES256") as "ES256", kid: "k1" })
      .setIssuer(surcharge.iss ?? ISSUER)
      .setAudience(surcharge.aud ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(surcharge.exp ?? "1h");
    if (surcharge.sub !== null) jeton.setSubject(surcharge.sub ?? "11111111-1111-1111-1111-111111111111");
    return jeton.sign(surcharge.cle ?? privateKey);
  };
  return { config, signer };
}

test("un jeton valide donne l'identifiant du compte", async () => {
  const { config, signer } = await fabrique();
  assert.deepEqual(await verifierJetonLocal(await signer(), config), { id: "11111111-1111-1111-1111-111111111111" });
});

test("un jeton expiré est refusé", async () => {
  const { config, signer } = await fabrique();
  const jeton = await signer({ exp: Math.floor(Date.now() / 1000) - 60 });
  assert.equal(await verifierJetonLocal(jeton, config), null);
});

test("un jeton signé par une autre clé est refusé", async () => {
  const { config, signer } = await fabrique();
  const autre = await generateKeyPair("ES256");
  assert.equal(await verifierJetonLocal(await signer({ cle: autre.privateKey }), config), null);
});

test("un mauvais émetteur ou une mauvaise audience sont refusés", async () => {
  const { config, signer } = await fabrique();
  assert.equal(await verifierJetonLocal(await signer({ iss: "https://autre.supabase.co/auth/v1" }), config), null);
  assert.equal(await verifierJetonLocal(await signer({ aud: "anon" }), config), null);
});

test("un jeton sans compte (sub absent) est refusé", async () => {
  const { config, signer } = await fabrique();
  assert.equal(await verifierJetonLocal(await signer({ sub: null }), config), null);
});

test("une valeur qui n'est pas un jeton est refusée sans lever d'exception", async () => {
  const { config } = await fabrique();
  assert.equal(await verifierJetonLocal("pas-un-jeton", config), null);
  assert.equal(await verifierJetonLocal("", config), null);
});

test("un jeton non signé (alg none) est refusé", async () => {
  const { config } = await fabrique();
  const enTete = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const corps = Buffer.from(JSON.stringify({ iss: ISSUER, aud: "authenticated", sub: "x", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  assert.equal(await verifierJetonLocal(`${enTete}.${corps}.`, config), null);
});
