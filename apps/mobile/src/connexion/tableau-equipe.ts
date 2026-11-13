/**
 * Tableau de bord de l'équipe (parité Kotlin, lot 5, ligne E1/E15) : les chiffres à surveiller, un bloc par domaine
 * (`GET /api/v1/equipe/tableau`, route du site). Un bloc n'est renvoyé que si le rôle y a droit : bloc absent = pas le droit,
 * jamais un « 0 » inventé par l'écran. Aucune donnée de client. Lecture stricte : un bloc présent mais illisible refuse toute la lecture.
 */
export interface BlocCommandesEquipe { activesDuJour: number; enAttente: number; propositionsEnAttente: number }
export interface BlocExploitationEquipe { aConfirmer: number; etablissementsSansTelephone: number; coursesSansLivreur: number; livreursEnLigne: number; candidatsLivreurs: number }
export interface BlocCatalogueEquipe { enAttenteValidation: number; publies: number; suspendus: number; aCorriger: number; platsAReconfirmer: number }
export interface TableauEquipe {
  role: string;
  commandes: BlocCommandesEquipe | null;
  exploitation: BlocExploitationEquipe | null;
  catalogue: BlocCatalogueEquipe | null;
}

function invalide(): never { throw Error('TABLEAU_EQUIPE_ILLISIBLE'); }
function objet(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) return invalide(); return v as Record<string, unknown>; }
function texte(v: unknown, max: number): string { if (typeof v !== 'string' || !v.length || v.length > max || /[\x00-\x1f]/.test(v)) return invalide(); return v; }
function nombre(v: unknown): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return invalide(); return v; }
function bloc<T>(v: unknown, cles: readonly string[], fabriquer: (o: Record<string, unknown>) => T): T | null {
  if (v === undefined || v === null) return null;
  const o = objet(v);
  for (const cle of cles) if (!(cle in o)) return invalide();
  return fabriquer(o);
}

export function lireTableauEquipe(v: Record<string, unknown>): TableauEquipe {
  if (v.ok !== true) return invalide();
  return {
    role: texte(v.role, 60),
    commandes: bloc(v.commandes, ['activesDuJour', 'enAttente', 'propositionsEnAttente'], o => ({
      activesDuJour: nombre(o.activesDuJour), enAttente: nombre(o.enAttente), propositionsEnAttente: nombre(o.propositionsEnAttente),
    })),
    exploitation: bloc(v.exploitation, ['aConfirmer', 'etablissementsSansTelephone', 'coursesSansLivreur', 'livreursEnLigne', 'candidatsLivreurs'], o => ({
      aConfirmer: nombre(o.aConfirmer), etablissementsSansTelephone: nombre(o.etablissementsSansTelephone),
      coursesSansLivreur: nombre(o.coursesSansLivreur), livreursEnLigne: nombre(o.livreursEnLigne), candidatsLivreurs: nombre(o.candidatsLivreurs),
    })),
    catalogue: bloc(v.catalogue, ['enAttenteValidation', 'publies', 'suspendus', 'aCorriger', 'platsAReconfirmer'], o => ({
      enAttenteValidation: nombre(o.enAttenteValidation), publies: nombre(o.publies), suspendus: nombre(o.suspendus),
      aCorriger: nombre(o.aCorriger), platsAReconfirmer: nombre(o.platsAReconfirmer),
    })),
  };
}
