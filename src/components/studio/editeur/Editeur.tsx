"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Puck, type Data, type Overrides, type Plugin, type UiState } from "@puckeditor/core";
// Variante sans import externe : la feuille par défaut charge https://rsms.me/inter/inter.css, interdit par la CSP.
import "@puckeditor/core/no-external.css";
import {
  enregistrerBrouillonBlocsAction,
  lireBrouillonBlocs,
  publierBlocsAction,
  restaurerVersionAction,
} from "@/lib/system-admin/pages-blocs";
import { validerPage } from "@/lib/studio/registre";
import { documentVersPuck, empreinte, estModifie, puckVersDocument, type DonneesEditeur } from "@/lib/studio/editeur-donnees";
import { DICTIONNAIRE_PUCK, TAILLES_APERCU } from "@/lib/studio/francisation";
import { permissionsEditeur } from "@/lib/studio/possibilites";
import { configEditeur } from "./config";
import { ContexteEditeur, type ContexteEditeurValeur, type MessageErreur, type ResultatAction } from "./contexte";
import { EnteteEditeur } from "./EnteteEditeur";
import { GardeNavigation } from "./GardeNavigation";
import { PanneauGauche } from "./PanneauBlocs";
import { CadreApercu, ChampsBloc, EtiquetteChamp, useFrancisationGlisser } from "./Habillage";
import type { ProprietesEditeur } from "./types";

/**
 * Éditeur visuel des pages à blocs (palier 3, tâche 7), chargé en différé dans le navigateur seulement.
 *
 * Puck garde son aperçu, son glisser-déposer et son historique ; tout ce qu'il affiche en anglais ou sans accès au clavier
 * est remplacé : en-tête (le nôtre), barre des onglets de gauche (masquée par le mécanisme officiel « legacy-side-bar »,
 * remplacée par notre panneau), sélecteur de taille d'aperçu (le nôtre), étiquettes de champs (groupes nommés), titre
 * de l'iframe ; les autres textes passent par le dictionnaire français. Les données envoyées au serveur sont réduites au
 * registre puis validées ici (message lisible) ; le serveur revalide tout (tâche 6), il reste la seule autorité.
 */

const MESSAGE_RESEAU = "Le serveur n'a pas répondu : vérifiez la connexion puis réessayez.";

const VIEWPORTS = TAILLES_APERCU.map((t) => ({ width: t.largeur, height: "auto" as const, label: t.libelle }));

const UI_INITIALE: Partial<UiState> = {
  leftSideBarVisible: true,
  rightSideBarVisible: true,
  plugin: { current: "legacy-side-bar" },
  // Aperçu « Mobile » par défaut : la plupart des visiteurs de Speedfood lisent sur téléphone.
  viewports: { current: { width: TAILLES_APERCU[0].largeur, height: "auto" }, controlsVisible: false, options: [] },
};

const OVERRIDES: Partial<Overrides> = {
  header: EnteteEditeur,
  fields: ChampsBloc,
  fieldLabel: EtiquetteChamp,
  iframe: CadreApercu,
};

// Le nom « legacy-side-bar » est le moyen prévu par Puck pour masquer sa barre d'onglets (non utilisable au clavier) :
// notre panneau prend sa place. Les onglets par défaut (réserve, plan, réglages) ne servent qu'à la mise en page
// téléphone de Puck, que nous ne chargeons pas : vidés, ils ne dupliquent plus la réserve ni les champs (identifiants
// en double) dans la page. Les réglages restent dans le panneau de droite de Puck.
const Vide = () => <></>;
const PLUGINS: Plugin[] = [
  { name: "legacy-side-bar", label: "Blocs", render: PanneauGauche },
  { name: "blocks", label: "Blocs", render: Vide },
  { name: "outline", label: "Plan de la page", render: Vide },
  { name: "fields", label: "Réglages", render: Vide },
];

function erreurDe(resultat: { erreur?: string; erreurs?: string[] }, defaut: string): MessageErreur {
  return { message: resultat.erreur ?? defaut, details: resultat.erreurs ?? [] };
}

export default function Editeur({ page, document, erreursInitiales, possibilites }: ProprietesEditeur) {
  const donneesInitiales = useMemo(() => documentVersPuck(document), [document]);
  const donneesRef = useRef<DonneesEditeur>(donneesInitiales);
  const reference = useRef(empreinte(puckVersDocument(donneesInitiales)));
  const [modifie, setModifie] = useState(false);
  // Publication faite ici : elle fait foi jusqu'à ce que la page serveur rafraîchie en sache autant (ou plus).
  const [publication, setPublication] = useState<{ version: number } | null>(null);
  const version = Math.max(publication?.version ?? 0, page.version);
  const statut = publication && publication.version >= page.version ? "publie" : page.statut;
  const [enCours, setEnCours] = useState<ContexteEditeurValeur["enCours"]>(null);
  const [erreur, setErreur] = useState<MessageErreur | null>(
    erreursInitiales.length > 0
      ? { message: "Le brouillon enregistré ne respecte pas le format des blocs : corrigez les points suivants avant d'enregistrer.", details: erreursInitiales }
      : null
  );
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [annonce, setAnnonce] = useState("");

  const surChangement = useCallback((donnees: Data) => {
    donneesRef.current = donnees as DonneesEditeur;
    setModifie(estModifie(donnees as DonneesEditeur, reference.current));
  }, []);

  // Jeton de concurrence du brouillon : lu à l'ouverture, renvoyé à chaque écriture, remplacé par celui du serveur.
  const jetonRef = useRef(page.jeton);
  const rafraichirJeton = useCallback(async (nouveau?: string) => {
    if (nouveau) {
      jetonRef.current = nouveau;
      return;
    }
    // Le serveur n'a pas pu le renvoyer : on relit le brouillon pour obtenir le jeton courant.
    const lu = await lireBrouillonBlocs(page.id);
    if (lu) jetonRef.current = lu.jeton;
  }, [page.id]);

  /** Enregistre le brouillon et renvoie le résultat (l'erreur est rendue à l'appelant, qui choisit où l'afficher). */
  const sauvegarder = useCallback(async (): Promise<ResultatAction> => {
    const validation = validerPage(puckVersDocument(donneesRef.current));
    if (!validation.ok) {
      return { ok: false, erreur: { message: "Le brouillon n'est pas enregistré : corrigez les points suivants.", details: validation.erreurs } };
    }
    setEnCours("enregistrer");
    try {
      const resultat = await enregistrerBrouillonBlocsAction(page.id, validation.page, jetonRef.current);
      if (!resultat.ok) return { ok: false, erreur: erreurDe(resultat, "Impossible d'enregistrer le brouillon.") };
      await rafraichirJeton(resultat.jeton);
      reference.current = empreinte(validation.page);
      setModifie(estModifie(donneesRef.current, reference.current));
      setAnnonce("Brouillon enregistré.");
      return { ok: true, avertissement: resultat.avertissement };
    } catch {
      return { ok: false, erreur: { message: MESSAGE_RESEAU, details: [] } };
    } finally {
      setEnCours(null);
    }
  }, [page.id, rafraichirJeton]);

  // Bouton « Enregistrer le brouillon » : l'erreur ou l'avertissement s'affichent dans l'en-tête.
  const enregistrer = useCallback(async (): Promise<boolean> => {
    const resultat = await sauvegarder();
    if (!resultat.ok) {
      setErreur(resultat.erreur);
      return false;
    }
    setErreur(null);
    if (resultat.avertissement) setAvertissement(resultat.avertissement);
    return true;
  }, [sauvegarder]);

  const publier = useCallback(
    async (motif: string): Promise<ResultatAction> => {
      // Le serveur publie le brouillon ENREGISTRÉ : les modifications en cours sont d'abord enregistrées (avec le jeton :
      // un onglet périmé est refusé ici, et rien n'est publié). Les messages sont rendus à la boîte de publication.
      const avertissements: string[] = [];
      if (estModifie(donneesRef.current, reference.current)) {
        const sauvee = await sauvegarder();
        if (!sauvee.ok) {
          return { ok: false, erreur: { message: `La page n'est pas publiée. ${sauvee.erreur.message}`, details: sauvee.erreur.details } };
        }
        if (sauvee.avertissement) avertissements.push(sauvee.avertissement);
      }
      setEnCours("publier");
      try {
        const resultat = await publierBlocsAction(page.id, motif, jetonRef.current);
        if (!resultat.ok) return { ok: false, erreur: erreurDe(resultat, "Impossible de publier la page.") };
        await rafraichirJeton(resultat.jeton);
        setPublication({ version: typeof resultat.version === "number" ? resultat.version : page.version });
        setErreur(null);
        if (resultat.avertissement) avertissements.push(resultat.avertissement);
        const avertissement = avertissements.join(" ");
        if (avertissement) setAvertissement(avertissement);
        setAnnonce(`Page publiée${typeof resultat.version === "number" ? ` (version ${resultat.version})` : ""}.`);
        return { ok: true, avertissement: avertissement || undefined };
      } catch {
        return { ok: false, erreur: { message: MESSAGE_RESEAU, details: [] } };
      } finally {
        setEnCours(null);
      }
    },
    [page.id, page.version, sauvegarder, rafraichirJeton]
  );

  const restaurer = useCallback(
    async (numero: number): Promise<ResultatAction & { donnees?: Data }> => {
      setEnCours("restaurer");
      try {
        const resultat = await restaurerVersionAction(page.id, numero);
        if (!resultat.ok) return { ok: false, erreur: erreurDe(resultat, "Impossible de remettre cette version dans le brouillon.") };
        if (resultat.avertissement) setAvertissement(resultat.avertissement);
        const brouillon = await lireBrouillonBlocs(page.id);
        if (!brouillon) return { ok: false, erreur: { message: "La version est remise dans le brouillon, mais il n'a pas pu être relu : rechargez la page.", details: [] } };
        jetonRef.current = brouillon.jeton;
        const donnees = documentVersPuck(brouillon.brouillon);
        // Nouvelle référence AVANT de charger les données : le changement qui suit n'est pas une modification.
        reference.current = empreinte(puckVersDocument(donnees));
        setErreur(null);
        setAnnonce(`Version ${numero} remise dans le brouillon. La page en ligne n'a pas changé.`);
        return { ok: true, donnees: donnees as Data };
      } catch {
        return { ok: false, erreur: { message: MESSAGE_RESEAU, details: [] } };
      } finally {
        setEnCours(null);
      }
    },
    [page.id]
  );

  const contexte: ContexteEditeurValeur = {
    page,
    statut,
    version,
    modifie,
    possibilites,
    enCours,
    erreur,
    avertissement,
    annonce,
    fermerAvertissement: () => setAvertissement(null),
    annoncer: setAnnonce,
    enregistrer,
    publier,
    restaurer,
  };

  const permissions = useMemo(() => permissionsEditeur(possibilites), [possibilites]);
  // Les annonces et consignes de glisser-déposer sont ajoutées à la page elle-même (corps du document).
  useFrancisationGlisser(typeof window === "undefined" ? undefined : window.document);

  return (
    <ContexteEditeur.Provider value={contexte}>
      <GardeNavigation actif={modifie} />
      <div className="studio-editeur">
        <Puck
          config={configEditeur}
          data={donneesInitiales as Data}
          onChange={surChangement}
          permissions={permissions}
          overrides={OVERRIDES}
          plugins={PLUGINS}
          dictionary={DICTIONNAIRE_PUCK}
          viewports={VIEWPORTS}
          ui={UI_INITIALE}
          height="100%"
        />
      </div>
    </ContexteEditeur.Provider>
  );
}
