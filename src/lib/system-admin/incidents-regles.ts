/** Règles pures L10 : aucune décision financière n'est exécutée ici. */
export const TYPES_INCIDENT = ["retard", "colis_perdu", "litige", "autre"] as const;
export const GRAVITES_INCIDENT = ["faible", "normale", "elevee", "critique"] as const;
export const STATUTS_INCIDENT = ["ouvert", "en_cours", "resolu", "clos"] as const;
export const RESOLUTIONS_INCIDENT = ["relivraison", "avoir", "remboursement_manuel", "aucune"] as const;
export type TypeIncident = (typeof TYPES_INCIDENT)[number];
export type GraviteIncident = (typeof GRAVITES_INCIDENT)[number];
export type StatutIncident = (typeof STATUTS_INCIDENT)[number];
export type ResolutionIncident = (typeof RESOLUTIONS_INCIDENT)[number];
export const libellesIncident = { retard: "Retard", colis_perdu: "Colis perdu", litige: "Litige", autre: "Autre", faible: "Faible", normale: "Normale", elevee: "Élevée", critique: "Critique", ouvert: "Ouvert", en_cours: "En cours", resolu: "Résolu", clos: "Clos", relivraison: "Relivraison", avoir: "Avoir", remboursement_manuel: "Remboursement manuel", aucune: "Aucune" } as const;
export function estTypeIncident(v: string): v is TypeIncident { return (TYPES_INCIDENT as readonly string[]).includes(v); }
export function estGraviteIncident(v: string): v is GraviteIncident { return (GRAVITES_INCIDENT as readonly string[]).includes(v); }
export function estStatutIncident(v: string): v is StatutIncident { return (STATUTS_INCIDENT as readonly string[]).includes(v); }
export function estResolutionIncident(v: string): v is ResolutionIncident { return (RESOLUTIONS_INCIDENT as readonly string[]).includes(v); }
export function validerMotifIncident(motif: string): string { const propre = motif.replace(/\s+/g, " ").trim(); if (propre.length < 5) throw new Error("Le motif doit contenir au moins 5 caractères."); if (propre.length > 500) throw new Error("Le motif ne peut pas dépasser 500 caractères."); return propre; }
export function validerResolution(statut: StatutIncident, resolution: ResolutionIncident | null, motif: string | null): void { if ((statut === "resolu" || statut === "clos") && (!resolution || !motif)) throw new Error("Une résolution et son motif sont obligatoires pour clôturer l'incident."); }
