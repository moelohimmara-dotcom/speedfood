"use client";

import { useActionState, useId, useMemo, useState, useTransition } from "react";
import {
  creerElementTaxonomieAction,
  modifierElementTaxonomieAction,
  supprimerElementTaxonomieAction,
  type ElementTaxonomie,
  type EtatActionTaxonomie,
} from "@/lib/system-admin/taxonomie";
import { Input, Button, Alert } from "@/components/ui";
import { useConfirmation, useNotification } from "@/components/console/ConsoleProviders";

const etatInitial: EtatActionTaxonomie = {};

type Table = "menu_categories" | "neighborhoods";

/** Au-delà de ce nombre d'éléments, la liste propose une recherche ; elle s'affiche par lots (audit du 15 octobre : 136 quartiers d'un seul bloc). */
const SEUIL_RECHERCHE = 12;
const TAILLE_LOT = 30;

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function ListeTaxonomie({ table, elements }: { table: Table; elements: ElementTaxonomie[] }) {
  const actionCreer = creerElementTaxonomieAction.bind(null, table);
  const [etatCreation, creer] = useActionState(actionCreer, etatInitial);
  const idRecherche = useId();
  const [recherche, setRecherche] = useState("");
  const [limite, setLimite] = useState(TAILLE_LOT);

  const requete = normaliser(recherche);
  const trouves = useMemo(() => (requete ? elements.filter((e) => normaliser(e.nom).includes(requete)) : elements), [elements, requete]);
  const affiches = trouves.slice(0, limite);
  const avecRecherche = elements.length > SEUIL_RECHERCHE;
  const nomPluriel = table === "neighborhoods" ? "quartiers" : "catégories";
  const nomSingulier = table === "neighborhoods" ? "quartier" : "catégorie";

  return (
    <div>
      {avecRecherche ? (
        <div className="tx-recherche" role="search">
          <label htmlFor={idRecherche} className="tx-recherche-etiquette">
            Rechercher parmi les {elements.length} {nomPluriel}
          </label>
          <input
            id={idRecherche}
            type="search"
            className="tx-recherche-champ"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setLimite(TAILLE_LOT);
            }}
            autoComplete="off"
            placeholder={`Nom du ${nomSingulier}`}
          />
          <p role="status" aria-live="polite" className="tx-recherche-etat">
            {requete ? `${trouves.length} résultat${trouves.length > 1 ? "s" : ""}` : `${elements.length} ${nomPluriel}`}
            {trouves.length > affiches.length ? ` · ${affiches.length} affichés` : ""}
          </p>
        </div>
      ) : null}
      <div className="tx-liste">
        {affiches.map((e) => (
          <LigneElement key={e.id} table={table} element={e} />
        ))}
        {avecRecherche && trouves.length === 0 ? <p className="ad-aide-champ">Aucun élément ne correspond à cette recherche.</p> : null}
        {trouves.length > affiches.length ? (
          <Button type="button" variante="secondary" onClick={() => setLimite((l) => l + TAILLE_LOT)}>
            Afficher {Math.min(TAILLE_LOT, trouves.length - affiches.length)} de plus ({trouves.length - affiches.length} restants)
          </Button>
        ) : null}
      </div>

      <form action={creer} className="tx-ajout" aria-label={`Ajouter un ${nomSingulier}`}>
        <div className="field tx-ajout-nom">
          <label htmlFor={`nom-${table}`}>Nom du nouveau {nomSingulier}</label>
          <input id={`nom-${table}`} name="nom" type="text" required maxLength={100} />
        </div>
        <div className="field tx-champ-ordre">
          <label htmlFor={`ordre-${table}`}>Position</label>
          <input id={`ordre-${table}`} name="ordre" type="number" defaultValue={elements.length} />
        </div>
        <Button type="submit">Ajouter</Button>
      </form>
      {etatCreation.erreur ? (
        <Alert ton="danger" className="tx-alerte">
          {etatCreation.erreur}
        </Alert>
      ) : null}
    </div>
  );
}

function LigneElement({ table, element }: { table: Table; element: ElementTaxonomie }) {
  const [ouvert, setOuvert] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);
  const [enTransition, demarrerTransition] = useTransition();
  const confirmer = useConfirmation();
  const notifier = useNotification();

  const actionModifier = modifierElementTaxonomieAction.bind(null, table);
  const [etat, modifier] = useActionState(actionModifier, etatInitial);
  // L'édition ne se ferme qu'APRÈS un enregistrement réussi : avant, elle se fermait dès l'envoi et une erreur du serveur était perdue.
  const [etatALOuverture, setEtatALOuverture] = useState(etat);
  const enEdition = ouvert && !(etat !== etatALOuverture && !etat.erreur);
  const setEnEdition = (valeur: boolean) => {
    if (valeur) setEtatALOuverture(etat);
    setOuvert(valeur);
  };

  if (enEdition) {
    return (
      <form action={modifier} className="tx-ligne tx-edition" aria-label={`Modifier ${element.nom}`}>
        <input type="hidden" name="id" value={element.id} />
        <Input label="Nom" name="nom" type="text" required maxLength={100} defaultValue={element.nom} className="tx-edition-nom" />
        <Input label="Position" name="ordre" type="number" defaultValue={element.ordre} className="tx-champ-ordre" />
        <Button type="submit">Enregistrer</Button>
        <Button type="button" variante="secondary" onClick={() => setEnEdition(false)}>
          Annuler
        </Button>
        {etat.erreur ? (
          <Alert ton="danger" className="tx-alerte tx-alerte-ligne">
            {etat.erreur}
          </Alert>
        ) : null}
      </form>
    );
  }

  return (
    <div className="tx-ligne">
      <span className="tx-nom">{element.nom}</span>
      <div className="tx-actions">
        <Button type="button" variante="secondary" className="btn-compact" onClick={() => setEnEdition(true)} aria-label={`Modifier ${element.nom}`}>
          Modifier
        </Button>
        <Button
          type="button"
          variante="danger"
          className="tx-supprimer"
          aria-label={`Supprimer ${element.nom}`}
          disabled={enTransition}
          onClick={async () => {
            // Confirmation commune (fondations de la refonte) : nommée, annulable au clavier, focus sur « Annuler ».
            const reponse = await confirmer({
              titre: `Supprimer « ${element.nom} » ?`,
              message: <p>La suppression est définitive. Pour retirer seulement ce choix des listes, désactivez-le plutôt dans Géographie.</p>,
              libelleAction: "Supprimer",
              danger: true,
            });
            if (!reponse.confirme) return;
            demarrerTransition(async () => {
              const resultat = await supprimerElementTaxonomieAction(table, element.id);
              setErreurSuppression(resultat.erreur ?? null);
              notifier(resultat.erreur ? "erreur" : "succes", resultat.erreur ?? `« ${element.nom} » a été supprimé.`);
            });
          }}
        >
          Supprimer
        </Button>
      </div>
      {erreurSuppression ? (
        <Alert ton="danger" className="tx-alerte tx-alerte-ligne">
          {erreurSuppression}
        </Alert>
      ) : null}
    </div>
  );
}
