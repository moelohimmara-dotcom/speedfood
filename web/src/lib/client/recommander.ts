// Pur, sans dépendance serveur : testable seul (npm run test:unit). « Commander à nouveau » : refaire un panier d'après une commande passée.
import { QUANTITE_MAX_LIGNE, cleLigne, type LignePanier } from "../panier/gestion";

/** Ligne d'une commande passée, telle que la base l'a gardée. */
export interface LigneCommandePassee {
  /** Peut avoir disparu (plat supprimé) : `null`. */
  menuItemId: string | null;
  nom: string;
  quantite: number;
  /** Suppléments choisis à l'époque (identifiants des options du plat). */
  optionIds: string[];
}

/** Un plat tel que le menu le propose AUJOURD'HUI. */
export interface PlatDuMenu {
  id: string;
  nom: string;
  prix: number;
  prixPromo: number | null;
  disponible: boolean;
  /** Plat retiré de la carte. */
  archive: boolean;
  photoUrl?: string | null;
  options: { id: string; nom: string; prix: number; disponible: boolean }[];
}

export interface ResultatRecommande {
  lignes: LignePanier[];
  /** Noms des plats qui ne sont plus proposés (supprimés, archivés ou indisponibles). */
  indisponibles: string[];
  /** Nombre de suppléments qui n'existent plus ou ne sont plus disponibles (le plat est repris sans eux). */
  supplementsRetires: number;
}

/**
 * Reconstruit un panier à partir d'une commande passée et du menu actuel. Les PRIX sont ceux d'aujourd'hui (jamais ceux de l'ancienne commande) ;
 * un plat qui n'est plus proposé est signalé et laissé de côté ; un supplément disparu est retiré. Deux lignes qui aboutissent au même plat avec les
 * mêmes suppléments sont fusionnées (quantité plafonnée). Le serveur recalcule tout à la création de la commande de toute façon.
 */
export function reconstruireCommande(passees: readonly LigneCommandePassee[], menu: readonly PlatDuMenu[]): ResultatRecommande {
  const parId = new Map(menu.map((p) => [p.id, p]));
  const lignes = new Map<string, LignePanier>();
  const indisponibles: string[] = [];
  let supplementsRetires = 0;

  for (const l of passees) {
    const plat = l.menuItemId ? parId.get(l.menuItemId) : undefined;
    if (!plat || plat.archive || !plat.disponible) {
      if (!indisponibles.includes(l.nom)) indisponibles.push(l.nom);
      continue;
    }
    const options = [];
    for (const id of l.optionIds) {
      const o = plat.options.find((x) => x.id === id);
      if (o && o.disponible) options.push({ id: o.id, nom: o.nom, prix: o.prix });
      else supplementsRetires += 1;
    }
    const cle = cleLigne(plat.id, options.map((o) => o.id));
    const quantite = Math.max(1, Math.min(QUANTITE_MAX_LIGNE, Math.floor(l.quantite) || 1));
    const existante = lignes.get(cle);
    if (existante) {
      lignes.set(cle, { ...existante, quantite: Math.min(QUANTITE_MAX_LIGNE, existante.quantite + quantite) });
    } else {
      lignes.set(cle, { cle, menuItemId: plat.id, nom: plat.nom, prix: plat.prixPromo ?? plat.prix, quantite, options, photoUrl: plat.photoUrl ?? null });
    }
  }
  return { lignes: [...lignes.values()], indisponibles, supplementsRetires };
}

/** Phrase à montrer au client après la préparation du panier ; `null` quand tout est repris à l'identique. */
export function messageRecommande(r: ResultatRecommande): string | null {
  const morceaux: string[] = [];
  if (r.indisponibles.length === 1) morceaux.push(`« ${r.indisponibles[0]} » n'est plus proposé`);
  else if (r.indisponibles.length > 1) morceaux.push(`${r.indisponibles.length} plats ne sont plus proposés (${r.indisponibles.slice(0, 3).join(", ")}${r.indisponibles.length > 3 ? "…" : ""})`);
  if (r.supplementsRetires > 0) morceaux.push(`${r.supplementsRetires} supplément${r.supplementsRetires > 1 ? "s" : ""} n'${r.supplementsRetires > 1 ? "existent" : "existe"} plus`);
  return morceaux.length === 0 ? null : `${morceaux.join(" ; ")}. Vérifiez votre panier : les prix sont ceux d'aujourd'hui.`;
}
