import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerSurcharges } from "@/lib/system-admin/emplacements";
import { exigerPalier } from "@/lib/system-admin/paliers-serveur";
import { MINIMUMS_STUDIO, explicationPalier } from "@/lib/system-admin/paliers";
import { EMPLACEMENTS, longueurMax } from "@/lib/cms/emplacements";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { GroupeTextes, type ChampTexte } from "./GroupeTextes";

export const metadata = { title: "Textes du site (administration)" };

/**
 * Textes du site public (Studio, palier 1) : chaque texte de la page d'accueil est un emplacement avec une valeur par défaut
 * dans le code ; l'éditeur peut la remplacer, voir l'écart avec le défaut et la rétablir. Texte brut seulement.
 */
export default async function TextesSystemePage() {
  const contexte = await exigerPermissionPage("contenu.editer");
  // Un texte enregistré est en ligne aussitôt : modifier ou rétablir demande le palier de publication. Interface seulement,
  // les actions revérifient le palier côté serveur.
  const { palier } = await exigerPalier("contenu:textes", MINIMUMS_STUDIO.lire, { contexte });
  const limite = palier >= MINIMUMS_STUDIO.publier ? undefined : explicationPalier(palier, MINIMUMS_STUDIO.publier);
  const surcharges = await listerSurcharges();

  const groupes: { nom: string; champs: ChampTexte[] }[] = [];
  for (const e of EMPLACEMENTS) {
    let groupe = groupes.find((g) => g.nom === e.groupe);
    if (!groupe) {
      groupe = { nom: e.groupe, champs: [] };
      groupes.push(groupe);
    }
    groupe.champs.push({
      cle: e.cle,
      libelle: e.libelle,
      defaut: e.defaut,
      max: longueurMax(e),
      multiligne: "multiligne" in e && e.multiligne === true,
      valeur: surcharges[e.cle]?.valeur ?? null,
    });
  }

  return (
    <div>
      <PageHeader
        titre="Contenu"
        description="Les textes de la page d'accueil. Laissez un champ vide, ou rétablissez le défaut, pour revenir au texte d'origine."
        actions={
          <a className="btn btn-secondary" href="/" target="_blank" rel="noopener noreferrer">
            Voir l&apos;accueil
          </a>
        }
      />
      <SousNav entrees={sousSectionsAccessibles("Contenu", contexte.role)} />

      {limite ? (
        <p className="ad-palier-note">
          Lecture seule : un texte enregistré apparaît aussitôt sur le site. {limite}
        </p>
      ) : null}
      <div className="ad-textes">
        {groupes.map((g, i) => (
          <Panneau key={g.nom} titre={g.nom} id={`textes-${i}`}>
            <GroupeTextes groupe={g.nom} champs={g.champs} lectureSeule={Boolean(limite)} />
          </Panneau>
        ))}
      </div>
    </div>
  );
}
