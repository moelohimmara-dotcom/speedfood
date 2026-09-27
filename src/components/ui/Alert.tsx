import type { HTMLAttributes } from "react";

type Ton = "info" | "succes" | "danger";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  ton?: Ton;
}

export function Alert({ ton = "info", role, className = "", ...props }: AlertProps) {
  return (
    <div
      className={`alerte alerte-${ton} ${className}`.trim()}
      role={role ?? (ton === "danger" ? "alert" : "status")}
      {...props}
    />
  );
}
