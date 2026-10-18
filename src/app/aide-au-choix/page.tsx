import { LienRetour } from "@/components/LienRetour";
import { creerClientServeur } from "@/lib/db/server";
import { clientLivraison } from "@/lib/livraison/lecture";
import { creerClientPublic } from "@/lib/db/public";
import { lireCatalogue } from "@/lib/decouverte/recherche";
import { lireReglagesAideChoix } from "@/lib/decouverte/aide-choix-service";
import { AideAuChoix, type OptionZone } from "./AideAuChoix";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aide-moi à choisir",
  description: "Donnez votre budget et votre position : Speedfood vous propose des restaurants près de vous, du moins cher au plus huppé.",
};
export const dynamic = "force-dynamic";

/** Page de l'assistant de choix : budget par personne et position, propositions expliquées du moins cher au plus huppé. */
export default async function AideAuChoixPage() {
  const [catalogue, reglages, { data: categories }] = await Promise.all([
    lireCatalogue(),
    lireReglagesAideChoix(),
    creerClientPublic().from("menu_categories").select("id, nom").order("ordre"),
  ]);

  // Zones proposées : seulement celles où il y a au moins un restaurant publié (une liste de toute la Guinée serait inutilisable).
  const quartiers = new Map<string, OptionZone>();
  const communes = new Map<string, OptionZone>();
  for (const r of catalogue.restaurants) {
    if (r.quartierId && r.quartier && !r.quartierGenerique) quartiers.set(r.quartierId, { id: r.quartierId, libelle: `${r.quartier}, ${r.communeNom}` });
    if (r.communeId && r.communeNom) communes.set(r.communeId, { id: r.communeId, libelle: r.communeNom });
  }
  const trier = (m: Map<string, OptionZone>) => [...m.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));

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
        quartiers={trier(quartiers)}
        communes={trier(communes)}
        cuisines={(categories ?? []).map((c) => ({ id: c.id, libelle: c.nom }))}
        connecte={connecte}
        quartierRetenu={quartierRetenu && quartiers.has(quartierRetenu) ? quartierRetenu : null}
        rayonKm={reglages.rayonDefautKm}
      />
    </main>
  );
}
