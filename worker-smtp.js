// Envoi d'un e-mail par le SMTP de Google (smtp.gmail.com, port 465, TLS dès la connexion), depuis le Worker : `cloudflare:sockets` donne une connexion TCP sortante.
// Authentification par « mot de passe d'application » Google (secret du Worker GOOGLE_SMTP_APP_PASSWORD) : jamais le mot de passe du compte, jamais écrit dans le code ni dans les journaux.
// Client volontairement minimal (un destinataire, texte brut) : EHLO, AUTH LOGIN, MAIL FROM, RCPT TO, DATA, QUIT.
import { connect } from "cloudflare:sockets";

const enc = new TextEncoder();
const dec = new TextDecoder();

function base64(texte) {
  const octets = enc.encode(texte);
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

/** En-tête encodé (RFC 2047) pour un sujet avec des accents. */
function enteteEncode(texte) {
  return /^[\x20-\x7e]*$/.test(texte) ? texte : `=?UTF-8?B?${base64(texte)}?=`;
}

/** Corps en base64, lignes de 76 caractères : sûr pour tout contenu (accents, points en début de ligne). */
function corpsBase64(texte) {
  return base64(texte).replace(/(.{76})/g, "$1\r\n");
}

/**
 * Envoie un message. Lève une erreur sans détail sensible si le serveur refuse (le code SMTP est le seul renseignement conservé).
 * @param {{utilisateur: string, motDePasse: string, de: string, a: string, sujet: string, texte: string, hote?: string, port?: number}} m
 */
export async function envoyerEmail(m) {
  const socket = connect({ hostname: m.hote ?? "smtp.gmail.com", port: m.port ?? 465 }, { secureTransport: "on", allowHalfOpen: false });
  const lecteur = socket.readable.getReader();
  const ecrivain = socket.writable.getWriter();
  let tampon = "";

  async function lireReponse() {
    for (;;) {
      const lignes = tampon.split("\r\n");
      // Une réponse est complète quand sa dernière ligne est de la forme « 250 texte » (et non « 250-texte »).
      const complete = lignes.length > 1 && lignes.slice(0, -1).some((l) => /^\d{3} /.test(l));
      if (complete) {
        const finale = lignes.find((l) => /^\d{3} /.test(l));
        tampon = lignes.slice(lignes.indexOf(finale) + 1).join("\r\n");
        return Number(finale.slice(0, 3));
      }
      const { value, done } = await lecteur.read();
      if (done) throw new Error("smtp_ferme");
      tampon += dec.decode(value);
    }
  }

  async function envoyer(ligne, codesAttendus) {
    if (ligne !== null) await ecrivain.write(enc.encode(`${ligne}\r\n`));
    const code = await lireReponse();
    if (!codesAttendus.includes(code)) throw new Error(`smtp_${code}`);
  }

  try {
    await envoyer(null, [220]);
    await envoyer("EHLO speedfood", [250]);
    await envoyer("AUTH LOGIN", [334]);
    await envoyer(base64(m.utilisateur), [334]);
    await envoyer(base64(m.motDePasse), [235]);
    await envoyer(`MAIL FROM:<${m.de}>`, [250]);
    await envoyer(`RCPT TO:<${m.a}>`, [250, 251]);
    await envoyer("DATA", [354]);
    const message =
      `From: Speedfood <${m.de}>\r\n` +
      `To: <${m.a}>\r\n` +
      `Subject: ${enteteEncode(m.sujet)}\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `Message-ID: <${crypto.randomUUID()}@speedfood>\r\n` +
      "MIME-Version: 1.0\r\n" +
      "Content-Type: text/plain; charset=UTF-8\r\n" +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      `${corpsBase64(m.texte)}\r\n.`;
    await envoyer(message, [250]);
    await envoyer("QUIT", [221]).catch(() => undefined);
  } finally {
    try {
      lecteur.releaseLock();
      ecrivain.releaseLock();
      await socket.close();
    } catch {
      // Connexion déjà fermée : rien à faire.
    }
  }
}
