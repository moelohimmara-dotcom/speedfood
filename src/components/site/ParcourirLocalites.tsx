import { lienZone, type ZoneRegion } from "@/lib/site/zones";
import { normaliserNom } from "@/lib/site/zone-position";
import { ParcourirLocalitesListe, type LocaliteRegion } from "./ParcourirLocalitesListe";

/** Les noms d'une zone (nom et noms alternatifs), normalisés et collés : de quoi chercher sans accents ni casse. */
function cle(nom: string, alternatifs: string[]): string {
  return [nom, ...alternatifs].map(normaliserNom).filter((n) => n !== "").join(" | ");
}

/**
 * Toute la Guinée, du plus large au plus précis : régions, préfectures, puis communes (ou sous-préfectures). Chaque ligne ouvre
 * l'accueil sur cette zone. Le serveur prépare des données simples (adresses et clés de recherche) ; l'affichage, la recherche et le
 * filtre vivent dans `ParcourirLocalitesListe`. Les décomptes sont de vrais comptes de restaurants publiés, jamais une estimation.
 */
export function ParcourirLocalites({ hierarchie, attenteActive }: { hierarchie: ZoneRegion[]; attenteActive: boolean }) {
  const regions: LocaliteRegion[] = hierarchie.map((region) => ({
    id: region.id,
    nom: region.nom,
    lien: lienZone({ niveau: "region", slug: region.slug }),
    restaurants: region.restaurants,
    cle: cle(region.nom, []),
    prefecturesTotal: region.prefectures.length,
    prefectures: region.prefectures.map((pref) => ({
      id: pref.id,
      nom: pref.nom,
      lien: lienZone({ niveau: "prefecture", slug: pref.slug }),
      restaurants: pref.restaurants,
      cle: cle(pref.nom, pref.nomsAlternatifs),
      communes: pref.communes.map((c) => ({
        id: c.id,
        nom: c.nom,
        lien: lienZone({ niveau: "commune", slug: c.slug }),
        restaurants: c.restaurants,
        cle: cle(c.nom, c.nomsAlternatifs),
      })),
    })),
  }));

  return <ParcourirLocalitesListe regions={regions} attenteActive={attenteActive} />;
}
