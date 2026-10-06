"use client";

import { useActionState, useState, useTransition } from "react";
import {
  enregistrerGroupeAction,
  retablirEmplacementAction,
  type EtatActionEmplacements,
} from "@/lib/system-admin/emplacements";
import { Alert, Badge, Button } from "@/components/ui";

export interface ChampTexte {
  cle: string;
  libelle: string;
  defaut: string;
  max: number;
  multiligne: boolean;
  /** Valeur enregistrée (surcharge), ou `null` si le défaut s'applique. */
  valeur: string | null;
}

const etatInitial: EtatActionEmplacements = {};

/** Un champ : saisie, compteur, valeur par défaut visible, badge « Modifié » et bouton de retour au défaut. */
function Champ({ champ, erreur, onRetablir, occupe }: { champ: ChampTexte; erreur?: string; onRetablir: () => void; occupe: boolean }) {
  const [saisie, setSaisie] = useState(champ.valeur ?? champ.defaut);
  const id = `texte-${champ.cle.replace(/\./g, "-")}`;
  const modifie = champ.valeur !== null;
  const proche = saisie.trim().length > champ.max;

  return (
    <div className={`field ad-texte-champ${erreur ? " has-error" : ""}`}>
      {/* Valeur vue à l'ouverture : sert au serveur à ne traiter que les champs touchés et à détecter un conflit. */}
      <input type="hidden" name={`i:${champ.cle}`} value={champ.valeur ?? champ.defaut} />
      <div className="ad-texte-entete">
        <label htmlFor={id}>{champ.libelle}</label>
        {modifie ? <Badge ton="neutre">Modifié</Badge> : null}
      </div>
      {champ.multiligne ? (
        <textarea
          id={id}
          name={`v:${champ.cle}`}
          rows={3}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={`${id}-aide`}
        />
      ) : (
        <input
          id={id}
          name={`v:${champ.cle}`}
          type="text"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={`${id}-aide`}
        />
      )}
      <div className="ad-texte-pied" id={`${id}-aide`}>
        <span className="ad-texte-defaut">Par défaut : {champ.defaut}</span>
        <span className={`ad-texte-compteur${proche ? " ad-texte-compteur-depasse" : ""}`}>
          {saisie.trim().length} / {champ.max}
        </span>
      </div>
      {erreur ? <span className="field-error">{erreur}</span> : null}
      {modifie ? (
        <div>
          <Button type="button" variante="secondary" disabled={occupe} onClick={onRetablir}>
            Rétablir le défaut
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function GroupeTextes({ groupe, champs }: { groupe: string; champs: ChampTexte[] }) {
  const [etat, action, enCours] = useActionState(enregistrerGroupeAction, etatInitial);
  const [retour, setRetour] = useState<EtatActionEmplacements>({});
  const [enTransition, demarrer] = useTransition();
  // Après un enregistrement ou un retour au défaut, les champs repartent des valeurs enregistrées (la clé change).
  const message = retour.erreur || retour.succes ? retour : etat;

  return (
    <form action={action} onSubmit={() => setRetour({})}>
      <input type="hidden" name="groupe" value={groupe} />
      <div className="ad-textes-champs">
        {champs.map((c) => (
          <Champ
            key={`${c.cle}:${c.valeur ?? ""}`}
            champ={c}
            erreur={etat.erreurs?.[c.cle]}
            occupe={enTransition || enCours}
            onRetablir={() => demarrer(async () => setRetour(await retablirEmplacementAction(c.cle)))}
          />
        ))}
      </div>
      <div aria-live="polite">
        {message.erreur ? <Alert ton="danger">{message.erreur}</Alert> : null}
        {!message.erreur && message.succes ? <Alert ton="succes">{message.succes}</Alert> : null}
      </div>
      <Button type="submit" disabled={enCours || enTransition}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
