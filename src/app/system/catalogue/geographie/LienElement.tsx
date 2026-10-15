"use client";

/**
 * Lien vers une ligne de la page : ouvre les volets repliés qui la contiennent, puis y place le focus. Sans cela, l'ancre d'une ligne
 * située dans un volet fermé ne mènerait nulle part.
 */
export function LienElement({ cibleId, children }: { cibleId: string; children: React.ReactNode }) {
  return (
    <a
      href={`#el-${cibleId}`}
      className="geo-lien-element"
      onClick={(e) => {
        const cible = document.getElementById(`el-${cibleId}`);
        if (!cible) return;
        e.preventDefault();
        let parent: HTMLElement | null = cible;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          if (parent.hidden) parent.hidden = false;
          parent = parent.parentElement;
        }
        cible.scrollIntoView({ block: "center" });
        const champ = cible.querySelector<HTMLElement>("input[name='nom']");
        champ?.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}
