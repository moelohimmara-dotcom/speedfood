"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { poserPhotoBibliothequeEquipeAction, type EtatPhotoBibliotheque } from "@/lib/system-admin/catalogue-restaurant";

const etatInitial: EtatPhotoBibliotheque = {};

export interface CandidatPhotoEquipe {
  id: string;
  source: "banque" | "ia";
  licence: string | null;
}

/** Pose une photo de la bibliothèque (même type de plat uniquement) sur un plat, depuis la console équipe. */
export function PhotoBibliothequeEquipe({ restaurantId, platId, candidats }: { restaurantId: string; platId: string; candidats: CandidatPhotoEquipe[] }) {
  const [etat, action, enCours] = useActionState(poserPhotoBibliothequeEquipeAction, etatInitial);
  if (candidats.length === 0) return null;

  return (
    <form action={action} className="catalogue-equipe-formulaire">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <input type="hidden" name="plat_id" value={platId} />
      <div className="field">
        <label htmlFor={`biblio-${platId}`}>Image de la bibliothèque (même type de plat)</label>
        <select id={`biblio-${platId}`} name="photo_id" defaultValue={candidats[0].id}>
          {candidats.map((c) => (
            <option key={c.id} value={c.id}>{c.id} · {c.source === "ia" ? "image illustrative (IA)" : `photo libre${c.licence ? ` (${c.licence})` : ""}`}</option>
          ))}
        </select>
        <p className="ad-aide-champ">La photo actuelle est remplacée. Une image IA est signalée « Image illustrative » aux clients ; le crédit des photos libres suit leur licence.</p>
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>{enCours ? "Pose…" : "Poser cette image"}</Button>
    </form>
  );
}
