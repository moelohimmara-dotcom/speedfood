import { CommandeClient, type CompteCommande } from "./CommandeClient";
import { connexionClientActive } from "@/lib/client/reglage";
import { creerClientServeur } from "@/lib/db/server";

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
  if (!actif) {
    return { actif: false, estClient: false, prefill: null };
  }
  const supabase = await creerClientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { actif: true, estClient: false, prefill: null };
  }
  const { data: profil } = await supabase
    .from("client_profils")
    .select("nom_commande, telephone, adresse")
    .eq("utilisateur_id", user.id)
    .maybeSingle();
  if (!profil) {
    return { actif: true, estClient: false, prefill: null };
  }
  const prefill =
    profil.nom_commande && profil.telephone
      ? { nom: profil.nom_commande, telephone: profil.telephone, adresse: profil.adresse ?? "" }
      : null;
  return { actif: true, estClient: true, prefill };
}

export default async function CommandePage() {
  return <CommandeClient cleSiteTurnstile={process.env.TURNSTILE_SITE_KEY || undefined} compte={await lireCompte()} />;
}
