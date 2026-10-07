"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { creerAccueilBlocsAction } from "@/lib/system-admin/accueil-blocs";
import { Alert, Button } from "@/components/ui";

/**
 * « Créer l'accueil en blocs » (Studio, palier 3) : crée la page `accueil` avec, dans son BROUILLON, les sections de la page
 * d'accueil actuelle dans l'ordre actuel, puis ouvre l'éditeur. Rien n'est publié. Si une page d'accueil existe déjà, un refus
 * clair propose de l'ouvrir. Le serveur revérifie tous les droits (palier 1 sur les pages).
 */
export function CreerAccueilBlocs() {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [existante, setExistante] = useState<{ id: string; format?: string } | null>(null);
  const [avertissement, setAvertissement] = useState<{ texte: string; id: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const creer = () => {
    setErreur(null);
    setExistante(null);
    demarrer(async () => {
      try {
        const resultat = await creerAccueilBlocsAction();
        if (!resultat.ok) {
          setErreur(resultat.erreur ?? "Impossible de créer la page d'accueil.");
          if (resultat.existe && resultat.id) setExistante({ id: resultat.id, format: resultat.format });
          return;
        }
        if (resultat.avertissement && resultat.id) {
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
      <p className="ad-palier-note">
        Crée une page d&apos;accueil composée de blocs, avec les sections actuelles dans l&apos;ordre actuel, que vous pourrez déplacer, masquer ou
        espacer. Elle n&apos;est pas publiée : le site garde son accueil actuel tant que vous ne la publiez pas.
      </p>
      <Button type="button" disabled={enCours} onClick={creer}>
        {enCours ? "Création…" : "Créer l'accueil en blocs"}
      </Button>
      {erreur ? (
        <div role="alert" style={{ marginTop: "var(--space-3)" }}>
          <Alert ton="danger">{erreur}</Alert>
          {existante ? (
            <p style={{ marginTop: "var(--space-2)" }}>
              <Link href={existante.format === "blocs" ? `/system/contenu/pages/${existante.id}/blocs` : `/system/contenu/pages/${existante.id}`} className="lien-texte">
                Ouvrir la page d&apos;accueil existante
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
