/**
 * Lien de confiance entre le site et l'application Android (Trusted Web Activity, voir docs/APPLICATION-ANDROID.md).
 * Servi sur `/.well-known/assetlinks.json` par une réécriture de `next.config.ts`. Sans lui, Android affiche une barre d'adresse
 * dans l'application. L'empreinte est celle du certificat public de signature : elle n'est pas secrète.
 */
const EMPREINTE_SHA256 = "E8:1F:0A:C1:27:6F:44:5A:83:42:56:06:B3:64:7A:3D:D0:D3:7C:21:41:5D:4A:9E:78:BE:BA:E8:40:CB:1F:7C";

export function GET() {
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.speedfood.app", sha256_cert_fingerprints: [EMPREINTE_SHA256] },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
