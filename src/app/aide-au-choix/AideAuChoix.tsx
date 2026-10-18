"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { aideAuChoixAction, oublierQuartierRetenuAction } from "@/lib/decouverte/aide-choix-actions";
import type { PropositionRestaurant, ResultatAideChoix } from "@/lib/decouverte/aide-choix-service";
import { BUDGET_MAX_GNF, BUDGET_MIN_GNF, LIBELLES_GAMME, LIBELLES_GROUPE_CHOIX, type GroupeChoix } from "@/lib/decouverte/aide-choix";

export interface OptionZone {
  id: string;
  libelle: string;
}

interface Props {
  quartiers: OptionZone[];
  communes: OptionZone[];
  cuisines: OptionZone[];
  connecte: boolean;
  quartierRetenu: string | null;
  rayonKm: number;
}

const BUDGETS_RAPIDES = [15_000, 30_000, 50_000, 100_000, 200_000];
const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

type Mode = "gps" | "quartier" | "commune";

/** Assistant de choix : budget (curseur, montants rapides, saisie), position (GPS, quartier ou commune), cuisine facultative. */
export function AideAuChoix({ quartiers, communes, cuisines, connecte, quartierRetenu, rayonKm }: Props) {
  const [budget, setBudget] = useState(30_000);
  const [mode, setMode] = useState<Mode>(quartierRetenu ? "quartier" : quartiers.length > 0 ? "quartier" : "commune");
  const [quartierId, setQuartierId] = useState(quartierRetenu ?? "");
  const [communeId, setCommuneId] = useState("");
  const [cuisineId, setCuisineId] = useState("");
  const [retenir, setRetenir] = useState(false);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [etatGps, setEtatGps] = useState<"repos" | "recherche" | "ok" | "refuse">("repos");
  const [retenuActif, setRetenuActif] = useState(quartierRetenu);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatAideChoix | null>(null);
  const [enCours, demarrer] = useTransition();

  function localiser() {
    if (!("geolocation" in navigator)) {
      setEtatGps("refuse");
      return;
    }
    setEtatGps("recherche");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setEtatGps("ok");
      },
      () => setEtatGps("refuse"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  const positionPrete = mode === "gps" ? gps !== null : mode === "quartier" ? quartierId !== "" : communeId !== "";

  function chercher() {
    setErreur(null);
    const position = mode === "gps" && gps ? ({ type: "gps", ...gps } as const) : mode === "quartier" ? ({ type: "quartier", id: quartierId } as const) : ({ type: "commune", id: communeId } as const);
    demarrer(async () => {
      const r = await aideAuChoixAction({ budgetGnf: budget, position, categorieId: cuisineId || undefined, retenirQuartier: retenir && mode === "quartier" });
      if (r.ok) {
        setResultat(r.resultat);
        if (retenir && mode === "quartier") setRetenuActif(quartierId);
      } else {
        setErreur(r.erreur);
        setResultat(null);
      }
    });
  }

  const groupes: GroupeChoix[] = ["dans_budget", "un_peu_au_dessus"];

  return (
    <div className="aide-choix">
      <form
        className="aide-choix-formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (positionPrete) chercher();
        }}
      >
        <fieldset className="aide-choix-bloc">
          <legend>1. Votre budget par personne</legend>
          <p className="aide-choix-budget" aria-live="polite">
            {gnf(budget)}
          </p>
          <input
            type="range"
            aria-label="Budget par personne en francs guinéens"
            min={BUDGET_MIN_GNF}
            max={300_000}
            step={5_000}
            value={Math.min(budget, 300_000)}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
          <div className="aide-choix-puces">
            {BUDGETS_RAPIDES.map((b) => (
              <button key={b} type="button" aria-pressed={budget === b} className={`chip ${budget === b ? "actif" : ""}`} onClick={() => setBudget(b)}>
                {gnf(b)}
              </button>
            ))}
          </div>
          <label className="aide-choix-champ">
            Ou saisissez un montant (GNF)
            <input
              inputMode="numeric"
              value={budget}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setBudget(Math.min(n, BUDGET_MAX_GNF));
              }}
            />
          </label>
        </fieldset>

        <fieldset className="aide-choix-bloc">
          <legend>2. Où êtes-vous ?</legend>
          <div className="aide-choix-puces" role="radiogroup" aria-label="Façon d'indiquer votre position">
            <button type="button" role="radio" aria-checked={mode === "gps"} className={`chip ${mode === "gps" ? "actif" : ""}`} onClick={() => setMode("gps")}>
              Ma position
            </button>
            {quartiers.length > 0 ? (
              <button type="button" role="radio" aria-checked={mode === "quartier"} className={`chip ${mode === "quartier" ? "actif" : ""}`} onClick={() => setMode("quartier")}>
                Mon quartier
              </button>
            ) : null}
            {communes.length > 0 ? (
              <button type="button" role="radio" aria-checked={mode === "commune"} className={`chip ${mode === "commune" ? "actif" : ""}`} onClick={() => setMode("commune")}>
                Ma commune
              </button>
            ) : null}
          </div>

          {mode === "gps" ? (
            <div className="aide-choix-gps">
              <button type="button" className="btn btn-secondary" onClick={localiser} disabled={etatGps === "recherche"}>
                {etatGps === "recherche" ? "Recherche de votre position…" : etatGps === "ok" ? "Position trouvée (relancer)" : "Utiliser ma position"}
              </button>
              <p className="aide-choix-aide">Votre position sert à ce calcul uniquement : elle n&apos;est ni enregistrée ni conservée.</p>
              {etatGps === "refuse" ? <Alert ton="info">La position n&apos;a pas pu être obtenue. Choisissez votre quartier ou votre commune.</Alert> : null}
            </div>
          ) : mode === "quartier" ? (
            <label className="aide-choix-champ">
              Quartier
              <select value={quartierId} onChange={(e) => setQuartierId(e.target.value)}>
                <option value="">Choisir…</option>
                {quartiers.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.libelle}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="aide-choix-champ">
              Commune
              <select value={communeId} onChange={(e) => setCommuneId(e.target.value)}>
                <option value="">Choisir…</option>
                {communes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === "quartier" && connecte ? (
            <label className="aide-choix-case">
              <input type="checkbox" checked={retenir} onChange={(e) => setRetenir(e.target.checked)} />
              Retenir ce quartier sur mon compte pour la prochaine fois
            </label>
          ) : null}
          {connecte && retenuActif ? (
            <p className="aide-choix-aide">
              Un quartier est retenu sur votre compte.{" "}
              <button
                type="button"
                className="aide-choix-lien"
                onClick={async () => {
                  const r = await oublierQuartierRetenuAction();
                  if (r.ok) {
                    setRetenuActif(null);
                    setQuartierId("");
                  }
                }}
              >
                L&apos;oublier
              </button>
            </p>
          ) : null}
        </fieldset>

        {cuisines.length > 0 ? (
          <fieldset className="aide-choix-bloc">
            <legend>3. Une envie ? (facultatif)</legend>
            <label className="aide-choix-champ">
              Type de cuisine
              <select value={cuisineId} onChange={(e) => setCuisineId(e.target.value)}>
                <option value="">Peu importe</option>
                {cuisines.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        ) : null}

        <button type="submit" className="btn btn-primary aide-choix-envoi" disabled={enCours || !positionPrete || budget < BUDGET_MIN_GNF}>
          {enCours ? "Recherche…" : "Proposez-moi des restaurants"}
        </button>
        {!positionPrete ? <p className="aide-choix-aide">Indiquez votre position pour lancer la recherche (rayon : {rayonKm.toLocaleString("fr-FR")} km).</p> : null}
        {budget < BUDGET_MIN_GNF ? <p className="aide-choix-aide">Le budget minimum est de {gnf(BUDGET_MIN_GNF)}.</p> : null}
      </form>

      {erreur ? <Alert ton="danger">{erreur}</Alert> : null}

      {resultat ? (
        <section className="aide-choix-resultats" aria-live="polite" aria-label="Propositions">
          {resultat.propositions.length === 0 ? (
            <div className="aide-choix-vide" role="status">
              <h2>Aucune proposition pour ce budget ici</h2>
              <p>
                {resultat.diagnostic.restaurantsPublies === 0
                  ? "Aucun restaurant n'est publié pour le moment."
                  : resultat.diagnostic.ouvertsAuxCommandes === 0
                    ? "Aucun restaurant n'accepte de commandes en ce moment."
                    : resultat.diagnostic.dansLaZone === 0
                      ? `Aucun restaurant ouvert dans un rayon de ${resultat.rayonKm.toLocaleString("fr-FR")} km ou dans cette zone.`
                      : resultat.diagnostic.avecPrix === 0
                        ? "Les restaurants ouverts de cette zone n'ont pas encore de plat disponible avec un prix."
                        : "Les restaurants ouverts de cette zone dépassent ce budget. Essayez avec un budget un peu plus élevé."}
              </p>
              <p>
                <Link href="/restaurants" className="lien-texte">
                  Voir tous les restaurants
                </Link>
              </p>
            </div>
          ) : (
            groupes.map((g) => {
              const liste = resultat.propositions.filter((p) => p.groupe === g);
              if (liste.length === 0) return null;
              return (
                <div key={g} className="aide-choix-groupe">
                  <h2 className="aide-choix-groupe-titre">{LIBELLES_GROUPE_CHOIX[g]}</h2>
                  <p className="aide-choix-aide">Du moins cher au plus huppé.</p>
                  <ul className="aide-choix-liste">
                    {liste.map((p) => (
                      <CartePropositionAide key={p.id} p={p} />
                    ))}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      ) : null}
    </div>
  );
}

function CartePropositionAide({ p }: { p: PropositionRestaurant }) {
  return (
    <li className="aide-choix-carte">
      <div className="aide-choix-carte-tete">
        <h3 className="aide-choix-carte-nom">{p.nom}</h3>
        {p.gamme ? <span className="aide-choix-gamme">{LIBELLES_GAMME[p.gamme]}</span> : null}
      </div>
      <p className="aide-choix-aide">
        {[p.categorie, p.quartier || p.communeNom].filter(Boolean).join(" · ")} · prix typique {gnf(p.prixTypique)}
      </p>
      <ul className="aide-choix-raisons">
        {p.raisons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Link href={`/restaurants/${p.id}`} className="btn btn-primary">
        Voir le menu
      </Link>
    </li>
  );
}
