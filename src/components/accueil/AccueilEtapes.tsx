import Link from "next/link";
import { Illustration } from "@/components/illustrations/Illustration";
import { lireTextes } from "@/lib/cms/textes";
import { FLECHE, MOTIFS_ETAPES, pastille } from "./commun";

/** Étapes « Comment ça marche » : quatre étapes dont les titres et textes sont des emplacements (`accueil.etapes.*`). */
export async function AccueilEtapes() {
  const t = await lireTextes();
  const etapes = [
    { titre: t["accueil.etapes.choisir_titre"], texte: t["accueil.etapes.choisir_texte"], motif: MOTIFS_ETAPES[0] },
    { titre: t["accueil.etapes.commander_titre"], texte: t["accueil.etapes.commander_texte"], motif: MOTIFS_ETAPES[1] },
    { titre: t["accueil.etapes.suivre_titre"], texte: t["accueil.etapes.suivre_texte"], motif: MOTIFS_ETAPES[2] },
    { titre: t["accueil.etapes.recevoir_titre"], texte: t["accueil.etapes.recevoir_texte"], motif: MOTIFS_ETAPES[3] },
  ];
  return (
    <section className="pub-conteneur pub-rubrique" aria-labelledby="accueil-etapes">
      <div className="pub-entete-rubrique">
        <p className="pub-kicker">{t["accueil.etapes.kicker"]}</p>
        <h2 id="accueil-etapes" className="pub-titre pub-h2">
          {t["accueil.etapes.titre_debut"] + " "}
          <span className="pub-surligne">{t["accueil.etapes.titre_surligne"]}</span>
        </h2>
      </div>
      <ol className="pub-etapes">
        {etapes.map((e, i) => (
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
          {t["accueil.etapes.bouton_detail"]}
          <span className="pub-btn-point" aria-hidden="true">
            {FLECHE}
          </span>
        </Link>
      </div>
    </section>
  );
}
