import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { listerGeographieSysteme } from "@/lib/system-admin/geographie";
import { diagnostiquerQualite, LIBELLES_PROBLEME, type ElementGeo } from "@/lib/system-admin/geographie-outils";
import { PageHeader, Panneau, Pastille, Volet } from "@/components/admin/blocs";
import { SousNav } from "../../SousNav";
import { FormulaireQuartierSysteme, FormulaireZoneLargeSysteme } from "./Formulaires";
import { LienElement } from "./LienElement";
import { ListeCommunes, ListeQuartiers } from "./ListesGeo";
import { FormulaireFusion, ImportGeographie } from "./OutilsGeo";

export const metadata = { title: "Géographie (administration)" };

function formaterQuand(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Régions, préfectures, communes et quartiers de toute la Guinée, une région à la fois. Une zone désactivée n'est plus proposée aux
 * restaurants ni aux clients ; rien n'est supprimé, les rattachements existants sont conservés.
 */
export default async function GeographieSystemePage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const contexte = await exigerPermissionPage("taxonomie.editer");
  const { region } = await searchParams;
  const { regions, regionChoisie, region: regionLue, prefectures, communes, quartiers, historique } = await listerGeographieSysteme(typeof region === "string" ? region.slice(0, 60) : undefined);

  const elements: ElementGeo[] = [
    ...communes.map((c): ElementGeo => ({ id: c.id, nom: c.nom, niveau: "commune", actif: c.actif, latitude: c.latitude, longitude: c.longitude, nomsAlternatifs: c.nomsAlternatifs })),
    ...quartiers.map((q): ElementGeo => ({ id: q.id, nom: q.nom, niveau: "quartier", actif: q.actif, latitude: q.latitude, longitude: q.longitude, nomsAlternatifs: q.nomsAlternatifs, communeId: q.communeId })),
  ];
  const problemes = diagnostiquerQualite(elements);
  const nomRegion = regionChoisie?.nom ?? "";
  const actives = communes.filter((c) => c.actif).length;

  return (
    <div>
      <PageHeader
        titre="Catalogue"
        description="Régions, préfectures, communes et quartiers proposés aux restaurants et aux clients, avec leur point central, leurs noms alternatifs et leur statut de lancement. Désactiver retire un élément des choix, sans rien supprimer."
      />
      <SousNav entrees={sousSectionsAccessibles("Catalogue", contexte.role)} />

      <nav aria-label="Région à gérer" className="geo-regions">
        <p className="geo-regions-etiquette">Région à gérer</p>
        <ul className="geo-regions-liste">
          {regions.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/system/catalogue/geographie?region=${r.slug}`}
                className={`geo-region-puce${regionChoisie?.slug === r.slug ? " actif" : ""}`}
                aria-current={regionChoisie?.slug === r.slug ? "page" : undefined}
              >
                {r.nom}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Panneau titre="Qualité des données" compteur={problemes.length} id="qualite">
        {problemes.length === 0 ? (
          <p className="geo-ok">Rien à corriger dans la région de {nomRegion} : tous les lieux actifs ont un point central, aucun nom en double.</p>
        ) : (
          <ul className="geo-problemes">
            {problemes.map((p) => (
              <li key={`${p.type}-${p.id}-${p.detail}`}>
                <Pastille ton={p.type === "sans_point" ? "attention" : "danger"}>{LIBELLES_PROBLEME[p.type]}</Pastille>{" "}
                <LienElement cibleId={p.id}>
                  {p.nom} <span className="geo-probleme-niveau">({p.niveau === "commune" ? "commune" : "quartier"})</span>
                </LienElement>
                <span className="geo-probleme-detail"> — {p.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Panneau>

      {regionLue ? (
        <Panneau titre={`Région de ${regionLue.nom}`}>
          <FormulaireZoneLargeSysteme zone={regionLue} type="region" />
        </Panneau>
      ) : null}

      {prefectures.length > 0 ? (
        <Panneau titre="Préfectures" compteur={prefectures.length}>
          {prefectures.map((p) => (
            <FormulaireZoneLargeSysteme key={p.id} zone={p} type="prefecture" contexte={nomRegion} />
          ))}
        </Panneau>
      ) : null}

      <Panneau titre="Ajouter un quartier">
        <FormulaireQuartierSysteme communes={communes} />
      </Panneau>

      <Volet
        titre={`Communes${regionChoisie ? ` de la région de ${regionChoisie.nom}` : ""}`}
        resume={`${actives} active${actives > 1 ? "s" : ""} sur ${communes.length}`}
        ouvert={communes.length <= 15}
      >
        <p className="geo-details-aide">
          Statut de lancement : « Automatique » se déduit des restaurants publiés. « Bientôt » et « Pilote » s&apos;affichent au public (liste des localités) pour annoncer une
          zone avant son premier restaurant ; « Fermée » et « Ouverte » sont des repères internes.
        </p>
        <ListeCommunes communes={communes} contexte={nomRegion} />
      </Volet>

      <Volet
        titre="Quartiers"
        resume={`${quartiers.filter((q) => q.actif).length} actif${quartiers.filter((q) => q.actif).length > 1 ? "s" : ""} sur ${quartiers.length}`}
        ouvert={quartiers.length > 0 && quartiers.length <= 15}
      >
        {quartiers.length === 0 ? (
          <p className="ad-aide-champ">Aucun quartier réel dans cette région : chaque commune se représente par son centre. Ajoutez-en ci-dessus.</p>
        ) : (
          <ListeQuartiers quartiers={quartiers} communes={communes} />
        )}
      </Volet>

      {quartiers.length >= 2 ? (
        <Volet titre="Fusionner deux quartiers en double" resume="Réservé aux quartiers d'une même commune">
          <FormulaireFusion quartiers={quartiers} />
        </Volet>
      ) : null}

      <Volet titre="Exporter et importer" resume="Corriger la région dans un tableur">
        <ImportGeographie lienExport={`/system/catalogue/geographie/export?region=${regionChoisie?.slug ?? "conakry"}`} />
      </Volet>

      {historique.length > 0 ? (
        <Volet titre="Dernières modifications" resume={`${historique.length} récentes`}>
          <ul className="geo-historique">
            {historique.map((h) => (
              <li key={h.id}>
                <span className="geo-historique-quand">{formaterQuand(h.quand)}</span>
                <span>
                  {h.action === "taxonomie.creation" ? "Création" : "Modification"} · {h.cible} {h.detail ? `· ${h.detail}` : ""}
                </span>
                <span className="geo-historique-qui">{h.qui ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Volet>
      ) : null}
    </div>
  );
}
