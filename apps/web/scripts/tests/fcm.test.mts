import { construireMessageFcm, contenuPourType, typeNotificationPourReponseReservation, creerAssertionJwt, interpreterReponseFcm, jetonAppareilValide, lireCompteServiceFcm, PORTEE_FCM, URL_JETON_GOOGLE, type TypeNotification } from "../../src/lib/push/fcm";

let ko = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
    ko++;
    console.log(`ECHEC ${nom}\n   obtenu : ${JSON.stringify(obtenu)}\n   attendu: ${JSON.stringify(attendu)}`);
  } else {
    console.log(`OK    ${nom}`);
  }
}

// Paire de clés de test (RSA 2048) : le compte de service factice porte la clé privée, la signature se vérifie avec la clé publique.
const paire = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", paire.privateKey));
let binaire = "";
for (const o of pkcs8) binaire += String.fromCharCode(o);
const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(binaire).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
const secret = JSON.stringify({ type: "service_account", project_id: "speedfood-test-1", client_email: "firebase-adminsdk-x@speedfood-test-1.iam.gserviceaccount.com", private_key: pem });

const compte = lireCompteServiceFcm(secret);
verifier("compte de service lu", compte && { p: compte.projectId, e: compte.clientEmail }, { p: "speedfood-test-1", e: "firebase-adminsdk-x@speedfood-test-1.iam.gserviceaccount.com" });
verifier("secret absent, vide ou illisible : aucune configuration", [lireCompteServiceFcm(undefined), lireCompteServiceFcm(""), lireCompteServiceFcm("pas du json"), lireCompteServiceFcm("{}")], [null, null, null, null]);
verifier("secret incohérent refusé (courriel hors compte de service, clé qui n'en est pas une, projet invalide)", [
  lireCompteServiceFcm(JSON.stringify({ project_id: "speedfood-test-1", client_email: "pirate@example.com", private_key: pem })),
  lireCompteServiceFcm(JSON.stringify({ project_id: "speedfood-test-1", client_email: "a@b.iam.gserviceaccount.com", private_key: "pas une cle" })),
  lireCompteServiceFcm(JSON.stringify({ project_id: "X Y", client_email: "a@b.iam.gserviceaccount.com", private_key: pem })),
], [null, null, null]);

// Assertion JWT : trois segments, en-tête et charge attendus, signature RS256 valide.
const maintenant = 1_800_000_000;
const jwt = await creerAssertionJwt(compte!, maintenant);
const [e, c, s] = jwt.split(".");
const decoder = (x: string) => JSON.parse(atob(x.replace(/-/g, "+").replace(/_/g, "/")));
verifier("assertion : en-tête RS256", decoder(e), { alg: "RS256", typ: "JWT" });
verifier("assertion : charge (émetteur, portée limitée à l'envoi de messages, audience Google, une heure)", decoder(c), {
  iss: compte!.clientEmail,
  scope: PORTEE_FCM,
  aud: URL_JETON_GOOGLE,
  iat: maintenant,
  exp: maintenant + 3600,
});
const signature = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
verifier("assertion : signature valide avec la clé publique", await crypto.subtle.verify("RSASSA-PKCS1-v1_5", paire.publicKey, signature, new TextEncoder().encode(`${e}.${c}`)), true);
verifier("assertion : portée = messagerie seulement", PORTEE_FCM, "https://www.googleapis.com/auth/firebase.messaging");

// Message : jamais de donnée personnelle, texte générique, canal et validité par type.
const jeton = "a".repeat(30);
const m = construireMessageFcm(jeton, "commande_nouvelle") as { message: { token: string; notification: { title: string; body: string }; data: Record<string, string>; android: { priority: string; ttl: string; notification: { channel_id: string } } } };
verifier("message : appareil, canal d'alerte, priorité haute, validité 30 min", [m.message.token, m.message.android.notification.channel_id, m.message.android.priority, m.message.android.ttl], [jeton, "alerte_commande", "HIGH", "1800s"]);
verifier("message : données = le type seulement", m.message.data, { type: "commande_nouvelle" });
verifier("offre de course : canal dédié et validité de 60 s (l'offre expire)", [contenuPourType("course_offre").canal, contenuPourType("course_offre").validiteSecondes], ["offre_course", 60]);
verifier("mode validation sans envoi", [("validate_only" in construireMessageFcm(jeton, "essai", true)), ("validate_only" in construireMessageFcm(jeton, "essai"))], [true, false]);
const tous: TypeNotification[] = ["commande_nouvelle", "course_offre", "commande_acceptee", "commande_prete", "commande_terminee", "commande_refusee", "commande_annulee", "essai", "mise_a_jour", "equipe_commande", "reservation_nouvelle", "reservation_confirmee", "reservation_refusee", "reservation_annulee"];
verifier("aucun texte ne contient de donnée personnelle (téléphone, montant, référence, nom)", tous.some((t) => /\d|GNF|SF-|\+224/.test(contenuPourType(t).titre + contenuPourType(t).texte)), false);

// Lot M4c : réservation de table. Texte générique, canal et validité par type ; aucune donnée de client ni motif.
const attendusReservation: Array<[TypeNotification, string, string, string, number]> = [
  ["reservation_nouvelle", "Nouvelle demande de réservation", "alerte_commande", "Une demande de table attend votre réponse. Ouvrez Speedfood.", 1800],
  ["reservation_confirmee", "Réservation confirmée", "suivi_commande", "Votre table est confirmée. Ouvrez Speedfood pour voir les détails.", 3600],
  ["reservation_refusee", "Réservation refusée", "suivi_commande", "Le restaurant n'a pas pu accepter votre demande. Ouvrez Speedfood.", 3600],
  ["reservation_annulee", "Réservation annulée", "suivi_commande", "Le restaurant a annulé votre réservation. Ouvrez Speedfood.", 3600],
];
for (const [type, titre, canal, texte, validite] of attendusReservation) {
  verifier(`réservation « ${type} » : titre, texte, canal et validité`, contenuPourType(type), { titre, texte, canal, validiteSecondes: validite });
  const msg = construireMessageFcm(jeton, type) as { message: { data: Record<string, string>; android: { ttl: string; notification: { channel_id: string } } } };
  verifier(`réservation « ${type} » : le message ne porte que le type (aucun identifiant, nom ni motif), canal et validité de l'envoi`, [msg.message.data, msg.message.android.notification.channel_id, msg.message.android.ttl], [{ type }, canal, `${validite}s`]);
}
verifier("réservation : le canal de l'alerte du restaurant est un canal Android qui existe déjà (alerte_commande) et celui du client aussi (suivi_commande)", [...new Set(attendusReservation.map((a) => a[2]))].sort(), ["alerte_commande", "suivi_commande"]);
verifier("réservation : la réponse du restaurant donne le bon type, rien pour les autres états", [
  typeNotificationPourReponseReservation("confirmee"), typeNotificationPourReponseReservation("refusee"), typeNotificationPourReponseReservation("annulee_restaurant"),
  typeNotificationPourReponseReservation("honoree"), typeNotificationPourReponseReservation("non_honoree"), typeNotificationPourReponseReservation("demandee"), typeNotificationPourReponseReservation("annulee_client"), typeNotificationPourReponseReservation("x"), typeNotificationPourReponseReservation(undefined),
], ["reservation_confirmee", "reservation_refusee", "reservation_annulee", null, null, null, null, null, null]);
verifier("les types de commande existants gardent leur contenu (aucune régression)", [contenuPourType("commande_nouvelle").titre, contenuPourType("commande_refusee").texte, contenuPourType("equipe_commande").canal], ["Nouvelle commande", "Le restaurant n'a pas pu accepter votre commande.", "alerte_commande"]);

// Lecture de la réponse.
verifier("réponses : succès", interpreterReponseFcm(200, { name: "projects/x/messages/1" }), "ok");
verifier("réponses : appareil inconnu ou jeton périmé = à supprimer", [
  interpreterReponseFcm(404, { error: { status: "NOT_FOUND" } }),
  interpreterReponseFcm(404, null),
  interpreterReponseFcm(400, { error: { status: "INVALID_ARGUMENT" } }),
  interpreterReponseFcm(400, { error: { status: "FAILED_PRECONDITION", details: [{ errorCode: "UNREGISTERED" }] } }),
], ["expire", "expire", "expire", "expire"]);
verifier("réponses : authentification, quota, panne = transitoire, l'appareil est gardé", [
  interpreterReponseFcm(401, { error: { status: "UNAUTHENTICATED" } }),
  interpreterReponseFcm(403, { error: { status: "PERMISSION_DENIED" } }),
  interpreterReponseFcm(429, { error: { status: "RESOURCE_EXHAUSTED" } }),
  interpreterReponseFcm(500, null),
  interpreterReponseFcm(503, { error: { status: "UNAVAILABLE" } }),
], ["echec", "echec", "echec", "echec", "echec"]);

// Jeton d'appareil.
verifier("jeton d'appareil bien formé accepté", jetonAppareilValide("fX2k9:APA91bE-abcdefghijklmnopqrstuvwxyz_0123456789"), true);
verifier("jeton d'appareil trop court, trop long ou à caractères interdits refusé", [jetonAppareilValide("court"), jetonAppareilValide("a".repeat(4097)), jetonAppareilValide("a".repeat(30) + "'; drop table"), jetonAppareilValide(12345), jetonAppareilValide(null)], [false, false, false, false, false]);

if (ko > 0) {
  console.log(`\n${ko} ECHEC(S)`);
  process.exit(1);
}
console.log("\nNotifications poussées natives vérifiées.");
