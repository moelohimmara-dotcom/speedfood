import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CadreSite } from "@/components/CadreSite";
import { TexteRiche } from "@/components/site/TexteRiche";
import { lirePagePubliee, slugValide, type PagePubliee } from "@/lib/cms/lecture";
import { lirePageApercu } from "@/lib/cms/apercu";
import { chargerContexteSysteme } from "@/lib/system-admin/contexte";
import { roleAPermission } from "@/lib/system-admin/permissions";

// Rendue à chaque requête : le contenu publié change sans redéploiement.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
};

/**
 * L'utilisateur connecté a-t-il une session système avec `contenu.editer` ? Passe par `chargerContexteSysteme` (même contrôle que la
 * console : session, double authentification, rôle lu par la RLS), SANS 404 : une page publique retombe sur le comportement public.
 */
async function peutVoirApercu(): Promise<boolean> {
  try {
    const contexte = await chargerContexteSysteme();
    return !!contexte && roleAPermission(contexte.role, "contenu.editer");
  } catch {
    return false;
  }
}

/** Page à afficher et indicateur d'aperçu. Le brouillon n'est lu qu'avec `?apercu=1` ET la permission vérifiée côté serveur. */
async function resoudre(
  slug: string,
  apercuDemande: boolean
): Promise<{ page: PagePubliee; brouillon: boolean } | null> {
  if (!slugValide(slug)) return null;
  const publiee = await lirePagePubliee(slug);
  if (publiee) return { page: publiee, brouillon: false };
  if (!apercuDemande || !(await peutVoirApercu())) return null;
  const page = await lirePageApercu(slug);
  if (!page) return null;
  return { page, brouillon: page.statut !== "publie" };
}

function apercuDemande(valeur: string | string[] | undefined): boolean {
  return valeur === "1";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolu = await resoudre(slug, apercuDemande((await searchParams).apercu));
  if (!resolu) return { title: "Page introuvable", robots: { index: false, follow: false } };
  return {
    title: resolu.page.titre,
    robots: resolu.brouillon ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function PageEditorialePublique({ params, searchParams }: Props) {
  const { slug } = await params;
  const resolu = await resoudre(slug, apercuDemande((await searchParams).apercu));
  if (!resolu) notFound();

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
