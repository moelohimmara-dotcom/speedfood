"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { enregistrerReglagesScoreAction, type EtatReglagesScore } from "@/lib/system-admin/scores-actions";
import type { ReglagesScore } from "@/lib/restaurant/score-service";

const etatInitial: EtatReglagesScore = {};

/** Réglages du score qualité : seuils des paliers et délai d'acceptation, écrits en base et relus à chaque calcul. */
export function ReglagesScoreForm({ reglages }: { reglages: ReglagesScore }) {
  const [etat, action, enCours] = useActionState(enregistrerReglagesScoreAction, etatInitial);
  return (
    <form action={action} className="ad-panneau">
      <h2 className="ad-panneau-titre">Réglages du calcul</h2>
      <div className="ad-formulaire">
        <Input label="Seuil excellent (score minimum)" name="seuil_excellent" type="text" inputMode="numeric" required defaultValue={reglages.seuils.excellent} />
        <Input label="Seuil très bon" name="seuil_tres_bon" type="text" inputMode="numeric" required defaultValue={reglages.seuils.tresBon} />
        <Input label="Seuil bon" name="seuil_bon" type="text" inputMode="numeric" required defaultValue={reglages.seuils.bon} />
        <Input label="Seuil moyen (en dessous : mauvais)" name="seuil_moyen" type="text" inputMode="numeric" required defaultValue={reglages.seuils.moyen} />
        <Input label="Délai d'acceptation compté (minutes)" name="delai_acceptation_minutes" type="text" inputMode="numeric" required defaultValue={Math.round(reglages.delaiAcceptationSecondes / 60)} />
      </div>
      <p className="ad-aide-champ">Les seuils doivent être strictement décroissants. Tout changement s’applique au prochain calcul, jamais rétroactivement aux mois déjà publiés.</p>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      <Button type="submit" disabled={enCours}>{enCours ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
    </form>
  );
}
