import { Tuile } from "@/components/admin/blocs";

/**
 * Compteurs du tableau de bord : le chiffre mène à la section correspondante, déjà filtrée. La définition écrite
 * accompagne toujours le chiffre (règle des indicateurs du TDR §7, reprise de `/system/audit`).
 */
export interface CompteurAffiche {
  cle: string;
  valeur: number;
  libelle: string;
  definition: string;
  href: string;
  /** Accent du chiffre : `danger` quand il reste quelque chose à traiter. */
  ton?: "succes" | "danger" | "neutre";
}

export interface ZoneAffichee {
  titre: string;
  compteurs: CompteurAffiche[];
}

export function ZoneIndicateurs({ zone }: { zone: ZoneAffichee }) {
  return (
    <section className="ad-zone" aria-label={zone.titre}>
      <h2 className="ad-zone-titre">{zone.titre}</h2>
      <div className="ad-tuiles">
        {zone.compteurs.map((compteur) => (
          <Tuile
            key={compteur.cle}
            valeur={compteur.valeur}
            libelle={compteur.libelle}
            definition={compteur.definition}
            href={compteur.href}
            ton={compteur.ton ?? "neutre"}
          />
        ))}
      </div>
    </section>
  );
}
