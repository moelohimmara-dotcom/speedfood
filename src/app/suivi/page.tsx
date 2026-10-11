import { lireJetonSessionSuivi } from "@/lib/commande/sessionSuivi";
import { renderSuiviPage } from "./[jeton]/page";
import { InitialiserSessionSuivi } from "./InitialiserSessionSuivi";

export const dynamic = "force-dynamic";

export default async function SuiviPage() {
  const jeton = await lireJetonSessionSuivi();
  if (!jeton) return <InitialiserSessionSuivi />;
  return renderSuiviPage(jeton, true);
}
