/** Sources de visite d'un lien court, SANS dépendance (testable seul). Doit rester alignée sur `fn_compter_scan`. */
export const SOURCES_SCAN = ["qr", "affiche", "whatsapp", "carte", "table", "lien"] as const;
export type SourceScan = (typeof SOURCES_SCAN)[number];

export const LIBELLES_SOURCE: Record<SourceScan, string> = {
  qr: "QR code",
  affiche: "Affiche",
  whatsapp: "WhatsApp",
  carte: "Carte de visite",
  table: "Table",
  lien: "Lien direct",
};

export function lireSourceScan(brut: string | null): SourceScan {
  return (SOURCES_SCAN as readonly string[]).includes(brut ?? "") ? (brut as SourceScan) : "lien";
}

/** Aperçus de liens et robots : ils ouvrent le lien sans qu'une personne l'ait scanné. */
export function estRobotApercu(agent: string | null): boolean {
  if (!agent) return true;
  return /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|embedly|headless|curl|wget|monitor/i.test(agent);
}

/** Lien court à imprimer ou partager. */
export function lienCourt(origine: string, code: string, source: SourceScan): string {
  return `${origine.replace(/\/+$/, "")}/r/${code}?s=${source}`;
}
