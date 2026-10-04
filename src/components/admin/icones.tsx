/**
 * Icônes de la console d'administration : traits de 1,75 px, 24 px, `currentColor`. Décoratives (`aria-hidden`) : le
 * libellé texte porte toujours le sens.
 */
const CHEMINS: Record<string, React.ReactNode> = {
  tableau: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </>
  ),
  catalogue: (
    <>
      <path d="M4 10l1.5-5h13L20 10" />
      <path d="M4 10a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0" />
      <path d="M5.5 12.5V19h13v-6.5" />
    </>
  ),
  contenu: (
    <>
      <path d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20V3.5z" />
      <path d="M14 3.5V8h4M9 12h6M9 15.5h6" />
    </>
  ),
  commandes: (
    <>
      <path d="M6 3.5h12v17l-2.5-1.7-2 1.7-2-1.7-2 1.7-2-1.7-1.5 1V3.5z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  acces: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.4-3 2.7-5 5.5-5s5.1 2 5.5 5" />
      <path d="M16.5 5.8a3 3 0 010 5.4M18 14.8c1.7.6 2.7 2.2 3 4.7" />
    </>
  ),
  parametres: (
    <>
      <path d="M5 7h9M18 7h1M5 17h1M10 17h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  audit: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  coche: <path d="M5 13l4 4L19 7" />,
  securite: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    </>
  ),
  sortie: (
    <>
      <path d="M10 4H6.5A1.5 1.5 0 005 5.5v13A1.5 1.5 0 006.5 20H10" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  boutique: (
    <>
      <path d="M4 10l1.5-5h13L20 10" />
      <path d="M5.5 12.5V19h13v-6.5" />
    </>
  ),
};

export function IconeAdmin({ nom, taille = 20 }: { nom: keyof typeof CHEMINS | string; taille?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="ad-icone"
    >
      {CHEMINS[nom] ?? CHEMINS.tableau}
    </svg>
  );
}
