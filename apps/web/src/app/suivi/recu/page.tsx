import { lireJetonSessionSuivi } from "@/lib/commande/sessionSuivi";
import { renderRecuPage } from "../[jeton]/recu/page";
import { InitialiserSessionSuivi } from "../InitialiserSessionSuivi";

export const dynamic = "force-dynamic";

export default async function RecuSessionPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const jeton = await lireJetonSessionSuivi();
  if (!jeton) return <InitialiserSessionSuivi />;
  const { doc } = await searchParams;
  // Le lien de suivi reste dans le cookie : la page n'écrit aucune adresse contenant le jeton.
  return renderRecuPage(jeton, doc, { racine: "/suivi/recu", retour: "/suivi" });
}
