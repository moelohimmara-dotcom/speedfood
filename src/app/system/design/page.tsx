import type { Metadata } from "next";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { sousSectionsAccessibles } from "@/lib/system-admin/permissions";
import { lireJetons } from "@/lib/studio/jetons-lecture";
import { listerHistoriqueJeton } from "@/lib/studio/jetons-actions";
import { PageHeader, Panneau } from "@/components/admin/blocs";
import { Alert } from "@/components/ui";
import { SousNav } from "../SousNav";
import { EditeurJetons } from "./EditeurJetons";
import { PanneauHistorique } from "./PanneauHistorique";
import "./design.css";

export const metadata: Metadata = { title: "Design (administration)" };

/**
 * Design — jetons du site (palier 4, phase 1). Permission `parametres.editer` + palier 2 (Éditeur) :
 * ces réglages changent l'apparence de TOUTES les pages, donc le seuil est celui de la mise en
 * ligne, pas celui d'un brouillon. `/system/design` est en 404 pour les rôles non habilités,
 * comme les autres écrans de la console.
 */
export default async function DesignPage() {
  const contexte = await exigerPermissionPage("parametres.editer");
  const [jetons, entrees] = await Promise.all([lireJetons("site"), listerHistoriqueJeton(30)]);

  const personnalises = jetons.filter((j) => j.personnalise);
  const restants = jetons.length - personnalises.length;

  return (
    <div>
      <PageHeader
        titre="Design"
        description="Couleurs, polices, espacements et formes du site. Ce que vous changez ici change partout, immédiatement."
      />
      <SousNav entrees={sousSectionsAccessibles("Paramètres", contexte.role)} />

      {personnalises.length === 0 ? (
        <Alert ton="info" style={{ marginBottom: "var(--space-4)" }}>
          Aucun réglage pour l&apos;instant : le site utilise ses valeurs d&apos;origine, déclarées dans le code.
          La première modification faite ici sera visible immédiatement sur toutes les pages.
        </Alert>
      ) : (
        <p className="ad-secondaire" style={{ marginBottom: "var(--space-4)" }}>
          {personnalises.length} réglage{personnalises.length > 1 ? "s" : ""} personnalisé{personnalises.length > 1 ? "s" : ""} ·{" "}
          {restants} valeur{restants > 1 ? "s" : ""} d&apos;origine.
        </p>
      )}

      <Panneau titre="Réglages du site" id="design-reglages">
        <EditeurJetons
          jetons={jetons.map((j) => ({
            cle: j.cle,
            valeur: j.valeur,
            libelle: j.libelle,
            groupe: j.groupe,
            personnalise: j.personnalise,
          }))}
        />
      </Panneau>

      <Panneau titre="Historique" id="design-historique">
        <PanneauHistorique entrees={entrees} aPersonnalise={personnalises.length > 0} />
      </Panneau>

      <Panneau titre="Ce que ces réglages ne font pas" id="design-limites">
        <ul className="ad-liste-simple">
          <li>Les textes du site ne se changent pas ici : ils sont dans « Contenu → Textes du site », eux aussi modifiables sans code.</li>
          <li>Les logos et photos des restaurants restent gérés restaurant par restaurant, depuis leur console.</li>
          <li>Une couleur illisible sur son texte est refusée, jamais corrigée automatiquement : le choix reste le vôtre.</li>
          <li>
            Les polices disponibles sont celles du site (Manrope, Bricolage, Barlow) et celles du téléphone. Aucune police distante : le
            navigateur du visiteur ne doit pas dépendre d&apos;un autre serveur.
          </li>
        </ul>
      </Panneau>
    </div>
  );
}
