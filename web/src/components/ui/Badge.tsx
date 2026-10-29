import type { HTMLAttributes } from "react";

type Ton = "succes" | "danger" | "neutre";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  ton?: Ton;
}

export function Badge({ ton = "neutre", className = "", ...props }: BadgeProps) {
  return <span className={`badge badge-${ton} ${className}`.trim()} {...props} />;
}
