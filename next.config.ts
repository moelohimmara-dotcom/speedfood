import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Initialise les bindings Cloudflare (Workers) pendant `next dev`, pour que le
// code serveur qui y accède ne se comporte pas différemment qu'en production
// déployée. Voir docs/DEPLOIEMENT-CLOUDFLARE.md.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
