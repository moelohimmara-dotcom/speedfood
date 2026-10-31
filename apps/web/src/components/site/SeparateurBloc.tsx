/**
 * Séparateur entre deux blocs du site public : un trait d'encre de chaque côté d'un petit motif de trois losanges (rouge,
 * mangue, encre), de la même famille que les motifs du pied de page et du bandeau. Purement décoratif : masqué aux
 * lecteurs d'écran, il ne remplace pas les titres de section.
 */
export function SeparateurBloc() {
  return (
    <div className="pub-sep" role="presentation" aria-hidden="true">
      <span className="pub-sep-motif" />
    </div>
  );
}
