import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CadreSite } from "@/components/CadreSite";
import { TexteRiche } from "@/components/site/TexteRiche";
import { RenduPage } from "@/components/studio/RenduPage";
import { lirePagePubliee, slugValide, type PagePubliee } from "@/lib/cms/lecture";
import { lirePageApercu } from "@/lib/cms/apercu";
import { peutVoirApercu } from "@/lib/studio/droit-apercu";
import { SLUG_ACCUEIL, validerPage, type ResultatValidation } from "@/lib/studio/registre";

// Rendue à chaque requête : le contenu publié change sans redéploiement.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
};

/**
 * Page à afficher. Pages de texte : comportement d'avant (publiée, sinon brouillon avec `?apercu=1` pour l'équipe).
 * Pages à blocs (palier 3) : le public voit `blocs_publie` VALIDÉ, sinon 404 (jamais de rendu partiel) ; l'équipe, avec
 * `?apercu=1`, voit le document de travail même si la page est en ligne, ou la liste des erreurs s'il est invalide.
 */
type Resolution =
  | { format: "texte"; page: PagePubliee; brouillon: boolean }
  | { format: "blocs"; titre: string; apercu: false; validation: Extract<ResultatValidation, { ok: true }> }
  | { format: "blocs"; titre: string; apercu: true; enLigne: boolean; validation: ResultatValidation };

async function resoudre(slug: string, apercuDemande: boolean): Promise<Resolution | null> {
  if (!slugValide(slug)) return null;
  // L'accueil n'a qu'une adresse : « / » (voir PageEditorialePublique, redirection permanente).
  if (slug === SLUG_ACCUEIL) return null;
  const publiee = await lirePagePubliee(slug);
  if (apercuDemande && (!publiee || publiee.format === "blocs") && (await peutVoirApercu())) {
    const page = await lirePageApercu(slug);
    if (page?.format === "blocs") {
      return { format: "blocs", titre: page.titre, apercu: true, enLigne: page.statut === "publie", validation: validerPage(page.blocs_brouillon, { slug }) };
    }
    if (page && !publiee) return { format: "texte", page, brouillon: page.statut !== "publie" };
  }
  if (!publiee) return null;
  if (publiee.format === "blocs") {
    const validation = validerPage(publiee.blocs_publie, { slug });
    if (!validation.ok) return null;
    return { format: "blocs", titre: publiee.titre, apercu: false, validation };
  }
  return { format: "texte", page: publiee, brouillon: false };
}

function apercuDemande(valeur: string | string[] | undefined): boolean {
  return valeur === "1";
}

function titreDe(resolu: Resolution): string {
  return resolu.format === "texte" ? resolu.page.titre : resolu.titre;
}

function estApercu(resolu: Resolution): boolean {
  return resolu.format === "texte" ? resolu.brouillon : resolu.apercu;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolu = await resoudre(slug, apercuDemande((await searchParams).apercu));
  if (!resolu) return { title: "Page introuvable", robots: { index: false, follow: false } };
  return {
    title: titreDe(resolu),
    robots: estApercu(resolu) ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function PageEditorialePublique({ params, searchParams }: Props) {
  const { slug } = await params;
  // /p/accueil ne duplique jamais l'accueil : redirection permanente (308) vers « / » ; l'aperçu de l'équipe suit.
  if (slug === SLUG_ACCUEIL) permanentRedirect(apercuDemande((await searchParams).apercu) ? "/?apercu=1" : "/");
  const resolu = await resoudre(slug, apercuDemande((await searchParams).apercu));
  if (!resolu) notFound();

  if (resolu.format === "texte") {
    return (
      <CadreSite>
        <main className="pub-conteneur pub-rubrique">
          <div className="cms-page">
            {resolu.brouillon ? (
              <p className="cms-apercu" role="note">
                Aperçu : cette page n&apos;est pas publiée
              </p>
            ) : null}
            <h1 className="pub-titre pub-h1-page">{resolu.page.titre}</h1>
            <TexteRiche contenu={resolu.page.contenu} />
          </div>
        </main>
      </CadreSite>
    );
  }

  const { validation } = resolu;
  return (
    <CadreSite>
      <main className="pub-conteneur pub-rubrique">
        <div className="cms-page">
          {resolu.apercu ? (
            <p className="cms-apercu" role="note">
              {resolu.enLigne
                ? "Aperçu : brouillon de cette page, la version en ligne peut être différente"
                : "Aperçu : cette page n'est pas publiée"}
            </p>
          ) : null}
          <h1 className="pub-titre pub-h1-page">{resolu.titre}</h1>
          {validation.ok ? (
            <RenduPage page={validation.page} />
          ) : (
            <div className="cms-apercu" role="alert">
              <p>Ce brouillon ne peut être ni affiché ni publié : il ne respecte pas le format des blocs.</p>
              <ul>
                {validation.erreurs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </CadreSite>
  );
}
