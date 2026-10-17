import { CommandeClient, type CompteCommande } from "./CommandeClient";
import { connexionClientActive } from "@/lib/client/reglage";
import { creerClientServeur } from "@/lib/db/server";
import { lireHierarchieZones } from "@/lib/site/zones";

/**
 * La clé de site Turnstile est publique mais lue à l'exécution côté serveur (variable du
 * Worker `TURNSTILE_SITE_KEY`) puis transmise au composant client : pas de variable à
 * intégrer au build. Absente = vérification anti-robot désactivée.
 *
 * Le compte client est facultatif : s'il est connecté et a mémorisé ses coordonnées, elles préremplissent le formulaire.
 * Ce ne sont que des valeurs de départ, modifiables ; le serveur revalide tout à l'envoi comme pour un invité.
 */
export const dynamic = "force-dynamic";

async function lireCompte(): Promise<CompteCommande> {
  const actif = await connexionClientActive();
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Identification obligatoire pour commander (TDR v0.2 §5.1) : la page ne montre le formulaire qu'à un compte connecté.
  if (!user) {
    return { actif, connecte: false, estClient: false, prefill: null };
  }
  const { data: profil } = await supabase
    .from("client_profils")
    .select("nom_commande, telephone, adresse")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (!profil) {
    return { actif, connecte: true, estClient: false, prefill: null };
  }
  const prefill =
    profil.nom_commande && profil.telephone
      ? { nom: profil.nom_commande, telephone: profil.telephone, adresse: profil.adresse ?? "" }
      : null;
  return { actif, connecte: true, estClient: true, prefill };
}

/** Quartiers proposés pour la livraison : « Quartier, Commune », triés ; l'identifiant sert à retrouver le centre du quartier côté serveur. */
async function lireQuartiersLivraison() {
  try {
    const hierarchie = await lireHierarchieZones();
    return hierarchie
      .flatMap((r) => r.prefectures.flatMap((p) => p.communes))
      .flatMap((c) => c.quartiers.map((q) => ({ valeur: q.id, libelle: `${q.nom}, ${c.nom}` })))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
  } catch {
    return [];
  }
}

export default async function CommandePage() {
  const [compte, quartiersLivraison] = await Promise.all([lireCompte(), lireQuartiersLivraison()]);
  return (
    <CommandeClient
      cleSiteTurnstile={process.env.TURNSTILE_SITE_KEY || undefined}
      compte={compte}
      quartiersLivraison={quartiersLivraison}
    />
  );
}
