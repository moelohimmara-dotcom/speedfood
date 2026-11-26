"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { creerPlatsEnLotEquipeAction, type EtatAjoutEnLotEquipe } from "@/lib/system-admin/catalogue-restaurant";
import type { SectionEquipe } from "@/lib/system-admin/catalogue-restaurant-lecture";

const etatInitial: EtatAjoutEnLotEquipe = {};

/** Ajout en lot par liste collée : une ligne par plat, le prix à la fin (même compréhension que la console restaurateur). */
export function AjoutEnLotEquipe({ restaurantId, sections }: { restaurantId: string; sections: SectionEquipe[] }) {
  const [etat, action, enCours] = useActionState(creerPlatsEnLotEquipeAction, etatInitial);

  return (
    <form action={action} className="catalogue-equipe-formulaire">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <div className="field">
        <label htmlFor="lot-liste">Liste des plats (30 au plus)</label>
        <textarea id="lot-liste" name="liste" rows={8} maxLength={6000} placeholder={"Riz sauce feuille 25000\nPoulet braisé 40000\nJus de gingembre 5000"} />
        <p className="ad-aide-champ">Une ligne par plat, avec le prix en GNF à la fin. Les lignes sans prix reconnu sont ignorées et comptées.</p>
      </div>
      <div className="field">
        <label htmlFor="lot-section">Section commune (facultatif)</label>
        <select id="lot-section" name="section_id" defaultValue="">
          <option value="">Sans section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.nom}</option>
          ))}
        </select>
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.ajoutes !== undefined ? <Alert ton="succes">{etat.ajoutes} plat{etat.ajoutes > 1 ? "s" : ""} ajouté{etat.ajoutes > 1 ? "s" : ""}{etat.ignorees ? `, ${etat.ignorees} ligne${etat.ignorees > 1 ? "s" : ""} ignorée${etat.ignorees > 1 ? "s" : ""}` : ""}.</Alert> : null}
      <Button type="submit" disabled={enCours}>{enCours ? "Ajout…" : "Ajouter les plats"}</Button>
    </form>
  );
}
