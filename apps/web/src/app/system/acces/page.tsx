import { redirect } from "next/navigation";

/** La racine du groupe n'a pas de page propre : elle ouvre sa première sous-page (évite une 404 depuis un fil d'Ariane ou une adresse tapée). */
export default function Page() {
  redirect("/system/acces/comptes");
}
