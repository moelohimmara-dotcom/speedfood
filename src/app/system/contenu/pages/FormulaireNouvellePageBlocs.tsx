"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { creerPageBlocsAction } from "@/lib/system-admin/pages-blocs";
import { Alert, Button, Input } from "@/components/ui";

/**
 * Création d'une page à blocs (Studio, palier 3) : le bouton « Nouvelle page à blocs » déploie un court formulaire (titre,
 * adresse) ; la page est créée vide en brouillon (`creerPageBlocsAction`, palier 1 revérifié par le serveur), puis
 * l'éditeur visuel s'ouvre. Un avertissement d'audit éventuel est affiché avant de partir vers l'éditeur.
 */
export function FormulaireNouvellePageBlocs() {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<{ texte: string; id: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  // Le focus va sur le champ « Titre » quand le formulaire apparaît (effet : le champ existe alors dans la page).
  useEffect(() => {
    if (ouvert) document.getElementById("nouvelle-page-blocs-titre")?.focus();
  }, [ouvert]);

  // onSubmit (et non `action`) : en cas d'erreur, la saisie reste dans les champs.
  const soumettre = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setErreur(null);
    demarrer(async () => {
      try {
        const resultat = await creerPageBlocsAction(String(formData.get("titre") ?? ""), String(formData.get("slug") ?? ""));
        if (!resultat.ok || !resultat.id) {
          setErreur(resultat.erreur ?? "Impossible de créer la page.");
          return;
        }
        if (resultat.avertissement) {
          setAvertissement({ texte: resultat.avertissement, id: resultat.id });
          return;
        }
        router.push(`/system/contenu/pages/${resultat.id}/blocs`);
      } catch {
        setErreur("Le serveur n'a pas répondu : vérifiez la connexion puis réessayez.");
      }
    });
  };

  if (avertissement) {
    return (
      <div>
        <Alert ton="danger">{avertissement.texte}</Alert>
        <Button type="button" onClick={() => router.push(`/system/contenu/pages/${avertissement.id}/blocs`)}>
          Ouvrir l&apos;éditeur
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variante="secondary"
        aria-expanded={ouvert}
        aria-controls="nouvelle-page-blocs"
        onClick={() => setOuvert((v) => !v)}
      >
        Nouvelle page à blocs
      </Button>
      {ouvert ? (
        <form id="nouvelle-page-blocs" onSubmit={soumettre} style={{ marginTop: "var(--space-4)" }}>
          <p className="ad-palier-note">Une page composée de blocs (titres, paragraphes, boutons…), modifiée dans l&apos;éditeur visuel.</p>
          <Input id="nouvelle-page-blocs-titre" label="Titre" name="titre" type="text" required maxLength={200} />
          <Input label="Adresse (slug)" name="slug" type="text" required maxLength={100} placeholder="nos-engagements" />
          {erreur ? <Alert ton="danger">{erreur}</Alert> : null}
          <Button type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer et ouvrir l'éditeur"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
