import type { Metadata } from "next";
import Link from "next/link";
import { obtenirContexteRestaurant } from "@/lib/auth/contexte";
import { obtenirParametresApplication } from "@/lib/parametres/lire";
import { ancienneteLisible, etatDisponibilite } from "@/lib/disponibilite/etat";
import { formaterPrixGnf } from "@/lib/menu/ouverture";
import { EtatVide, PageHeader } from "@/components/admin/blocs";
import { FormulaireOuverture, type PlatOuverture } from "./FormulaireOuverture";

export const metadata: Metadata = { title: "Ouvrir ma journée" };

/** Rituel du matin : pour chaque plat, « oui » ou « épuisé », puis un seul bouton. Les clients voient l'heure de cette confirmation. */
export default async function OuverturePage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const { supabase, membership } = await obtenirContexteRestaurant("/restaurant/ouverture");

  const [{ data: plats }, { data: sections }, { disponibiliteFraicheurHeures }] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, nom, prix, prix_promo, disponible, disponibilite_confirmee_le, section_id")
      .eq("restaurant_id", membership.restaurant_id)
      .is("archive_le", null)
      .order("nom"),
    supabase.from("menu_sections").select("id, nom, position").eq("restaurant_id", membership.restaurant_id).order("position"),
    obtenirParametresApplication(),
  ]);

  const maintenant = new Date();
  const nomSection = new Map((sections ?? []).map((s) => [s.id, s.nom]));
  const ordreSection = new Map((sections ?? []).map((s, i) => [s.id, i]));

  const liste: PlatOuverture[] = [...(plats ?? [])]
    .sort((a, b) => (ordreSection.get(a.section_id ?? "") ?? 999) - (ordreSection.get(b.section_id ?? "") ?? 999))
    .map((p) => {
      const etat = etatDisponibilite({ disponible: p.disponible, confirmeLe: p.disponibilite_confirmee_le }, disponibiliteFraicheurHeures, maintenant);
      const texte =
        etat.type === "disponible"
          ? `confirmé ${ancienneteLisible(etat.confirmeLe, maintenant)}`
          : etat.type === "epuise"
            ? "épuisé"
            : "à reconfirmer";
      return {
        id: p.id,
        nom: p.nom,
        prixAffiche: formaterPrixGnf(p.prix_promo !== null && p.prix_promo < p.prix ? p.prix_promo : p.prix),
        etat: texte,
        disponible: p.disponible,
        section: p.section_id ? (nomSection.get(p.section_id) ?? null) : null,
      };
    });

  return (
    <div>
      <PageHeader
        titre="Ouvrir ma journée"
        retour={{ href: "/restaurant/menu", libelle: "Mon menu" }}
        description="Dites ce que vous avez ce matin. Vos clients voient l'heure de votre confirmation."
      />
      {liste.length === 0 ? (
        <>
          <EtatVide titre="Aucun plat pour l'instant" texte="Ajoutez d'abord vos plats dans « Mon menu », puis revenez ici chaque matin." />
          <p style={{ textAlign: "center" }}>
            <Link href="/restaurant/menu" className="btn btn-primary">
              Ajouter mes plats
            </Link>
          </p>
        </>
      ) : (
        <FormulaireOuverture plats={liste} erreur={erreur === "1"} />
      )}
    </div>
  );
}
