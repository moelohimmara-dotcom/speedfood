import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialise les bindings Cloudflare (Workers) pendant `next dev`, pour que le
// code serveur qui y accède ne se comporte pas différemment qu'en production
// déployée. Voir docs/DEPLOIEMENT-CLOUDFLARE.md.
initOpenNextCloudflareForDev();

// En-têtes de sécurité appliqués à toutes les routes (source "/:path*", vérifié
// avant le système de fichiers d'après la documentation Next 16 locale).
//
// Volontairement limités à ceux qui ne peuvent pas casser le rendu. La CSP est
// laissée de côté pour l'instant : elle exige un essai à part, à cause des
// scripts inline du App Router et du widget Turnstile (challenges.cloudflare.com).
// Politique de sécurité du contenu, exprimée en une seule chaîne pour rester
// lisible. Sources légitimes du site :
//  - `challenges.cloudflare.com` : widget Turnstile (script, cadre, réseau)
//  - le projet Supabase : appels de données et images du stockage
//  - `https:` pour les images : les photos de plats peuvent être des adresses
//    externes fournies par le restaurateur (Unsplash pour les données de démo)
// `'unsafe-inline'` est requis par les scripts et styles inline du App Router.
const politiqueContenu = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://ggldjdizqrtpetdiohxy.supabase.co https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  // `frame-ancestors 'self'` : le clickjacking consiste à faire afficher une page DANS un cadre par
  // un site TIERS, sous une couche invisible qui vole les clics. `'self'` l'interdit entièrement —
  // aucun site extérieur ne peut encadrer `/system`, `/restaurant` ni le site public, exactement
  // comme le faisait `'none'`.
  //
  // Ce qui change, et pourquoi (décision de la propriétaire, 7 octobre 2026) : la valeur précédente
  // était `'none'` / `DENY`, qui interdisait TOUT encadrement, y compris depuis le site lui-même.
  // L'aperçu vivant de `/system/design` (palier 4) affiche l'accueil dans un iframe de même origine :
  // il était donc impossible, et affichait une page vide. Passer à `'self'` / `SAMEORIGIN` rend
  // l'aperçu possible sans rouvrir la moindre surface pour un attaquant externe.
  //
  // Le risque résiduel est réel mais minime : une page du site pourrait être encadrée par une autre
  // page du site. Cela suppose déjà une injection de script sur cette origine — c'est-à-dire un XSS,
  // qui est strictement plus grave que du clickjacking, et que ces en-têtes empêchaient déjà
  // aujourd'hui.
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const enTetesSecurite = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Contemporain de `frame-ancestors` : même valeur, même raison. X-Frame-Options est conservé
  // parce que certains navigateurs anciens ne lisent pas la CSP — c'est une défense en profondeur,
  // pas une redondance. Voir le commentaire sur `frame-ancestors` ci-dessus pour le `'self'`.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Force HTTPS pendant un an (test de sécurité du 4 octobre 2026). Sans `preload` ni `includeSubDomains` : le domaine
  // définitif n'est pas encore choisi.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  // Validée en mode rapport seul dans un vrai navigateur (13 pages, y compris le
  // widget Turnstile réellement chargé sur /commande) : aucune violation.
  { key: "Content-Security-Policy", value: politiqueContenu },
];

const nextConfig: NextConfig = {
  // Ne pas annoncer « X-Powered-By: Next.js » à chaque réponse.
  poweredByHeader: false,
  // Les actions serveur sont limitées à 1 Mo par défaut ; une photo peut aller jusqu'à 5 Mo (storage/images.ts).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [{ source: "/:path*", headers: enTetesSecurite }];
  },
};

export default nextConfig;
