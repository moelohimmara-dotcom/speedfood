import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  erreur?: string;
}

export function Input({ label, erreur, id, className = "", ...props }: InputProps) {
  const idGenere = useId();
  const idChamp = id ?? idGenere;

  return (
    <div className={`field ${erreur ? "has-error" : ""} ${className}`.trim()}>
      <label htmlFor={idChamp}>{label}</label>
      <input
        id={idChamp}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${idChamp}-erreur` : undefined}
        {...props}
      />
      {erreur ? (
        <span id={`${idChamp}-erreur`} className="field-error">
          {erreur}
        </span>
      ) : null}
    </div>
  );
}
