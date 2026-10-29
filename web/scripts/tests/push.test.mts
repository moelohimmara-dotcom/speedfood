import {
  creerJetonVapid,
  depuisBase64Url,
  enteteAutorisationVapid,
  estPointAccesPushAutorise,
  interpreterReponsePush,
  sujetVapidValide,
  versBase64Url,
} from "../../src/lib/push/vapid";

let ko = 0;
let total = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  total++;
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Paire de clés de test (jamais celle de production)
const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", paire.privateKey);
const brute = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
const cles = { clePublique: versBase64Url(brute), clePrivee: jwk.d as string, sujet: "mailto:test@example.com" };

verifier("clé publique non compressée de 65 octets", brute.length, 65);
verifier("aller-retour base64url", versBase64Url(depuisBase64Url("AQID_-8")), "AQID_-8");

const maintenant = Date.UTC(2026, 9, 4, 12, 0, 0);
const endpoint = "https://fcm.googleapis.com/fcm/send/abcdefghijklmnop";
const jeton = await creerJetonVapid(endpoint, cles, maintenant);
const [e, r, s] = jeton.split(".");
const entete = JSON.parse(new TextDecoder().decode(depuisBase64Url(e)));
const revendications = JSON.parse(new TextDecoder().decode(depuisBase64Url(r)));

verifier("trois parties", jeton.split(".").length, 3);
verifier("algorithme ES256", entete, { typ: "JWT", alg: "ES256" });
verifier("audience = origine du service de push", revendications.aud, "https://fcm.googleapis.com");
verifier("expiration à 12 h", revendications.exp, Math.floor(maintenant / 1000) + 12 * 3600);
verifier("expiration sous 24 h (limite des services)", revendications.exp - Math.floor(maintenant / 1000) <= 24 * 3600, true);
verifier("contact présent", revendications.sub, "mailto:test@example.com");
verifier("signature brute de 64 octets", depuisBase64Url(s).length, 64);

const signatureValide = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  paire.publicKey,
  depuisBase64Url(s),
  new TextEncoder().encode(`${e}.${r}`)
);
verifier("la signature se vérifie avec la clé publique", signatureValide, true);

const falsifiee = await crypto.subtle.verify(
  { name: "ECDSA", hash: "SHA-256" },
  paire.publicKey,
  depuisBase64Url(s),
  new TextEncoder().encode(`${e}.${r}x`)
);
verifier("un jeton modifié est rejeté", falsifiee, false);

verifier("en-tête d'autorisation", enteteAutorisationVapid("JETON", "CLE"), "vapid t=JETON, k=CLE");

let refuse = false;
try {
  await creerJetonVapid(endpoint, { ...cles, sujet: "pas-un-contact" }, maintenant);
} catch {
  refuse = true;
}
verifier("contact invalide refusé", refuse, true);

let cleInvalide = false;
try {
  await creerJetonVapid(endpoint, { ...cles, clePublique: "AAAA" }, maintenant);
} catch {
  cleInvalide = true;
}
verifier("clé publique invalide refusée", cleInvalide, true);

verifier("contact mailto valide", sujetVapidValide("mailto:moelohimmara@gmail.com"), true);
verifier("contact https valide", sujetVapidValide("https://speedfood-app.moelohimmara.workers.dev"), true);
verifier("contact vide refusé", sujetVapidValide(""), false);
verifier("contact http refusé", sujetVapidValide("http://exemple.com"), false);

// Liste blanche anti-SSRF
verifier("FCM autorisé", estPointAccesPushAutorise("https://fcm.googleapis.com/fcm/send/abcdefghij12345"), true);
verifier("Mozilla autorisé", estPointAccesPushAutorise("https://updates.push.services.mozilla.com/wpush/v2/abcdefghij"), true);
verifier("Apple autorisé", estPointAccesPushAutorise("https://web.push.apple.com/QAbcdefghijklmnop"), true);
verifier("Windows autorisé", estPointAccesPushAutorise("https://db5p.notify.windows.com/w/?token=abcdefghij"), true);
verifier("hôte arbitraire refusé", estPointAccesPushAutorise("https://exemple.com/push/abcdefghij12345"), false);
verifier("adresse interne refusée", estPointAccesPushAutorise("https://169.254.169.254/latest/meta-data/xxx"), false);
verifier("localhost refusé", estPointAccesPushAutorise("https://localhost/abcdefghijklmnopqrst"), false);
verifier("http refusé", estPointAccesPushAutorise("http://fcm.googleapis.com/fcm/send/abcdefghij12345"), false);
verifier("imitation de domaine refusée", estPointAccesPushAutorise("https://fcm.googleapis.com.evil.com/abcdefghijklmnop"), false);
verifier("identifiants dans l'adresse refusés", estPointAccesPushAutorise("https://u:p@fcm.googleapis.com/fcm/send/abcdefgh"), false);
verifier("port refusé", estPointAccesPushAutorise("https://fcm.googleapis.com:8443/fcm/send/abcdefghij"), false);
verifier("adresse trop courte refusée", estPointAccesPushAutorise("https://fcm.googleapis.com"), false);
verifier("adresse illisible refusée", estPointAccesPushAutorise("pas une adresse du tout"), false);

verifier("réponse 201 = succès", interpreterReponsePush(201), "ok");
verifier("réponse 410 = abonnement expiré", interpreterReponsePush(410), "expire");
verifier("réponse 404 = abonnement expiré", interpreterReponsePush(404), "expire");
verifier("réponse 429 = échec passager", interpreterReponsePush(429), "echec");
verifier("réponse 500 = échec passager", interpreterReponsePush(500), "echec");

console.log(`\n${total - ko}/${total} tests passes`);
process.exit(ko ? 1 : 0);
