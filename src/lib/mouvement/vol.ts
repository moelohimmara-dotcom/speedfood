/**
 * « Le plat vole vers le panier » : à l'ajout, une copie ronde de la photo du plat file vers la barre de panier (ou la colonne de panier sur
 * grand écran), puis la cible fait un petit rebond. Pure décoration, navigateur seulement : aucune donnée, aucun effet sur le panier.
 * Rien ne se passe si la personne a demandé de réduire les animations ou si l'API d'animation n'existe pas.
 */
export function volerVersPanier(depuis: HTMLElement | null): void {
  if (!depuis || typeof document === "undefined" || typeof depuis.animate !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const vignette = depuis.closest(".vignette");
  const image = vignette?.querySelector<HTMLImageElement>(".vignette-media img") ?? null;
  const depart = (vignette?.querySelector<HTMLElement>(".vignette-media") ?? depuis).getBoundingClientRect();
  if (depart.width === 0 || depart.height === 0) return;

  // La barre de panier n'existe qu'après le premier ajout : on attend que le panier ait été mis à jour.
  window.setTimeout(() => {
    const cible =
      document.querySelector<HTMLElement>(".barre-panier") ??
      document.querySelector<HTMLElement>(".fiche-panier") ??
      document.querySelector<HTMLElement>(".nav-basse");
    const arrivee = cible?.getBoundingClientRect();
    const x1 = arrivee ? arrivee.left + Math.min(arrivee.width / 2, 60) : window.innerWidth / 2;
    const y1 = arrivee ? arrivee.top + Math.min(arrivee.height / 2, 28) : window.innerHeight - 60;

    const taille = 64;
    const x0 = depart.left + depart.width / 2 - taille / 2;
    const y0 = depart.top + depart.height / 2 - taille / 2;

    const bille = document.createElement("div");
    bille.setAttribute("aria-hidden", "true");
    Object.assign(bille.style, {
      position: "fixed",
      left: `${x0}px`,
      top: `${y0}px`,
      width: `${taille}px`,
      height: `${taille}px`,
      borderRadius: "50%",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "70",
      boxShadow: "0 6px 18px rgba(0,0,0,0.3)",
      border: "3px solid #fff",
      background: "var(--primaire, #b13b00)",
    } as Partial<CSSStyleDeclaration>);
    if (image?.currentSrc) {
      const copie = document.createElement("img");
      copie.src = image.currentSrc;
      copie.alt = "";
      Object.assign(copie.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" } as Partial<CSSStyleDeclaration>);
      bille.appendChild(copie);
    }
    document.body.appendChild(bille);

    const dx = x1 - (x0 + taille / 2);
    const dy = y1 - (y0 + taille / 2);
    const vol = bille.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 40}px) scale(0.75)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.28)`, opacity: 0.35 },
      ],
      { duration: 620, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
    );
    vol.onfinish = () => {
      bille.remove();
      cible?.animate?.([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 280, easing: "ease-out" });
    };
    vol.oncancel = () => bille.remove();
  }, 70);
}
