import Link from "next/link";

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
      {/* Lien présenté comme un bouton, et non bouton imbriqué dans un lien : un <button> dans
          un <a> est du HTML invalide, et la zone tactile mesurée retombait à 22 px. */}
      <Link href="/restaurants" className="btn btn-primary">
        Retour au catalogue
      </Link>
    </main>
  );
}
