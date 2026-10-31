export type StatutFilSupport = "ouvert" | "resolu";

export type ModeleReponse = {
  id: string;
  titre: string;
  contenu: string;
};

export const MODELES_REPONSE: readonly ModeleReponse[] = [
  { id: "prise-en-charge", titre: "Prise en charge", contenu: "Bonjour, nous avons bien reçu votre demande et nous la traitons." },
  { id: "suivi-commande", titre: "Suivi de commande", contenu: "Bonjour, nous vérifions l'état de votre commande et revenons vers vous rapidement." },
  { id: "excuses-retard", titre: "Retard", contenu: "Nous sommes désolés pour ce retard. Notre équipe vérifie la situation avec l'établissement." },
];

export function statutFilValide(valeur: unknown): valeur is StatutFilSupport {
  return valeur === "ouvert" || valeur === "resolu";
}

export function messageSupportValide(valeur: unknown): { ok: true; valeur: string } | { ok: false; message: string } {
  if (typeof valeur !== "string" || valeur.trim() === "") return { ok: false, message: "Écrivez un message avant de l'envoyer." };
  const valeurPropre = valeur.trim();
  if (valeurPropre.length > 1_000) return { ok: false, message: "Le message ne peut pas dépasser 1 000 caractères." };
  return { ok: true, valeur: valeurPropre };
}

export function construireLienWhatsApp(telephoneMasque: string, message: string): string {
  // Donnée fictive uniquement : aucun numéro réel n'est exposé ni envoyé automatiquement.
  return `https://wa.me/?text=${encodeURIComponent(message)}%20(${telephoneMasque})`;
}
