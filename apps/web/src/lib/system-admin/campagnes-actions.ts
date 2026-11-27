"use server";
import { revalidatePath } from "next/cache";
import { journaliserActionSysteme } from "./audit";
import { verifierPermission } from "./contexte";
import { apercuCampagne, changerEtatCampagne, creerCampagne } from "./campagnes-service";
import { validerCode, validerPeriode, validerRegle } from "./campagnes-regles";
export type EtatCampagnes = { succes?: string; erreur?: string; apercu?: unknown };
const chemin = "/system/campagnes";
function lire(form: FormData) { return { nom: String(form.get("nom") ?? "").trim(), code: String(form.get("code") ?? ""), regle: { type: String(form.get("type_remise")) as "pourcentage" | "montant", valeur: Number(form.get("valeur")), minimumAchatGnf: Number(form.get("minimum_achat")) }, plafondMontantGnf: Number(form.get("plafond_montant")), plafondUtilisations: Number(form.get("plafond_utilisations")), debut: String(form.get("debut")), fin: String(form.get("fin")), ciblage: String(form.get("ciblage") ?? "Tous les clients").trim() }; }
export async function apercuCampagneAction(_etat: EtatCampagnes, form: FormData): Promise<EtatCampagnes> {
  await verifierPermission("parametres.editer"); const e = lire(form); const c = validerCode(e.code); if (!c.ok) return { erreur: `${c.erreur} ${c.action}` }; const r = validerRegle(e.regle); if (!r.ok) return { erreur: `${r.erreur} ${r.action}` }; const p = validerPeriode(e.debut, e.fin); if (!p.ok) return { erreur: `${p.erreur} ${p.action}` }; if (!e.nom) return { erreur: "Nom manquant : donnez un nom à la campagne. Renseignez ce champ." }; if (![e.plafondMontantGnf, e.plafondUtilisations].every((x) => Number.isInteger(x) && x > 0)) return { erreur: "Plafonds invalides : utilisez des entiers positifs. Corrigez les plafonds." }; const a = await apercuCampagne({ ...e, code: c.code, regle: r.regle }); return a.ok ? { succes: `Aperçu prêt pour ${a.campagne.code}.`, apercu: a } : { erreur: `${a.erreur} ${a.action}` };
}
/** Active ou suspend une campagne existante. Journalisé ; aucun changement si la campagne est introuvable. */
export async function changerEtatCampagneAction(formData: FormData): Promise<void> {
  const contexte = await verifierPermission("parametres.editer");
  const id = String(formData.get("campagne_id") ?? "");
  const etat = formData.get("etat") === "active" ? "active" : formData.get("etat") === "suspendue" ? "suspendue" : null;
  if (!etat || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return;
  const fait = await changerEtatCampagne(id, etat);
  if (!fait) return;
  // Mutation déjà faite : un échec du journal ne doit pas la faire passer pour un échec (sinon l'équipe réessaie et re-déclenche).
  try {
    await journaliserActionSysteme(contexte, { action: etat === "active" ? "campagnes.activee" : "campagnes.suspendue", cibleType: "campagne", cibleId: id, motif: etat === "active" ? "Campagne activée par l'équipe." : "Campagne suspendue par l'équipe." });
  } catch { console.error("campagne_audit_echec", { campagne: id, etat }); }
  revalidatePath(chemin);
}

export async function creerCampagneAction(_etat: EtatCampagnes, form: FormData): Promise<EtatCampagnes> {
  const contexte = await verifierPermission("parametres.editer"); if (form.get("confirmation") !== "oui") return { erreur: "Confirmation explicite requise avant création." }; const a = await apercuCampagneAction({}, form); if (!a.apercu || typeof a.apercu !== "object" || !("campagne" in a.apercu)) return { erreur: a.erreur ?? "Aperçu manquant : relancez l'aperçu." }; const empreinte = String(form.get("empreinte") ?? ""); const motif = String(form.get("motif") ?? "").trim(); if (motif.length < 5) return { erreur: "Motif requis (5 caractères minimum) : expliquez la création." }; const r = await creerCampagne((a.apercu as { campagne: Parameters<typeof creerCampagne>[0] }).campagne, empreinte); if (!r.ok) return { erreur: r.message }; let noteAudit = ""; try { await journaliserActionSysteme(contexte, { action: "campagnes.code_cree", cibleType: "campagne", cibleId: r.campagne.id, motif }); } catch { noteAudit = " Attention : la trace d'audit n'a pas pu être écrite, signalez-le à l'équipe technique."; } revalidatePath(chemin); return { succes: `Campagne ${r.campagne.code} créée en brouillon. Activez-la pour que les clients puissent l'utiliser.${noteAudit}` };
}
