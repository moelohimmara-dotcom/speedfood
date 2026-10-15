"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ListeChoix } from "@/components/ui/ListeChoix";
import { useNotification } from "@/components/console/ConsoleProviders";
import {
  enregistrerCommuneAction,
  enregistrerPrefectureAction,
  enregistrerQuartierAction,
  enregistrerRegionAction,
  suggererPointAction,
  type CommuneSysteme,
  type EtatGeographie,
  type QuartierSysteme,
  type SuggestionPoint,
  type ZoneLargeSysteme,
} from "@/lib/system-admin/geographie";
import { LIBELLES_STATUT, STATUTS_LANCEMENT, lienCarte, pointValide, type StatutLancement } from "@/lib/system-admin/geographie-outils";

const etatInitial: EtatGeographie = {};

/**
 * Suivi des modifications d'une ligne : le bouton « Enregistrer » ne s'active qu'une fois quelque chose changé, et une ligne modifiée
 * le dit. Après l'envoi la ligne redevient « à jour » ; si l'enregistrement échoue, le bouton se réactive pour réessayer.
 */
function useSuiviModification() {
  const [modifie, setModifie] = useState(false);
  return {
    modifie,
    marquer: () => setModifie(true),
    remettre: () => setModifie(false),
    // La case de sélection (lot) n'est pas une modification de la ligne.
    surChangement: (e: { target: EventTarget }) => {
      if (e.target instanceof HTMLElement && e.target.classList.contains("geo-selection")) return;
      setModifie(true);
    },
  };
}

/**
 * Confirme un enregistrement par une notification de la console, qui ne dépend pas de la ligne : la ligne est redessinée après l'envoi
 * (la page est rechargée) et son petit « Enregistré. » pouvait disparaître avant d'être lu. Le nom est lu au moment du succès, sans relancer l'effet.
 */
function useConfirmationEnregistrement(etat: EtatGeographie, nom: string | undefined) {
  const notifier = useNotification();
  const nomRef = useRef(nom);
  useEffect(() => {
    nomRef.current = nom;
  }, [nom]);
  useEffect(() => {
    if (etat.succes) notifier("succes", nomRef.current ? `« ${nomRef.current} » est enregistré.` : "Enregistré.");
  }, [etat, notifier]);
}

function BoutonLigne({
  modifie,
  enCours,
  etat,
  libelle = "Enregistrer",
  creation = false,
}: {
  modifie: boolean;
  enCours: boolean;
  etat: EtatGeographie;
  libelle?: string;
  /** Formulaire d'ajout : toujours prêt à envoyer. */
  creation?: boolean;
}) {
  const actif = creation || modifie || Boolean(etat.erreur);
  return (
    <button type="submit" className="btn btn-secondary geo-enregistrer" disabled={enCours || !actif}>
      {enCours ? "Enregistrement…" : libelle}
    </button>
  );
}

/** Ce qui s'est passé sur la ligne : erreur, « Modifications non enregistrées » ou « Enregistré. » (annoncé aux lecteurs d'écran). */
function EtatLigne({ modifie, etat, creation = false }: { modifie: boolean; etat: EtatGeographie; creation?: boolean }) {
  return (
    <>
      {etat.erreur ? (
        <span role="alert" className="geo-erreur">
          {etat.erreur}
        </span>
      ) : null}
      <span role="status" aria-live="polite" className={modifie && !creation ? "geo-etat geo-etat-modifie" : "geo-etat geo-ok"}>
        {modifie && !creation ? "Modifications non enregistrées" : etat.succes ? "Enregistré." : ""}
      </span>
    </>
  );
}

/** Interrupteur « visible dans les choix » : désactiver retire la zone des listes et de la recherche, sans rien supprimer. */
function Interrupteur({ defaut, libelle }: { defaut: boolean; libelle: string }) {
  return (
    <label className="geo-interrupteur">
      <input type="checkbox" name="actif" defaultChecked={defaut} role="switch" />
      <span>
        Visible<span className="sr-only"> {libelle}</span>
      </span>
    </label>
  );
}

function Code({ code }: { code: string | null }) {
  return code ? (
    <span className="geo-code" title="Code officiel de la zone">
      Code {code}
    </span>
  ) : null;
}

function Demande({ attente }: { attente: number }) {
  return attente > 0 ? (
    <span className="geo-demande" title="Personnes inscrites sur la liste d'attente de cette zone">
      {attente} en attente
    </span>
  ) : null;
}

function LienPublic({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="geo-lien-public">
      Voir comme un visiteur<span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}

/** Point central (latitude, longitude) avec contrôle immédiat, lien de vérification sur la carte et suggestion OpenStreetMap ; noms alternatifs. */
function ChampsPoint({
  latitude,
  longitude,
  nomsAlternatifs,
  avecAliases = true,
  contexte,
  onModifie,
}: {
  latitude: number | null;
  longitude: number | null;
  nomsAlternatifs?: string[];
  avecAliases?: boolean;
  /** Ce qui précise la zone pour la recherche de lieu (préfecture, commune…). */
  contexte: string;
  onModifie: () => void;
}) {
  const [lat, setLat] = useState(latitude === null ? "" : String(latitude));
  const [lon, setLon] = useState(longitude === null ? "" : String(longitude));
  const [recherche, setRecherche] = useState(false);
  const [suggestion, setSuggestion] = useState<SuggestionPoint | null>(null);

  const nombreLat = Number(lat.replace(",", "."));
  const nombreLon = Number(lon.replace(",", "."));
  const vide = lat.trim() === "" && lon.trim() === "";
  let probleme: string | null = null;
  if (!vide) {
    if (lat.trim() === "" || lon.trim() === "") probleme = "Indiquez la latitude ET la longitude, ou videz les deux.";
    else if (!Number.isFinite(nombreLat) || !Number.isFinite(nombreLon)) probleme = "Écrivez des nombres, par exemple 9.64 et -13.58.";
    else if (!pointValide(nombreLat, nombreLon)) probleme = "Ce point est hors de la Guinée (latitude de 7 à 13, longitude de -15,5 à -7).";
  }
  const renseigne = !vide && probleme === null;

  async function suggerer(bouton: HTMLButtonElement) {
    const nom = (bouton.form?.elements.namedItem("nom") as HTMLInputElement | null)?.value ?? "";
    setRecherche(true);
    setSuggestion(null);
    setSuggestion(await suggererPointAction(nom, contexte));
    setRecherche(false);
  }

  function accepter() {
    if (suggestion?.latitude === undefined || suggestion.longitude === undefined) return;
    setLat(String(suggestion.latitude));
    setLon(String(suggestion.longitude));
    setSuggestion(null);
    onModifie();
  }

  return (
    <details className="geo-details">
      <summary>
        Point central{avecAliases ? " et noms alternatifs" : ""}
        <span className="geo-details-resume">{renseigne ? `${nombreLat}, ${nombreLon}` : vide ? "non renseigné" : "à corriger"}</span>
      </summary>
      <div className="geo-details-corps">
        <label>
          Latitude
          <input
            name="latitude"
            type="text"
            inputMode="decimal"
            ref={(champ) => champ?.setCustomValidity(probleme ?? "")}
            // Un champ refusé dans un panneau replié ne peut pas recevoir le focus : le panneau s'ouvre pour montrer le message.
            onInvalid={(e) => e.currentTarget.closest("details")?.setAttribute("open", "")}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="9.6412"
            maxLength={12}
            aria-invalid={probleme ? true : undefined}
          />
        </label>
        <label>
          Longitude
          <input
            name="longitude"
            type="text"
            inputMode="decimal"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="-13.6015"
            maxLength={12}
            aria-invalid={probleme ? true : undefined}
          />
        </label>
        <div className="geo-point-actions">
          <button type="button" className="btn btn-secondary" onClick={(e) => void suggerer(e.currentTarget)} disabled={recherche}>
            {recherche ? "Recherche…" : "Suggérer un point"}
          </button>
          {renseigne ? (
            <a href={lienCarte(nombreLat, nombreLon)} target="_blank" rel="noopener noreferrer" className="geo-lien-public">
              Voir sur la carte<span className="sr-only"> (nouvel onglet)</span>
            </a>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className={probleme ? "geo-erreur geo-point-etat" : "geo-point-etat"}>
          {probleme ?? ""}
        </p>
        {suggestion ? (
          <div className="geo-suggestion" role="status">
            {suggestion.erreur ? (
              <p className="geo-erreur">{suggestion.erreur}</p>
            ) : (
              <>
                <p>
                  OpenStreetMap propose <strong>{suggestion.latitude}, {suggestion.longitude}</strong> :<br />
                  <span className="geo-suggestion-lieu">{suggestion.lieu}</span>
                </p>
                <div className="geo-point-actions">
                  <button type="button" className="btn btn-secondary" onClick={accepter}>
                    Utiliser ce point
                  </button>
                  <a href={lienCarte(suggestion.latitude ?? 0, suggestion.longitude ?? 0)} target="_blank" rel="noopener noreferrer" className="geo-lien-public">
                    Vérifier sur la carte<span className="sr-only"> (nouvel onglet)</span>
                  </a>
                </div>
                <p className="geo-details-aide">Comparez le lieu avec la zone avant d&apos;accepter : rien n&apos;est enregistré tant que vous n&apos;avez pas cliqué sur « Enregistrer ».</p>
              </>
            )}
          </div>
        ) : null}
        {avecAliases ? (
          <label className="geo-details-large">
            Noms alternatifs (un par ligne)
            <textarea name="noms_alternatifs" rows={2} defaultValue={(nomsAlternatifs ?? []).join("\n")} maxLength={900} />
          </label>
        ) : null}
        <p className="geo-details-aide">
          Le point sert à trouver la zone d&apos;une personne qui utilise « Utiliser ma position ». Les noms alternatifs sont reconnus par la
          recherche et par la localisation (ex. « Kipe Centre » pour Kipé). Laissez vide pour retirer.
        </p>
      </div>
    </details>
  );
}

/** Une région ou une préfecture : nom, visibilité et point central. Désactiver la retire de la recherche, sans rien supprimer. */
export function FormulaireZoneLargeSysteme({ zone, type, contexte = "" }: { zone: ZoneLargeSysteme; type: "region" | "prefecture"; contexte?: string }) {
  const [etat, action, enCours] = useActionState(type === "region" ? enregistrerRegionAction : enregistrerPrefectureAction, etatInitial);
  const suivi = useSuiviModification();
  useConfirmationEnregistrement(etat, zone.nom);
  const envoyer = (donnees: FormData) => {
    suivi.remettre();
    action(donnees);
  };
  return (
    <form action={envoyer} onChange={suivi.surChangement} id={`el-${zone.id}`} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        <input type="hidden" name="id" value={zone.id} />
        <input name="nom" defaultValue={zone.nom} required minLength={2} maxLength={80} aria-label={`Nom de ${type === "region" ? "la région" : "la préfecture"} ${zone.nom}`} />
        <Interrupteur defaut={zone.actif} libelle="dans les choix" />
        <BoutonLigne modifie={suivi.modifie} enCours={enCours} etat={etat} />
      </div>
      <div className="geo-ligne-meta">
        <Code code={zone.codeOfficiel} />
        <Demande attente={zone.attente} />
        <LienPublic href={zone.lienPublic} />
        <EtatLigne modifie={suivi.modifie} etat={etat} />
      </div>
      <ChampsPoint latitude={zone.latitude} longitude={zone.longitude} avecAliases={false} contexte={contexte} onModifie={suivi.marquer} />
    </form>
  );
}

const OPTIONS_STATUT = [
  { valeur: "auto", libelle: "Automatique" },
  ...STATUTS_LANCEMENT.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT[s] })),
];

/** Une commune : nom, visibilité, statut de lancement, point central. Case de sélection reliée au formulaire de lot (`form="lot-communes"`). */
export function FormulaireCommuneSysteme({ commune, contexte = "" }: { commune: CommuneSysteme; contexte?: string }) {
  const [etat, action, enCours] = useActionState(enregistrerCommuneAction, etatInitial);
  const suivi = useSuiviModification();
  useConfirmationEnregistrement(etat, commune.nom);
  const [statut, setStatut] = useState<StatutLancement | "auto">(commune.statutLancement ?? "auto");
  const envoyer = (donnees: FormData) => {
    suivi.remettre();
    action(donnees);
  };

  return (
    <form action={envoyer} onChange={suivi.surChangement} id={`el-${commune.id}`} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        <label className="geo-selection-zone">
          <input type="checkbox" name="ids" value={commune.id} form="lot-communes" className="geo-selection" aria-label={`Sélectionner ${commune.nom}`} />
        </label>
        <input type="hidden" name="id" value={commune.id} />
        <input name="nom" defaultValue={commune.nom} required minLength={2} maxLength={80} aria-label={`Nom de la commune ${commune.nom}`} />
        <Interrupteur defaut={commune.actif} libelle="dans les choix" />
        <div className="geo-statut">
          <ListeChoix
            nom="statut_lancement"
            options={OPTIONS_STATUT}
            valeur={statut}
            onChange={(v) => {
              setStatut(v as StatutLancement | "auto");
              suivi.marquer();
            }}
            placeholder="Statut…"
            libelleAccessible={`Statut de lancement de ${commune.nom}`}
          />
        </div>
        <BoutonLigne modifie={suivi.modifie} enCours={enCours} etat={etat} />
      </div>
      <div className="geo-ligne-meta">
        <Code code={commune.codeOfficiel} />
        <Demande attente={commune.attente} />
        <LienPublic href={commune.lienPublic} />
        <EtatLigne modifie={suivi.modifie} etat={etat} />
      </div>
      <ChampsPoint latitude={commune.latitude} longitude={commune.longitude} nomsAlternatifs={commune.nomsAlternatifs} contexte={contexte} onModifie={suivi.marquer} />
    </form>
  );
}

/** Un quartier existant (avec `quartier`) ou la création d'un nouveau (sans `quartier`). */
export function FormulaireQuartierSysteme({
  quartier,
  communes,
}: {
  quartier?: QuartierSysteme;
  communes: CommuneSysteme[];
}) {
  const [etat, action, enCours] = useActionState(enregistrerQuartierAction, etatInitial);
  const suivi = useSuiviModification();
  useConfirmationEnregistrement(etat, quartier?.nom);
  const [communeId, setCommuneId] = useState(quartier?.communeId ?? "");
  const libelleNom = quartier ? `Nom du quartier ${quartier.nom}` : "Nom du nouveau quartier";
  const envoyer = (donnees: FormData) => {
    suivi.remettre();
    action(donnees);
  };

  return (
    <form action={envoyer} onChange={suivi.surChangement} id={quartier ? `el-${quartier.id}` : undefined} className="geo-ligne geo-ligne-colonne">
      <div className="geo-ligne-haut">
        {quartier ? (
          <label className="geo-selection-zone">
            <input type="checkbox" name="ids" value={quartier.id} form="lot-quartiers" className="geo-selection" aria-label={`Sélectionner ${quartier.nom}`} />
          </label>
        ) : null}
        {quartier ? <input type="hidden" name="id" value={quartier.id} /> : null}
        <input name="nom" defaultValue={quartier?.nom ?? ""} required minLength={2} maxLength={80} placeholder="Nom du quartier" aria-label={libelleNom} />
        <div className="geo-commune">
          <ListeChoix
            nom="commune_id"
            options={communes.map((c) => ({ valeur: c.id, libelle: c.actif ? c.nom : `${c.nom} (inactive)` }))}
            valeur={communeId}
            onChange={(v) => {
              setCommuneId(v);
              suivi.marquer();
            }}
            placeholder="Commune…"
            libelleAccessible="Commune du quartier"
          />
        </div>
        <Interrupteur defaut={quartier ? quartier.actif : true} libelle="dans les choix" />
        <BoutonLigne modifie={suivi.modifie} enCours={enCours} etat={etat} libelle={quartier ? "Enregistrer" : "Ajouter"} creation={!quartier} />
      </div>
      <div className="geo-ligne-meta">
        {quartier ? <Demande attente={quartier.attente} /> : null}
        {quartier ? <LienPublic href={quartier.lienPublic} /> : null}
        <EtatLigne modifie={suivi.modifie} etat={etat} creation={!quartier} />
      </div>
      <ChampsPoint
        latitude={quartier?.latitude ?? null}
        longitude={quartier?.longitude ?? null}
        nomsAlternatifs={quartier?.nomsAlternatifs}
        contexte={quartier?.communeNom ?? communes.find((c) => c.id === communeId)?.nom ?? ""}
        onModifie={suivi.marquer}
      />
    </form>
  );
}
