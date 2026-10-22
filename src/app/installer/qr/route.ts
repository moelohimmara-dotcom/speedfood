import qrcode from "qrcode-generator";

/**
 * QR code (SVG) vers la page de téléchargement de l'application (`/installer`), affiché sur l'accueil et sur la page elle-même pour passer de l'ordinateur au téléphone.
 * Le contenu ne dépend que de l'adresse du site ; public, mis en cache un jour.
 */
export async function GET(requete: Request): Promise<Response> {
  const qr = qrcode(0, "M");
  qr.addData(`${new URL(requete.url).origin}/installer`);
  qr.make();
  return new Response(qr.createSvgTag({ cellSize: 8, margin: 4, scalable: true }), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
