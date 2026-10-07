import { FAMILLES_ENVIE, lireAccueil } from "@/lib/site/accueil";

/** Bandeau défilant : les quartiers puis les familles de plats (décor, masqué aux lecteurs d'écran). Rien s'il n'y a rien à montrer. */
export async function AccueilBandeau() {
  const { quartiers } = await lireAccueil();
  const bandeau = [...quartiers.map((q) => q.nom), ...FAMILLES_ENVIE.map((f) => f.libelle)];
  if (bandeau.length === 0) return null;
  return (
    <div className="pub-bandeau" aria-hidden="true">
      <div className="pub-bandeau-piste">
        {[...bandeau, ...bandeau].map((mot, i) => (
          <span key={`${mot}-${i}`}>{mot}</span>
        ))}
      </div>
    </div>
  );
}
