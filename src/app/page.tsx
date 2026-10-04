import Link from "next/link";
import type { Metadata } from "next";
import { CadreSite } from "@/components/CadreSite";
import { CartePub } from "@/components/site/CartePub";
import { SelecteurEnvie, type EnvieAffichee } from "@/components/site/SelecteurEnvie";
import { Illustration } from "@/components/illustrations/Illustration";
import { lirePromesse } from "@/lib/parametres/promesse";
import { FAMILLES_ENVIE, lireAccueil, ticketExemple } from "@/lib/site/accueil";
import { TicketVoyage } from "@/components/site/TicketVoyage";
import { PALETTES, type Illustration as ModeleIllustration } from "@/lib/illustrations/modele";

export const metadata: Metadata = {
  title: "Les restaurants de Conakry",
  alternates: { canonical: "/" },
};

const FLECHE = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const ETAPES: { titre: string; texte: string; motif: string }[] = [
  { titre: "Choisir", texte: "Un restaurant de votre quartier, un plat, et l'heure à laquelle le restaurant l'a confirmé.", motif: "couvert" },
  { titre: "Commander", texte: "Vous remplissez le panier et vous envoyez. Nom, téléphone, adresse : c'est tout.", motif: "emporter" },
  { titre: "Suivre", texte: "Un lien de suivi vous dit si la commande est en attente, acceptée, prête ou terminée.", motif: "trait-livraison" },
  { titre: "Recevoir", texte: "Retrait ou livraison selon le restaurant. Vous réglez directement avec lui.", motif: "bol" },
];

function pastille(motif: string): ModeleIllustration {
  return { style: "pastille", motif, ...PALETTES.defaut, fond: "#ffe9c7", texte: "", genere: true };
}

export default async function AccueilPage() {
  const [promesse, donnees] = await Promise.all([lirePromesse(), lireAccueil()]);
  const { ouverts, quartiers, suggestions, restaurants, platsParRestaurant } = donnees;

  const envies: EnvieAffichee[] = suggestions.map((s) => ({
    famille: s.famille,
    libelle: FAMILLES_ENVIE.find((f) => f.cle === s.famille)?.libelle ?? s.famille,
    platNom: s.platNom,
    prix: s.prix,
    restaurantId: s.restaurantId,
    restaurantNom: s.restaurantNom,
    quartier: s.quartier,
    visuel: <Illustration valeur={s.illustration ?? pastille(s.motif)} nom={s.platNom} decoratif />,
  }));

  const ticket = ticketExemple(donnees);
  const mises = (ouverts.length >= 3 ? ouverts : restaurants).slice(0, 3);
  const bandeau = [...quartiers.map((q) => q.nom), ...FAMILLES_ENVIE.map((f) => f.libelle)];

  return (
    <CadreSite>
      <main className="pub-accueil">
        <section className="pub-conteneur pub-accueil-hero" aria-labelledby="accueil-titre">
          <div className="pub-accueil-texte">
            <p className="pub-kicker">{promesse.signature}</p>
            <h1 id="accueil-titre" className="pub-titre pub-accueil-h1">
              Ce plat est-il vraiment disponible ? <span className="pub-surligne">L&apos;heure le dit.</span>
            </h1>
            <p className="pub-accueil-lead">{promesse.sousTitre}</p>
            <div className="pub-accueil-actions">
              <Link href="/restaurants" className="pub-btn">
                Voir les restaurants
                <span className="pub-btn-point" aria-hidden="true">
                  {FLECHE}
                </span>
              </Link>
              <Link href="/comment-ca-marche" className="pub-btn pub-btn-clair">
                Comment ça marche
              </Link>
            </div>
          </div>
          <aside className="pub-accueil-envie" aria-label="Une idée de plat">
            {envies.length > 0 ? (
              <SelecteurEnvie envies={envies} />
            ) : (
              <div className="pub-envie">
                <p className="pub-kicker">En ce moment</p>
                <p className="pub-envie-plat">Aucun restaurant n&apos;est ouvert pour l&apos;instant.</p>
                <p className="pub-envie-resto">Revenez un peu plus tard, ou découvrez les cartes en attendant.</p>
              </div>
            )}
            <span className="pub-autocollant pub-accueil-sticker">Chaque plat porte son heure de confirmation</span>
          </aside>
        </section>

        {bandeau.length > 0 ? (
          <div className="pub-bandeau" aria-hidden="true">
            <div className="pub-bandeau-piste">
              {[...bandeau, ...bandeau].map((mot, i) => (
                <span key={`${mot}-${i}`}>{mot}</span>
              ))}
            </div>
          </div>
        ) : null}

        {mises.length > 0 ? (
          <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-carte">
            <div className="pub-entete-rubrique">
              <p className="pub-kicker">{ouverts.length >= 3 ? "Ouverts en ce moment" : "Au catalogue"}</p>
              <h2 id="accueil-carte" className="pub-titre pub-h2">
                Des tables de quartier, <span className="pub-surligne">pas des enseignes</span>
              </h2>
            </div>
            <div className="pub-grille-cartes">
              {mises.map((r, i) => (
                <CartePub key={r.id} restaurant={r} plats={platsParRestaurant.get(r.id) ?? []} grande={i === 0} />
              ))}
            </div>
            <div>
              <Link href="/restaurants" className="pub-btn pub-btn-clair">
                Tous les restaurants
                <span className="pub-btn-point" aria-hidden="true">
                  {FLECHE}
                </span>
              </Link>
            </div>
          </section>
        ) : null}

        {quartiers.length > 0 ? (
          <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-quartiers">
            <div className="pub-entete-rubrique">
              <p className="pub-kicker">Où nous trouver</p>
              <h2 id="accueil-quartiers" className="pub-titre pub-h2">
                Votre quartier d&apos;abord
              </h2>
            </div>
            <ul className="pub-quartiers">
              {quartiers.map((q, i) => (
                <li key={q.slug} className={`pub-quartier pub-quartier-${i % 3}`}>
                  <Link href={`/quartiers/${q.slug}`}>
                    <span className="pub-quartier-nom">{q.nom}</span>
                    <span className="pub-quartier-compte">
                      {q.restaurants} restaurant{q.restaurants > 1 ? "s" : ""}
                      {q.ouverts > 0 ? `, ${q.ouverts} ouvert${q.ouverts > 1 ? "s" : ""}` : ""}
                    </span>
                    <span className="pub-quartier-fleche" aria-hidden="true">
                      {FLECHE}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-etapes">
          <div className="pub-entete-rubrique">
            <p className="pub-kicker">Quatre étapes</p>
            <h2 id="accueil-etapes" className="pub-titre pub-h2">
              Du choix à <span className="pub-surligne">l&apos;assiette</span>
            </h2>
          </div>
          <ol className="pub-etapes">
            {ETAPES.map((e, i) => (
              <li key={e.titre} className="pub-etape">
                <span className="pub-etape-visuel">
                  <Illustration valeur={pastille(e.motif)} nom={e.titre} decoratif />
                </span>
                <h3 className="pub-titre pub-etape-titre">
                  <span className="pub-etape-num">{i + 1}</span> {e.titre}
                </h3>
                <p>{e.texte}</p>
              </li>
            ))}
          </ol>
          <div>
            <Link href="/comment-ca-marche" className="pub-btn">
              Voir le détail
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
          </div>
        </section>

        {ticket ? (
          <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-ticket">
            <div className="pub-section-ticket">
              <div className="pub-entete-rubrique">
                <p className="pub-kicker">Votre commande, en direct</p>
                <h2 id="accueil-ticket" className="pub-titre pub-h2">
                  Vous savez toujours <span className="pub-surligne">où elle en est</span>
                </h2>
                <p className="pub-accueil-lead">
                  Après l&apos;envoi, un lien de suivi vous dit si la commande est en attente, acceptée, prête ou terminée. Voici un exemple, avec les plats d&apos;un restaurant ouvert.
                </p>
              </div>
              <TicketVoyage restaurant={ticket.restaurant} lignes={ticket.lignes} />
            </div>
          </section>
        ) : null}

        <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-pro">
          <div className="pub-bande-pro">
            <div>
              <p className="pub-kicker pub-kicker-encre">Vous tenez un restaurant ?</p>
              <h2 id="accueil-pro" className="pub-titre pub-h2">
                Votre carte en ligne, <span className="pub-surligne-blanc">sans intermédiaire de paiement</span>
              </h2>
              <p className="pub-accueil-lead pub-lead-encre">Créez votre fiche, nous la contrôlons, vos clients du quartier la trouvent. Vous encaissez directement.</p>
            </div>
            <Link href="/devenir-partenaire" className="pub-btn pub-btn-clair">
              Devenir partenaire
              <span className="pub-btn-point" aria-hidden="true">
                {FLECHE}
              </span>
            </Link>
          </div>
        </section>
      </main>
    </CadreSite>
  );
}
