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
 * « Chef IA » : le restaurateur photographie son menu (ardoise, feuille
 * imprimée, carte de la vitrine) et l'assistant en tire une liste de plats.
 *
 * Le principe de la feature tient en une phrase : RIEN n'est écrit sans que le
 * restaurateur l'ait vu. Un modèle vision se trompe de prix, de virgule et
 * parfois de plat entier ; écrire sa sortie directement en base reviendrait à
 * publier un menu faux au nom du restaurateur. D'où les trois étapes :
 * photo → relecture modifiable → ajout.
 */

interface LigneRelecture {
  cle: string;
  nom: string;
  description: string;
  prix: string;
  section_id: string;
  /** Libellé écrit par le modèle quand il n'a su rattacher la ligne à aucune section. */
  section: string | null;
  garde: boolean;
}

export function ChefIA({ sections }: { sections: { id: string; nom: string }[] }) {
  const [etat, action, enCours] = useActionState(analyserMenuPhotoAction, etatChefIaInitial);
  const [nomFichier, setNomFichier] = useState("");

  /**
   * La photo est réduite ICI, dans le navigateur, avant l'envoi, et pas par
   * l'action : un modèle vision est facturé au nombre de pixels, et une photo
   * de smartphone brute (12 Mpx) coûterait plusieurs fois plus pour le même
   * résultat. 1 600 px suffisent largement à lire une carte.
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
          Photographiez votre menu : ardoise, feuille imprimée ou carte de vitrine.
          L&apos;assistant propose les plats et leurs prix, vous relisez tout avant
          l&apos;enregistrement. La photo n&apos;est pas conservée.
        </p>
        <form
          onSubmit={(e) => {
            // Pas d'action de formulaire : la photo doit être réduite avant
            // d'être envoyée (voir `envoyer`), sinon c'est l'original de
            // plusieurs mégaoctets qui part au modèle.
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
            <p className="aide-champ">
              JPEG, PNG ou WebP. La photo est réduite avant l&apos;envoi.
            </p>
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          <Button type="submit" pleineLargeur disabled={enCours || !nomFichier}>
            {enCours ? "Lecture en cours, quelques secondes…" : "Lire le menu"}
          </Button>
        </form>

        {etat.plats && etat.plats.length > 0 ? (
          <Relecture
            // La clé force le remontage à chaque nouvelle analyse : la table de
            // relecture repart de zéro sans avoir à recopier l'état à la main
            // dans un effet (cf. les cascades de setState, ADR des hooks).
            key={etat.plats.map((p) => `${p.cle}:${p.nom}`).join("|")}
            plats={etat.plats}
            refuses={etat.refuses ?? []}
            sectionsInconnues={etat.sectionsInconnues ?? []}
            sections={sections}
          />
        ) : null}

        {etat.plats && etat.plats.length === 0 ? (
          etat.lecture === "indetermine" ? (
            // Le message ne doit pas accuser la photo : ici, c'est nous qui
            // n'avons pas su comprendre la réponse du modèle.
            <Alert ton="danger">
              L&apos;assistant a répondu sans que nous puissions le lire. Recommencez, ou
              ajoutez vos plats un par un.
            </Alert>
          ) : (
            <Alert ton="info">
              Aucun plat lisible sur cette photo. Photographiez-la de plus près, à plat, avec une
              lumière franche.
            </Alert>
          )
        ) : null}
      </div>
    </details>
  );
}

/** Étape 2 : la relecture. Tout est modifiable, plat par plat. */
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
          {etat.importes} plat{etat.importes > 1 ? "s" : ""} ajouté
          {etat.importes > 1 ? "s" : ""} à votre menu. Ajoutez une photo à chacun pour
          qu&apos;ils donnent envie.
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
        {retenues.length} plat{retenues.length > 1 ? "s" : ""} à ajouter — corrigez ce qui est
        faux
      </p>
      <p className="aide-champ">
        Vérifiez surtout les prix : l&apos;assistant les lit sur l&apos;image, il ne les
        connaît pas.
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
              <span className="sr-only">Ajouter {ligne.nom}</span>
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
                  <span className="sr-only">Prix de {ligne.nom}</span>
                  <input
                    value={ligne.prix}
                    onChange={(e) =>
                      changer(ligne.cle, { prix: e.target.value.replace(/\D/g, "") })
                    }
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
                  « {ligne.section} » sur la photo ne correspond à aucune de vos sections : rangé
                  sans section.
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {sectionsInconnues.length > 0 ? (
        <p className="chef-ia-note">
          Sections vues sur la photo, à créer si vous le souhaitez :{" "}
          {sectionsInconnues.join(", ")}.
        </p>
      ) : null}

      {refuses && refuses.length > 0 ? (
        <details className="chef-ia-refuses">
          <summary>
            {refuses.length} ligne{refuses.length > 1 ? "s" : ""} non reprise
            {refuses.length > 1 ? "s" : ""}
          </summary>
          <ul>
            {refuses.map((refus, index) => (
              <li key={`${refus.brut}-${index}`}>
                {refus.brut} — {refus.raison}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      <Button type="submit" pleineLargeur disabled={enCours || retenues.length === 0}>
        {enCours ? "Ajout…" : `Ajouter ${retenues.length} plat${retenues.length > 1 ? "s" : ""}`}
      </Button>
    </form>
  );
}