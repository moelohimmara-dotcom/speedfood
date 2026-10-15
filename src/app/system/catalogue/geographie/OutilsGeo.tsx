"use client";

import { useActionState, useId, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import { Pastille } from "@/components/admin/blocs";
import {
  apercuImportAction,
  appliquerImportAction,
  fusionnerQuartiersAction,
  type ApercuImport,
  type EtatGeographie,
  type QuartierSysteme,
} from "@/lib/system-admin/geographie";

const etatInitial: EtatGeographie = {};
const apercuInitial: ApercuImport = {};

/** Fusion de deux quartiers qui désignent le même lieu : tout est déplacé vers celui que l'on garde, l'autre est désactivé (jamais supprimé). */
export function FormulaireFusion({ quartiers }: { quartiers: QuartierSysteme[] }) {
  const [etat, action, enCours] = useActionState(fusionnerQuartiersAction, etatInitial);
  const [source, setSource] = useState("");
  const [cible, setCible] = useState("");
  const [confirme, setConfirme] = useState(false);
  const options = quartiers.map((q) => ({ valeur: q.id, libelle: `${q.nom} · ${q.communeNom ?? "?"}${q.actif ? "" : " (inactif)"}` }));
  const idConfirmation = useId();
  const choisis = source !== "" && cible !== "" && source !== cible;
  const quartierSource = quartiers.find((q) => q.id === source);
  const quartierCible = quartiers.find((q) => q.id === cible);

  return (
    <form action={action} className="geo-fusion">
      <p className="geo-details-aide">
        Quand deux quartiers désignent le même lieu (« Kipé » et « Kipe Centre »), gardez-en un : les restaurants, les zones de livraison, les
        clients et la liste d&apos;attente du doublon passent au quartier gardé, et son nom devient un nom alternatif. Le doublon est désactivé, pas supprimé.
      </p>
      <div className="geo-fusion-choix">
        <div>
          <span className="geo-outils-etiquette" id={`${idConfirmation}-source`}>
            Doublon à retirer
          </span>
          <ListeChoix nom="source" options={options} valeur={source} onChange={setSource} placeholder="Choisir le doublon…" libelleAccessible="Quartier doublon à retirer" idEtiquette={`${idConfirmation}-source`} />
        </div>
        <div>
          <span className="geo-outils-etiquette" id={`${idConfirmation}-cible`}>
            Quartier à garder
          </span>
          <ListeChoix nom="cible" options={options} valeur={cible} onChange={setCible} placeholder="Choisir le quartier gardé…" libelleAccessible="Quartier à garder" idEtiquette={`${idConfirmation}-cible`} />
        </div>
      </div>
      {choisis ? (
        <p className="geo-fusion-resume" role="status">
          « {quartierSource?.nom} » ({quartierSource?.communeNom}) rejoindra « {quartierCible?.nom} » ({quartierCible?.communeNom}).
        </p>
      ) : null}
      <label className="geo-interrupteur" htmlFor={idConfirmation}>
        <input id={idConfirmation} type="checkbox" name="confirmation" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} />
        <span>Je confirme cette fusion</span>
      </label>
      <div className="geo-ligne-haut">
        <button type="submit" className="btn btn-primary" disabled={enCours || !choisis || !confirme}>
          {enCours ? "Fusion…" : "Fusionner"}
        </button>
        {etat.erreur ? (
          <span role="alert" className="geo-erreur">
            {etat.erreur}
          </span>
        ) : null}
        <span role="status" aria-live="polite" className="geo-ok">
          {etat.succes ? "Quartiers fusionnés." : ""}
        </span>
      </div>
    </form>
  );
}

/**
 * Import d'un fichier corrigé dans un tableur. Deux étapes : « Voir les changements » (rien n'est écrit), puis « Appliquer » après
 * confirmation. À l'application, le serveur recompare le fichier à l'état ACTUEL de la base : il ne croit pas l'aperçu affiché.
 * Seuls les éléments existants sont modifiés (jamais créés ni supprimés).
 */
export function ImportGeographie({ lienExport }: { lienExport: string }) {
  const [apercu, voir, enCoursApercu] = useActionState(apercuImportAction, apercuInitial);
  const [resultat, appliquer, enCoursApplication] = useActionState(appliquerImportAction, apercuInitial);
  const [texte, setTexte] = useState("");
  const [confirme, setConfirme] = useState(false);
  const idFichier = useId();
  const idTexte = useId();
  const idConfirmation = useId();
  const [erreurFichier, setErreurFichier] = useState("");

  async function lireFichier(fichier: File | undefined) {
    setErreurFichier("");
    if (!fichier) return;
    if (fichier.size > 1_000_000) {
      setErreurFichier("Ce fichier dépasse 1 Mo.");
      return;
    }
    setTexte(await fichier.text());
  }

  const montre = resultat.appliques !== undefined || resultat.erreur || resultat.erreurs ? resultat : apercu;

  return (
    <div className="geo-import">
      <p className="geo-details-aide">
        1. Téléchargez le fichier de cette région. 2. Corrigez-le dans votre tableur (noms, visibilité, point central, noms alternatifs séparés par « | », statut). 3. Rechargez-le
        ici : vous verrez chaque changement avant de l&apos;appliquer. Ne changez ni la colonne « id » ni la colonne « niveau ».
      </p>
      <p>
        <a href={lienExport} className="btn btn-secondary" download>
          Télécharger le fichier de la région (CSV)
        </a>
      </p>
      <form className="geo-import-formulaire" action={voir}>
        <label htmlFor={idFichier} className="geo-outils-etiquette">
          Fichier corrigé (CSV)
        </label>
        <input id={idFichier} type="file" accept=".csv,text/csv" onChange={(e) => void lireFichier(e.target.files?.[0])} />
        {erreurFichier ? (
          <p role="alert" className="geo-erreur">
            {erreurFichier}
          </p>
        ) : null}
        <label htmlFor={idTexte} className="geo-outils-etiquette">
          Ou collez son contenu
        </label>
        <textarea id={idTexte} name="csv" rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} className="geo-import-texte" spellCheck={false} />
        <div className="geo-ligne-haut">
          <button type="submit" className="btn btn-secondary" disabled={enCoursApercu || texte.trim() === ""}>
            {enCoursApercu ? "Analyse…" : "Voir les changements"}
          </button>
        </div>

        {montre.erreur ? (
          <p role="alert" className="geo-erreur">
            {montre.erreur}
          </p>
        ) : null}
        {montre.erreurs ? (
          <div role="alert" className="geo-erreur">
            <p>Le fichier contient des erreurs, rien n&apos;a été appliqué :</p>
            <ul>
              {montre.erreurs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {montre.changements ? (
          <div role="status" aria-live="polite" className="geo-import-apercu">
            <p>
              <strong>{montre.changements.length}</strong> changement{montre.changements.length > 1 ? "s" : ""} · {montre.inchanges ?? 0} inchangé{(montre.inchanges ?? 0) > 1 ? "s" : ""}
              {montre.inconnus ? ` · ${montre.inconnus} ligne${montre.inconnus > 1 ? "s" : ""} ignorée${montre.inconnus > 1 ? "s" : ""} (identifiant inconnu)` : ""}
            </p>
            <ul className="geo-import-liste">
              {montre.changements.map((c) => (
                <li key={c.id}>
                  <strong>{c.nom}</strong> <Pastille ton="neutre">{c.niveau === "commune" ? "Commune" : "Quartier"}</Pastille>
                  <ul>
                    {c.champs.map((champ) => (
                      <li key={champ}>{champ}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {montre.changements.length > 0 ? (
              <>
                <label className="geo-interrupteur" htmlFor={idConfirmation}>
                  <input id={idConfirmation} type="checkbox" name="confirmation" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} />
                  <span>J&apos;ai relu ces changements et je confirme</span>
                </label>
                <button type="submit" formAction={appliquer} className="btn btn-primary" disabled={enCoursApplication || !confirme}>
                  {enCoursApplication ? "Application…" : `Appliquer ${montre.changements.length} changement${montre.changements.length > 1 ? "s" : ""}`}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {resultat.appliques !== undefined ? (
          <div role="status" aria-live="polite" className="geo-ok">
            <p>
              {resultat.appliques} modification{resultat.appliques > 1 ? "s" : ""} appliquée{resultat.appliques > 1 ? "s" : ""}.
            </p>
            {resultat.echecs && resultat.echecs.length > 0 ? (
              <ul className="geo-erreur">
                {resultat.echecs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
