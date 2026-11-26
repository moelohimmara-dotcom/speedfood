"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { ajouterOptionEquipeAction, retirerOptionEquipeAction, type EtatOptionEquipe } from "@/lib/system-admin/catalogue-restaurant";

const etatInitial: EtatOptionEquipe = {};

export interface OptionPlatEquipe {
  id: string;
  nom: string;
  prix: number;
  disponible: boolean;
}

/** Suppléments d'un plat tenus par l'équipe : ajout (nom et prix) et retrait, comme dans la console restaurateur. */
export function OptionsPlatEquipe({ restaurantId, platId, options }: { restaurantId: string; platId: string; options: OptionPlatEquipe[] }) {
  const [etat, action, enCours] = useActionState(ajouterOptionEquipeAction, etatInitial);

  return (
    <div className="field">
      <span>Suppléments</span>
      {options.length === 0 ? <p className="ad-aide-champ">Aucun supplément.</p> : null}
      <ul className="ad-liste-simple">
        {options.map((option) => (
          <li key={option.id}>
            <strong>{option.nom}</strong>
            <span> · {option.prix.toLocaleString("fr-FR")} GNF{option.disponible ? "" : " · indisponible"}</span>{" "}
            <form action={retirerOptionEquipeAction} style={{ display: "inline" }}>
              <input type="hidden" name="restaurant_id" value={restaurantId} />
              <input type="hidden" name="option_id" value={option.id} />
              <button type="submit" className="btn btn-danger btn-compact">Retirer</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action} className="catalogue-equipe-formulaire">
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <input type="hidden" name="plat_id" value={platId} />
        <Input label="Nom du supplément" name="nom" type="text" required maxLength={80} placeholder="Ex. Fromage" />
        <Input label="Prix (GNF)" name="prix" type="text" inputMode="numeric" required placeholder="5000" />
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
        <Button type="submit" disabled={enCours}>{enCours ? "Ajout…" : "Ajouter le supplément"}</Button>
      </form>
    </div>
  );
}
