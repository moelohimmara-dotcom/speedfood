"use client";

import { useActionState, useState } from "react";
import {
  analyserMenuPhotoAction,
  importerPlatsChefIaAction,
  type EtatChefIa,
  type PlatPropose,
} from "@/lib/menu/actions";
import { Alert, Button } from "@/components/ui";
import { reduireImage } from "@/lib/menu/reduireImage";

// Le fichier des actions est en « use server » : il n'exporte que des
// fonctions asynchrones, l'état initial est donc déclaré ici.
const etatChefIaInitial: EtatChefIa = {};

/**
 * Â« Chef IA Â» : le restaurateur photographie son menu (ardoise, feuille
 * imprimÃ©e, carte de la vitrine) et l'assistant en tire une liste de plats.
 *
 * Le principe de la feature tient en une phrase : RIEN n'est Ã©crit sans que le
 * restaurateur l'ait vu. Un modÃ¨le vision se trompe de prix, de virgule et
 * parfois de plat entier ; Ã©crire sa sortie directement en base reviendrait Ã 
 * publier un menu faux au nom du restaurateur. D'oÃ¹ les trois Ã©tapes :
 * photo â†’ relecture modifiable â†’ ajout.
 */

interface LigneRelecture {
  cle: string;
  nom: string;
  description: string;
  prix: string;
  section_id: string;
  /** LibellÃ© Ã©crit par le modÃ¨le quand il n'a su rattacher la ligne Ã  aucune section. */
  section: string | null;
  garde: boolean;
}

export function ChefIA({ sections }: { sections: { id: string; nom: string }[] }) {
  const [etat, action, enCours] = useActionState(analyserMenuPhotoAction, etatChefIaInitial);
  const [nomFichier, setNomFichier] = useState("");

  /**
   * La photo est rÃ©duite ICI, dans le navigateur, avant l'envoi, et pas par
   * l'action : un modÃ¨le vision est facturÃ© au nombre de pixels, et une photo
   * de smartphone brute (12 Mpx) coÃ»terait plusieurs fois plus pour le mÃªme
   * rÃ©sultat. 1 500 px suffisent largement Ã  lire une carte.
   */
  async function envoyer(saisie: FormData) {
    const fichier = saisie.get("photo");
    if (fichier instanceof File && fichier.size > 0) {
      saisie.set("photo", await reduireImage(fichier));
    }
    await action(saisie);
  }

  return (
    <details className="saisie-lot chef-ia">
      <summary>Lire mon menu avec l&apos;assistant</summary>
      <div className="saisie-lot-corps">
        <p className="aide-champ" style={{ margin: 0 }}>
          Photographiez votre menu : ardoise, feuille imprimÃ©e ou carte de vitrine.
          L&apos;assistant propose les plats et leurs prix, vous relisez tout avant
          l&apos;enregistrement. La photo n&apos;est pas conservÃ©e.
        </p>
        <form
          onSubmit={(e) => {
            // Pas d'action de formulaire : la photo doit Ãªtre rÃ©duite avant
            // d'Ãªtre envoyÃ©e (voir `envoyer`), sinon c'est l'original de
            // plusieurs mÃ©gaoctets qui part au modÃ¨le.
            e.preventDefault();
            void envoyer(new FormData(e.currentTarget));
          }}
        >
          <div className="field">
            <label htmlFor="chef-ia-photo">Photo du menu</label>
            <input
              id="chef-ia-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setNomFichier(e.target.files?.[0]?.name ?? "")}
            />
            <p className="aide-champ">JPEG, PNG ou WebP. La photo est rÃ©duite avant l&apos;envoi.</p>
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          <Button type="submit" pleineLargeur disabled={enCours || !nomFichier}>
            {enCours ? "Lecture en cours, quelques secondesâ€¦" : "Lire le menu"}
          </Button>
        </form>

        {etat.plats && etat.plats.length > 0 ? (
          <Relecture
            // La clÃ© force le remontage Ã  chaque nouvelle analyse : la table de
            // relecture repart de zÃ©ro sans avoir Ã  recopier l'Ã©tat Ã  la main
            // dans un effet (cf. les cascades de setState, ADR des hooks).
            key={etat.plats.map((p) => `${p.cle}:${p.nom}`).join("|")}
            plats={etat.plats}
            refuses={etat.refuses ?? []}
            sectionsInconnues={etat.sectionsInconnues ?? []}
            sections={sections}
          />
        ) : null}

        {etat.plats && etat.plats.length === 0 ? (
          <Alert ton="info">
            Aucun plat lisible sur cette photo. Photographiez-la de plus prÃ¨s, Ã  plat, avec une
            lumiÃ¨re franche.
          </Alert>
        ) : null}
      </div>
    </details>
  );
}

/** Ã‰tape 2 : la relecture. Tout est modifiable, et rien n'est cochÃ© par dÃ©faut pour un prix illisible. */
function Relecture({
  plats,
  refuses,
  sectionsInconnues,
  sections,
}: {
  plats: PlatPropose[];
  refuses: EtatChefIa["refuses"];
  sectionsInconnues: string[];
  sections: { id: string; nom: string }[];
}) {
  const [lignes, setLignes] = useState<LigneRelecture[]>(() =>
    plats.map((plat) => ({
      cle: plat.cle,
      nom: plat.nom,
      description: plat.description,
      prix: String(plat.prix),
      section_id: plat.section_id ?? "",
      section: plat.section,
      garde: true,
    }))
  );
  const [etat, action, enCours] = useActionState(importerPlatsChefIaAction, etatChefIaInitial);

  function changer(cle: string, champs: Partial<LigneRelecture>) {
    setLignes((actuelles) =>
      actuelles.map((ligne) => (ligne.cle === cle ? { ...ligne, ...champs } : ligne))
    );
  }

  const retenues = lignes.filter((ligne) => ligne.garde);

  if (etat.importes) {
    return (
      <div className="chef-ia-apercu">
        <Alert ton="succes" role="status">
          {etat.importes} plat{etat.importes > 1 ? "s" : ""} ajoutÃ©{etat.importes > 1 ? "s" : ""} Ã 
          votre menu. Ajoutez une photo Ã  chacun pour qu&apos;ils donnent envie.
        </Alert>
      </div>
    );
  }

  return (
    <form action={action} className="chef-ia-apercu">
      <input
        type="hidden"
        name="plats"
        value={JSON.stringify(
          retenues.map((ligne) => ({
            nom: ligne.nom,
            description: ligne.description,
            prix: ligne.prix,
            section_id: ligne.section_id,
          }))
        )}
      />

      <p className="saisie-lot-titre">
        {retenues.length} plat{retenues.length > 1 ? "s" : ""} Ã  ajouter â€” corrigez ce qui est faux
      </p>
      <p className="aide-champ">
        VÃ©rifiez surtout les prix : l&apos;assistant les lit sur l&apos;image, il ne les connaÃ®t pas.
      </p>

      <ul className="chef-ia-lignes">
        {lignes.map((ligne) => (
          <li key={ligne.cle} className="chef-ia-ligne">
            <label className="chef-ia-garde">
              <input
                type="checkbox"
                checked={ligne.garde}
                onChange={(e) => changer(ligne.cle, { garde: e.target.checked })}
              />
              <span className="sr-only">Ajouter ce plat</span>
            </label>
            <div className="chef-ia-champs">
              <input
                value={ligne.nom}
                onChange={(e) => changer(ligne.cle, { nom: e.target.value })}
                aria-label="Nom du plat"
                maxLength={120}
              />
              <div className="chef-ia-ligne-bas">
                <label>
                  <span className="sr-only">Prix du plat</span>
                  <input
                    value={ligne.prix}
                    onChange={(e) => changer(ligne.cle, { prix: e.target.value.replace(/\D/g, "") })}
                    inputMode="numeric"
                    aria-label={`Prix de ${ligne.nom}`}
                  />
                </label>
                <select
                  value={ligne.section_id}
                  onChange={(e) => changer(ligne.cle, { section_id: e.target.value })}
                  aria-label={`Section de ${ligne.nom}`}
                >
                  <option value="">Sans section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </div>
              {ligne.section && !ligne.section_id ? (
                <p className="chef-ia-note">
                  Â« {ligne.section} Â» sur la photo ne correspond Ã  aucune de vos sections : rangÃ©
                  sans section.
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {sectionsInconnues.length > 0 ? (
        <p className="chef-ia-note">
          Sections vues sur la photo, Ã  crÃ©er si vous le souhaitez : {sectionsInconnues.join(", ")}.
        </p>
      ) : null}

      {refuses && refuses.length > 0 ? (
        <details className="chef-ia-refuses">
          <summary>
            {refuses.length} ligne{refuses.length > 1 ? "s" : ""} non reprise{refuses.length > 1 ? "s" : ""}
          </summary>
          <ul>
            {refuses.map((refus, index) => (
              <li key={`${refus.brut}-${index}`}>
                {refus.brut} â€” {refus.raison}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" pleineLargeur disabled={enCours || retenues.length === 0}>
        {enCours ? "Ajoutâ€¦" : `Ajouter ${retenues.length} plat${retenues.length > 1 ? "s" : ""}`}
      </Button>
    </form>
  );
}