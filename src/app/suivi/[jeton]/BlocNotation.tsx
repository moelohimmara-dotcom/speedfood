"use client";

import { useState, useTransition } from "react";
import { Alert, Card } from "@/components/ui";
import { noterCommandeAction } from "@/lib/notation/actions";
import { COMMENTAIRE_MAX, ETIQUETTES } from "@/lib/notation/regles";
import type { AvisExistant } from "@/lib/notation/service";

interface Props {
  /** Absent sur la page `/suivi` : le lien reste dans le cookie, jamais dans la page. */
  jeton?: string;
  restaurantNom: string;
  restaurant: AvisExistant | null;
  livreur: { nom: string; avis: AvisExistant | null } | null;
}

function Etoiles({ nom, valeur, onChange, desactive }: { nom: string; valeur: number; onChange: (n: number) => void; desactive: boolean }) {
  return (
    <div className="notation-etoiles" role="radiogroup" aria-label={nom}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valeur === n}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
          disabled={desactive}
          className={`notation-bouton-etoile ${n <= valeur ? "notation-bouton-etoile-pleine" : ""}`}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Etiquettes({ cible, choisies, onToggle, desactive }: { cible: "restaurant" | "livreur"; choisies: string[]; onToggle: (cle: string) => void; desactive: boolean }) {
  return (
    <div className="notation-etiquettes">
      {ETIQUETTES[cible].map((e) => (
        <button
          key={e.cle}
          type="button"
          aria-pressed={choisies.includes(e.cle)}
          disabled={desactive}
          className={`chip ${choisies.includes(e.cle) ? "actif" : ""}`}
          onClick={() => onToggle(e.cle)}
        >
          {e.libelle}
        </button>
      ))}
    </div>
  );
}

function basculer(liste: string[], cle: string): string[] {
  return liste.includes(cle) ? liste.filter((x) => x !== cle) : liste.length >= 5 ? liste : [...liste, cle];
}

/** Formulaire de notation après une commande terminée : le restaurant, puis le livreur s'il y en a eu un. */
export function BlocNotation({ jeton, restaurantNom, restaurant, livreur }: Props) {
  const verrouille = restaurant !== null && !restaurant.modifiable;
  const [noteResto, setNoteResto] = useState(restaurant?.note ?? 0);
  const [etiqResto, setEtiqResto] = useState<string[]>(restaurant?.etiquettes ?? []);
  const [commentaire, setCommentaire] = useState(restaurant?.commentaire ?? "");
  const [noteLivreur, setNoteLivreur] = useState(livreur?.avis?.note ?? 0);
  const [etiqLivreur, setEtiqLivreur] = useState<string[]>(livreur?.avis?.etiquettes ?? []);
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer() {
    if (noteResto === 0) {
      setMessage({ ton: "danger", texte: "Choisissez une note de 1 à 5 étoiles pour le restaurant." });
      return;
    }
    demarrer(async () => {
      const r = await noterCommandeAction(jeton, {
        restaurant: { note: noteResto, etiquettes: etiqResto, commentaire },
        livreur: livreur && noteLivreur > 0 ? { note: noteLivreur, etiquettes: etiqLivreur } : null,
      });
      setMessage(r.ok ? { ton: "succes", texte: "Merci, votre avis est enregistré." } : { ton: "danger", texte: r.erreur });
    });
  }

  return (
    <Card className="u-mt-s4">
      <h2 className="notation-titre">{restaurant ? "Votre avis" : "Donnez votre avis"}</h2>
      {verrouille ? <p className="notation-aide">Votre avis est enregistré. Il n&apos;est plus modifiable.</p> : null}

      <fieldset className="notation-groupe" disabled={verrouille}>
        <legend>{restaurantNom}</legend>
        <Etoiles nom={`Note pour ${restaurantNom}`} valeur={noteResto} onChange={setNoteResto} desactive={verrouille} />
        <Etiquettes cible="restaurant" choisies={etiqResto} onToggle={(c) => setEtiqResto((l) => basculer(l, c))} desactive={verrouille} />
        <label className="notation-aide" htmlFor="notation-commentaire">
          Commentaire public (facultatif). L&apos;équipe peut le masquer s&apos;il est signalé.
        </label>
        <textarea
          id="notation-commentaire"
          className="notation-commentaire"
          rows={3}
          maxLength={COMMENTAIRE_MAX}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          disabled={verrouille}
        />
      </fieldset>

      {livreur ? (
        <fieldset className="notation-groupe" disabled={verrouille}>
          <legend>Votre livreur : {livreur.nom}</legend>
          <Etoiles nom={`Note pour le livreur ${livreur.nom}`} valeur={noteLivreur} onChange={setNoteLivreur} desactive={verrouille} />
          <Etiquettes cible="livreur" choisies={etiqLivreur} onToggle={(c) => setEtiqLivreur((l) => basculer(l, c))} desactive={verrouille} />
        </fieldset>
      ) : null}

      {message ? <Alert ton={message.ton}>{message.texte}</Alert> : null}
      {verrouille ? null : (
        <button type="button" className="btn btn-primary" onClick={envoyer} disabled={enCours}>
          {enCours ? "Envoi…" : restaurant ? "Modifier mon avis" : "Envoyer mon avis"}
        </button>
      )}
      <p className="notation-aide">Modifiable pendant 24 h. La note du restaurant est publique avec votre prénom ; la note du livreur reste privée.</p>
    </Card>
  );
}
