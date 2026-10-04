"use client";

import { useActionState, useState } from "react";
import { Illustration } from "@/components/illustrations/Illustration";
import { MOTIFS } from "@/lib/illustrations/motifs";
import { STYLES, validerIllustration, type Illustration as ModeleIllustration, type StyleIllustration } from "@/lib/illustrations/modele";
import { illustrationCouverture, illustrationLogo, illustrationPlat } from "@/lib/illustrations/automatique";
import type { PALETTES } from "@/lib/illustrations/modele";
import { Alert, Button } from "@/components/ui";

export interface EtatEditeurIllustration {
  erreur?: string;
  succes?: boolean;
}
export type ActionIllustration = (precedent: EtatEditeurIllustration, formData: FormData) => Promise<EtatEditeurIllustration>;

const etatInitial: EtatEditeurIllustration = {};
const GROUPES: { cle: "plat" | "boisson" | "dessert" | "trait"; titre: string }[] = [
  { cle: "plat", titre: "Plats" },
  { cle: "boisson", titre: "Boissons" },
  { cle: "dessert", titre: "Desserts et fruits" },
  { cle: "trait", titre: "Traits (logos)" },
];

interface Props {
  cible: "logo" | "couverture" | "plat";
  id: string;
  restaurantId: string;
  nom: string;
  famille: keyof typeof PALETTES;
  valeur: ModeleIllustration | null;
  styles: StyleIllustration[];
  /** Action serveur qui enregistre ou supprime (console admin ou espace restaurateur) : même formulaire, droits différents. */
  action: ActionIllustration;
}

/** Éditeur d'une illustration : style, motif, trois couleurs, initiales, aperçu en direct. Aucune saisie libre de SVG. */
export function EditeurIllustration({ cible, id, restaurantId, nom, famille, valeur, styles, action: actionServeur }: Props) {
  const auto = () => (cible === "logo" ? illustrationLogo(nom, famille) : cible === "couverture" ? illustrationCouverture(famille) : illustrationPlat(nom, famille));
  const [v, setV] = useState<ModeleIllustration>(valeur ?? auto());
  const [etat, action, enCours] = useActionState(actionServeur, etatInitial);
  const [etatSuppr, actionSuppr, enCoursSuppr] = useActionState(actionServeur, etatInitial);
  const maj = (cle: keyof ModeleIllustration, x: string) => setV((p) => ({ ...p, [cle]: x, genere: false }));
  const valide = validerIllustration(v) !== null;
  const prefixe = `ill-${cible}-${id}`;

  return (
    <div className="ad-editeur-ill">
      <div className="ad-editeur-ill-apercu">
        {valide ? <Illustration valeur={v} nom={`Aperçu : ${nom}`} /> : <p className="ad-aide-champ">Aperçu indisponible : corrigez les valeurs.</p>}
        {valeur?.genere ? <span className="tag">Illustration de démonstration</span> : null}
      </div>
      <form action={action} className="ad-editeur-ill-champs">
        <input type="hidden" name="cible" value={cible} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="restaurant_id" value={restaurantId} />
        <div className="field">
          <label htmlFor={`${prefixe}-style`}>Style</label>
          <select id={`${prefixe}-style`} name="style" value={v.style} onChange={(e) => maj("style", e.target.value)}>
            {styles.map((s) => (
              <option key={s} value={s}>
                {STYLES[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefixe}-motif`}>Motif</label>
          <select id={`${prefixe}-motif`} name="motif" value={v.motif} onChange={(e) => maj("motif", e.target.value)}>
            {GROUPES.map((g) => (
              <optgroup key={g.cle} label={g.titre}>
                {Object.entries(MOTIFS)
                  .filter(([, m]) => m.famille === g.cle)
                  .map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.libelle}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="ad-editeur-ill-couleurs">
          {(["fond", "forme", "accent"] as const).map((c) => (
            <div className="field" key={c}>
              <label htmlFor={`${prefixe}-${c}`}>{c === "fond" ? "Fond" : c === "forme" ? "Dessin et lettres" : "Accent"}</label>
              <input id={`${prefixe}-${c}`} name={c} type="color" value={v[c]} onChange={(e) => maj(c, e.target.value)} />
            </div>
          ))}
        </div>
        {v.style === "monogramme" ? (
          <div className="field">
            <label htmlFor={`${prefixe}-texte`}>Initiales (3 au plus)</label>
            <input id={`${prefixe}-texte`} name="texte" value={v.texte} maxLength={3} onChange={(e) => maj("texte", e.target.value.toUpperCase())} />
          </div>
        ) : (
          <input type="hidden" name="texte" value="" />
        )}
        {!valide ? <Alert ton="danger">Initiales illisibles sur ce fond : choisissez des couleurs plus contrastées.</Alert> : null}
        {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
        {etat.succes ? <Alert ton="succes">Illustration enregistrée.</Alert> : null}
        <div className="ad-editeur-ill-actions">
          <Button type="submit" disabled={enCours || !valide}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button type="button" variante="secondary" onClick={() => setV(auto())}>
            Illustration automatique
          </Button>
        </div>
      </form>
      {valeur ? (
        <form action={actionSuppr}>
          <input type="hidden" name="cible" value={cible} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="restaurant_id" value={restaurantId} />
          <input type="hidden" name="supprimer" value="1" />
          <Button type="submit" variante="danger" className="ad-action-discrete" disabled={enCoursSuppr}>
            Supprimer cette illustration
          </Button>
          {etatSuppr.erreur ? <Alert ton="danger">{etatSuppr.erreur}</Alert> : null}
        </form>
      ) : null}
    </div>
  );
}
