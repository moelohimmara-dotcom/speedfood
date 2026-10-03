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
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: enTetesSecurite }];
  },
};

export default nextConfig;
