"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { creerPlatEquipeAction, modifierPlatEquipeAction, type EtatCatalogue } from "@/lib/system-admin/catalogue-restaurant";

const etatInitial: EtatCatalogue = {};

export interface ValeursPlat {
  id: string;
  nom: string;
  description: string;
  prix: number;
  prixPromo: number | null;
}

/** Ajout ou modification d'un plat par l'équipe (même formulaire ; `plat` absent = ajout). Les montants sont des francs guinéens entiers. */
export function FormulairePlat({ restaurantId, plat }: { restaurantId: string; plat?: ValeursPlat }) {
  const [etat, action, enCours] = useActionState(plat ? modifierPlatEquipeAction : creerPlatEquipeAction, etatInitial);
  const cle = plat?.id ?? "nouveau";
  return (
    <form action={action} className="catalogue-equipe-formulaire">
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      {plat ? <input type="hidden" name="plat_id" value={plat.id} /> : null}
      <Input label="Nom du plat" name="nom" type="text" required maxLength={120} defaultValue={plat?.nom} />
      <div className="field">
        <label htmlFor={`description-${cle}`}>Description (facultatif)</label>
        <textarea id={`description-${cle}`} name="description" rows={2} maxLength={500} defaultValue={plat?.description} />
      </div>
      <div className="catalogue-equipe-prix">
        <Input label="Prix (GNF)" name="prix" type="text" inputMode="numeric" required defaultValue={plat ? String(plat.prix) : undefined} placeholder="35000" />
        <Input label="Prix promo (GNF, facultatif)" name="prix_promo" type="text" inputMode="numeric" defaultValue={plat?.prixPromo != null ? String(plat.prixPromo) : undefined} />
      </div>
      <div className="field">
        <label htmlFor={`photo-${cle}`}>{plat ? "Remplacer la photo (facultatif)" : "Photo (facultatif)"}</label>
        <input id={`photo-${cle}`} name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : plat ? "Enregistrer le plat" : "Ajouter le plat"}
      </Button>
    </form>
  );
}
