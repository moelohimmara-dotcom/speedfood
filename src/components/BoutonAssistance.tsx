import { lienWhatsAppAssistance } from "@/lib/parametres/assistance-format";

/** Bouton « Écrire sur WhatsApp » vers l'assistance. N'affiche rien tant que l'administrateur n'a pas renseigné de numéro. */
export function BoutonAssistance({ numero, className = "btn btn-secondary" }: { numero: string | null; className?: string }) {
  if (!numero) {
    return null;
  }
  return (
    <a href={lienWhatsAppAssistance(numero)} className={className} target="_blank" rel="noopener noreferrer">
      Écrire sur WhatsApp
      <span className="sr-only"> (ouvre WhatsApp dans un nouvel onglet)</span>
    </a>
  );
}
