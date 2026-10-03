"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

/**
 * Champ de mot de passe avec bouton « Afficher / Masquer » (cible de 44 px). Utile sur téléphone, où une
 * faute de frappe dans un mot de passe masqué est la première cause d'échec de connexion. Masqué par défaut.
 */
export function ChampMotDePasse({ label, id, className = "", ...props }: Props) {
  const idGenere = useId();
  const idChamp = id ?? idGenere;
  const [visible, setVisible] = useState(false);

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={idChamp}>{label}</label>
      <div className="champ-mdp">
        <input id={idChamp} type={visible ? "text" : "password"} autoCapitalize="none" spellCheck={false} {...props} />
        <button
          type="button"
          className="champ-mdp-bascule"
          aria-pressed={visible}
          aria-controls={idChamp}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Masquer" : "Afficher"}
          <span className="sr-only"> le mot de passe</span>
        </button>
      </div>
    </div>
  );
}
