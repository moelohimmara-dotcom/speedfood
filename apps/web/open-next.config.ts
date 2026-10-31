import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// L'app est presque entièrement dynamique (Server Actions, sessions Supabase
// par requête) : peu de pages statiques/ISR à mettre en cache, et aucune ne
// nécessite de revalidation pour l'instant. Ce cache "assets statiques" évite
// de créer un bucket R2 (nouvelle ressource cloud payante) sans consigne
// explicite de Malika (CLAUDE.md). À revoir si le bloc 8 (CMS) introduit des
// pages publiques à fort trafic qui bénéficieraient d'une vraie revalidation.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
