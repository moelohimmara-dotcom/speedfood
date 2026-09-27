import type { ButtonHTMLAttributes } from "react";

type Variante = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  pleineLargeur?: boolean;
}

export function Button({
  variante = "primary",
  pleineLargeur = false,
  className = "",
  ...props
}: ButtonProps) {
  const classes = ["btn", `btn-${variante}`, pleineLargeur ? "btn-block" : "", className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
