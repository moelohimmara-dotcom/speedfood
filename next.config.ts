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
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const enTetesSecurite = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Aucune page du site n'a vocation à être affichée dans un cadre : protège les
  // consoles /restaurant et /system du détournement de clic (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Validée en mode rapport seul dans un vrai navigateur (13 pages, y compris le
  // widget Turnstile réellement chargé sur /commande) : aucune violation.
  { key: "Content-Security-Policy", value: politiqueContenu },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: enTetesSecurite }];
  },
};

export default nextConfig;
