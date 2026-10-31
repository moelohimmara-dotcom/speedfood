import { SeparateurBloc } from "@/components/site/SeparateurBloc";
import { TicketVoyage } from "@/components/site/TicketVoyage";
import { lireTextes } from "@/lib/cms/textes";
import { lireAccueil, ticketExemple } from "@/lib/site/accueil";

/**
 * Suivi de commande : l'animation d'un ticket d'exemple (un vrai restaurant ouvert et deux de ses plats). Sans ticket possible,
 * la page d'origine montre à la place un simple séparateur : il fait partie de cette section.
 */
export async function AccueilSuivi() {
  const [donnees, t] = await Promise.all([lireAccueil(), lireTextes()]);
  const ticket = ticketExemple(donnees);
  if (!ticket) {
    return (
      <div className="pub-conteneur">
        <SeparateurBloc />
      </div>
    );
  }
  return (
    <div className="pub-bloc">
      <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-ticket">
        <div className="pub-section-ticket">
          <div className="pub-entete-rubrique">
            <p className="pub-kicker">{t["accueil.suivi.kicker"]}</p>
            <h2 id="accueil-ticket" className="pub-titre pub-h2">
              {t["accueil.suivi.titre_debut"]} <span className="pub-surligne">{t["accueil.suivi.titre_surligne"]}</span>
            </h2>
            <p className="pub-accueil-lead">{t["accueil.suivi.texte"]}</p>
          </div>
          <TicketVoyage restaurant={ticket.restaurant} lignes={ticket.lignes} />
        </div>
      </section>
    </div>
  );
}
