"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Protection de navigation de l'éditeur (palier 3, tâche 7, revue I2) : tant que `actif` (modifications non enregistrées),
 * quitter la page demande confirmation.
 *  - `beforeunload` : fermeture de l'onglet, rechargement, adresse tapée (message du navigateur, non personnalisable).
 *  - clic sur un lien interne (barre latérale, fil d'Ariane, « Retour à la liste »…) : intercepté en phase de capture,
 *    avant le routeur de Next, puis boîte « Quitter sans enregistrer ? » (Rester / Quitter sans enregistrer).
 *  - bouton « Précédent » : Next 16 n'offre aucun mécanisme officiel de blocage de navigation (aucun événement de
 *    routeur dans `node_modules/next/dist/docs/`). Technique classique et assumée : à la première modification, une entrée
 *    d'historique identique est ajoutée ; « Précédent » la consomme (même adresse, rien ne change à l'écran), `popstate`
 *    ouvre alors la boîte ; « Rester » remet une entrée, « Quitter » recule d'un cran de plus.
 *    Limite : après un enregistrement, l'entrée ajoutée reste dans l'historique : un « Précédent » ultérieur demandera
 *    deux pressions pour quitter la page (sans perte de données).
 * Aucune alerte sans modification, ni après une sortie confirmée.
 */
export function GardeNavigation({ actif }: { actif: boolean }) {
  const router = useRouter();
  const dialogue = useRef<HTMLDialogElement>(null);
  const suite = useRef<null | (() => void)>(null);
  const actifRef = useRef(actif);
  const sortieConfirmee = useRef(false);
  const sentinelle = useRef(false);

  useEffect(() => {
    actifRef.current = actif;
    // Entrée d'historique ajoutée une seule fois, à la première modification.
    if (actif && !sentinelle.current) {
      sentinelle.current = true;
      window.history.pushState(window.history.state, "", window.location.href);
    }
  }, [actif]);

  useEffect(() => {
    const demander = (poursuivre: () => void) => {
      suite.current = poursuivre;
      if (!dialogue.current?.open) dialogue.current?.showModal();
    };

    const surClic = (e: MouseEvent) => {
      if (!actifRef.current || sortieConfirmee.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const lien = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!lien || (lien.target && lien.target !== "_self") || lien.hasAttribute("download")) return;
      const url = new URL(lien.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      demander(() => router.push(url.pathname + url.search + url.hash));
    };

    const surPrecedent = () => {
      if (!actifRef.current) sentinelle.current = false; // entrée consommée : la prochaine modification en ajoutera une
      if (!actifRef.current || sortieConfirmee.current) return;
      // On est revenu sur l'entrée d'origine (même adresse) : on la masque derrière une nouvelle entrée et on demande.
      window.history.pushState(window.history.state, "", window.location.href);
      demander(() => window.history.go(-2));
    };

    const avantDepart = (e: BeforeUnloadEvent) => {
      if (!actifRef.current || sortieConfirmee.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("click", surClic, true);
    window.addEventListener("popstate", surPrecedent);
    window.addEventListener("beforeunload", avantDepart);
    return () => {
      document.removeEventListener("click", surClic, true);
      window.removeEventListener("popstate", surPrecedent);
      window.removeEventListener("beforeunload", avantDepart);
    };
  }, [router]);

  return (
    <dialog ref={dialogue} className="ad-dialogue se-dialogue" aria-labelledby="se-quitter-titre" onClose={() => (suite.current = null)}>
      <div className="ad-dialogue-corps">
        <h2 id="se-quitter-titre">Quitter sans enregistrer ?</h2>
        <p>Des modifications de cette page ne sont pas enregistrées : si vous quittez maintenant, elles seront perdues.</p>
        <div className="ad-dialogue-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={() => dialogue.current?.close()}>
            Rester
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const poursuivre = suite.current;
              sortieConfirmee.current = true;
              dialogue.current?.close();
              poursuivre?.();
            }}
          >
            Quitter sans enregistrer
          </button>
        </div>
      </div>
    </dialog>
  );
}
