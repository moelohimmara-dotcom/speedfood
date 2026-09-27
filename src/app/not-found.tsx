import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "var(--space-8) var(--space-4)",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.8rem", marginBottom: "var(--space-3)" }}>Page introuvable</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-5)" }}>
        Ce restaurant n&apos;existe pas, ou n&apos;est plus publié.
      </p>
      <Link href="/">
        <Button>Retour au catalogue</Button>
      </Link>
    </main>
  );
}
