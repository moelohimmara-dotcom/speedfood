import { LienRetour } from "@/components/LienRetour";
import { creerClientServeur } from "@/lib/db/server";
import { clientLivraison } from "@/lib/livraison/lecture";
import { creerClientPublic } from "@/lib/db/public";
import { lireReglagesAideChoix } from "@/lib/decouverte/aide-choix-service";
import { budgetValide } from "@/lib/decouverte/aide-choix";
import { estUuid } from "@/lib/commande/commun";
import { AideAuChoix, type OptionZone } from "./AideAuChoix";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aide-moi à choisir",
  description: "Donnez votre budget et votre position : Speedfood vous propose des restaurants près de vous, du moins cher au plus huppé.",
};
export const dynamic = "force-dynamic";

/** Page de l'assistant de choix : budget par personne et position, propositions expliquées du moins cher au plus huppé. */
export default async function AideAuChoixPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requete = await searchParams;
  const db = creerClientPublic();
  const [reglages, { data: categories }, { data: lignesQuartiers }, { data: lignesCommunes }] = await Promise.all([
    lireReglagesAideChoix(),
    db.from("menu_categories").select("id, nom").order("ordre"),
    db.from("neighborhoods").select("id, nom, latitude, longitude, communes(nom)").eq("generique", false).order("nom").limit(2000),
    db.from("communes").select("id, nom").order("nom").limit(2000),
  ]);

  // Toutes les zones sont proposées (le visiteur peut être n'importe où), les quartiers regroupés par commune ; un quartier sans restaurant
  // donne simplement une réponse honnête (aucun restaurant). Les coordonnées servent à retrouver le quartier le plus proche de la position GPS.
  const enNombre = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const quartiers: OptionZone[] = ((lignesQuartiers ?? []) as unknown as { id: string; nom: string; latitude: number | string | null; longitude: number | string | null; communes: { nom: string } | { nom: string }[] | null }[])
    .map((q) => {
      const commune = Array.isArray(q.communes) ? q.communes[0] : q.communes;
      return { id: q.id, libelle: q.nom, groupe: commune?.nom ?? "", latitude: enNombre(q.latitude), longitude: enNombre(q.longitude) };
    })
    .sort((a, b) => (a.groupe ?? "").localeCompare(b.groupe ?? "", "fr") || a.libelle.localeCompare(b.libelle, "fr"));
  const communes: OptionZone[] = ((lignesCommunes ?? []) as { id: string; nom: string }[]).map((c) => ({ id: c.id, libelle: c.nom }));
  const quartierExiste = (id: string) => quartiers.some((q) => q.id === id);

  // Recherche partagée par lien (?b=budget&q=quartier|c=commune&k=cuisine) : valeurs vérifiées, jamais de position GPS dans un lien.
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const budgetLien = Number(un(requete.b));
  const quartierLien = un(requete.q);
  const communeLien = un(requete.c);
  const cuisineLien = un(requete.k);
  const initial = {
    budget: budgetValide(budgetLien) ? budgetLien : null,
    quartierId: quartierLien && estUuid(quartierLien) && quartierExiste(quartierLien) ? quartierLien : null,
    communeId: communeLien && estUuid(communeLien) && communes.some((c) => c.id === communeLien) ? communeLien : null,
    cuisineId: cuisineLien && estUuid(cuisineLien) && (categories ?? []).some((c) => c.id === cuisineLien) ? cuisineLien : null,
  };

  // Quartier retenu sur le compte (facultatif, lecture tolérante).
  let connecte = false;
  let quartierRetenu: string | null = null;
  try {
    const {
      data: { user },
    } = await (await creerClientServeur()).auth.getUser();
    if (user) {
      connecte = true;
      const { data } = await clientLivraison().from("client_profils").select("quartier_prefere_id").eq("utilisateur_id", user.id).maybeSingle();
      quartierRetenu = (data as { quartier_prefere_id: string | null } | null)?.quartier_prefere_id ?? null;
    }
  } catch {
    // Pas de préremplissage.
  }

  return (
    <main className="aide-choix-page">
      <LienRetour href="/restaurants">Retour aux restaurants</LienRetour>
      <h1 className="aide-choix-titre">Aide-moi à choisir</h1>
      <p className="aide-choix-intro">
        Dites-nous votre budget par personne et où vous êtes. Nous vous proposons des restaurants ouverts près de vous, du moins cher au plus huppé, avec la raison de chaque proposition.
      </p>
      <AideAuChoix
        quartiers={quartiers}
        communes={communes}
        cuisines={(categories ?? []).map((c) => ({ id: c.id, libelle: c.nom }))}
        connecte={connecte}
        quartierRetenu={quartierRetenu && quartierExiste(quartierRetenu) ? quartierRetenu : null}
        rayonKm={reglages.rayonDefautKm}
        initial={initial}
      />
    </main>
  );
}
