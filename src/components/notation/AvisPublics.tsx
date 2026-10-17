import { lireAvisPublics, libelleEtiquette } from "@/lib/notation/lecture-publique";
import { SEUIL_AFFICHAGE } from "@/lib/notation/regles";
import { NoteResume } from "./NoteResume";

function Etoiles({ note }: { note: number }) {
  return (
    <span className="notation-avis-etoiles" role="img" aria-label={`${note} sur 5`}>
      {"★".repeat(note)}
      <span className="notation-avis-etoiles-vides">{"★".repeat(5 - note)}</span>
    </span>
  );
}

/** Avis publics d'un restaurant sur sa fiche : moyenne (dès 5 avis), derniers avis, réponse du restaurant. N'affiche rien sans avis. */
export async function AvisPublics({ restaurantId }: { restaurantId: string }) {
  const { moyenne, total, avis } = await lireAvisPublics(restaurantId);
  if (total === 0 && avis.length === 0) return null;
  return (
    <section className="notation-avis" aria-labelledby="notation-avis-titre">
      <h2 id="notation-avis-titre" className="notation-avis-titre">
        Avis des clients
      </h2>
      <NoteResume moyenne={moyenne} total={total} />
      {moyenne === null ? <p className="notation-aide">La note moyenne s&apos;affiche à partir de {SEUIL_AFFICHAGE} avis.</p> : null}
      <ul className="notation-avis-liste">
        {avis.map((a, i) => (
          <li key={i} className="notation-avis-item">
            <p className="notation-avis-entete">
              <Etoiles note={a.note} /> <strong>{a.prenom}</strong>
              <span className="notation-aide"> · {new Date(a.date).toLocaleDateString("fr-FR", { dateStyle: "medium" })}</span>
            </p>
            {a.etiquettes.length > 0 ? (
              <p className="notation-avis-etiquettes">
                {a.etiquettes.map((e) => (
                  <span key={e} className="notation-pastille">
                    {libelleEtiquette(e)}
                  </span>
                ))}
              </p>
            ) : null}
            {a.commentaire ? <p className="notation-avis-texte">{a.commentaire}</p> : null}
            {a.reponse ? (
              <p className="notation-avis-reponse">
                <strong>Réponse du restaurant :</strong> {a.reponse}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
