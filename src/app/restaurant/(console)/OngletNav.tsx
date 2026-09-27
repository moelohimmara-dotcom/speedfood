"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OngletNav({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const actif = pathname === href;

  return (
    <Link
      href={href}
      style={{
        flex: "1 1 auto",
        textAlign: "center",
        padding: "10px 14px",
        borderRadius: "var(--radius-pill)",
        fontWeight: 700,
        fontSize: "0.9rem",
        color: actif ? "white" : "var(--secondaire)",
        background: actif ? "var(--encre)" : "transparent",
        whiteSpace: "nowrap",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}
