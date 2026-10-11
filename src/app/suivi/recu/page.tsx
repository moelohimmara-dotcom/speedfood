import { lireJetonSessionSuivi } from "@/lib/commande/sessionSuivi";
import { renderRecuPage } from "../[jeton]/recu/page";
import { InitialiserSessionSuivi } from "../InitialiserSessionSuivi";

export const dynamic = "force-dynamic";

export default async function RecuSessionPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const jeton = await lireJetonSessionSuivi();
  if (!jeton) return <InitialiserSessionSuivi />;
  const { doc } = await searchParams;
  return renderRecuPage(jeton, doc);
}
