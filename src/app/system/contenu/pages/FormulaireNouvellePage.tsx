"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { creerPageAction, type EtatActionContenu } from "@/lib/system-admin/contenus";
import { Input, Button, Alert } from "@/components/ui";

const etatInitial: EtatActionContenu = {};

/**
 * Création d'une page de texte : le bouton « Nouvelle page (texte) » déploie le formulaire —
 * même divulgation progressive que « Nouvelle page à blocs », pour que les deux créations
 * aient le même poids visuel (le formulaire grand ouvert dominait la section). Titre avant
 * l'adresse, comme dans l'autre formulaire : on pense un titre, pas une URL.
 */
export function FormulaireNouvellePage() {
  const [etat, action, enCours] = useActionState(creerPageAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);
  const [ouvert, setOuvert] = useState(false);

  // Après une création réussie : on vide les champs (le formulaire reste ouvert pour en créer
  // une autre ; la nouvelle page apparaît dans la liste sous le panneau). Refermer par effet est
  // interdit par le linter React (setState dans un effet) — l'utilisateur referme d'un clic.
  useEffect(() => {
    if (etat.succes) {
      formRef.current?.reset();
    }
  }, [etat]);

  // Le focus va sur « Titre » quand le formulaire apparaît.
  useEffect(() => {
    if (ouvert) document.getElementById("nouvelle-page-texte-titre")?.focus();
  }, [ouvert]);

  return (
    <div>
      <Button
        type="button"
        variante="secondary"
        aria-expanded={ouvert}
        aria-controls="nouvelle-page-texte"
        onClick={() => setOuvert((v) => !v)}
      >
        Nouvelle page (texte)
      </Button>
      {/* Une ligne de guidance AVANT le clic : les deux boutons se ressemblent, le choix est
          définitif (le format d'une page ne se convertit pas après création). Une fois le
          formulaire ouvert, sa propre description prend le relais. */}
      {!ouvert ? <p className="ad-palier-note">Un seul champ de texte : pages simples (CGV, mentions légales…).</p> : null}
      {ouvert ? (
        <form id="nouvelle-page-texte" action={action} ref={formRef} style={{ marginTop: "var(--space-4)" }}>
          <p className="ad-palier-note">Une page remplie dans un champ de texte unique, publiée telle quelle.</p>
          <Input id="nouvelle-page-texte-titre" label="Titre" name="titre" type="text" required maxLength={200} />
          <Input label="Adresse (slug)" name="slug" type="text" required maxLength={100} placeholder="comment-commander" />
          <div className="field">
            <label htmlFor="contenu">Contenu</label>
            <textarea id="contenu" name="contenu" rows={4} maxLength={20000} />
          </div>
          {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
          {etat.succes ? <p className="ad-palier-note">Page créée en brouillon : elle apparaît dans la liste ci-dessous.</p> : null}
          <Button type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer la page (brouillon)"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
