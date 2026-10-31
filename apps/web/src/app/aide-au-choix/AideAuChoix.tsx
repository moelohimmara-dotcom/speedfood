"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { aideAuChoixAction, oublierQuartierRetenuAction } from "@/lib/decouverte/aide-choix-actions";
import type { PropositionRestaurant, ResultatAideChoix } from "@/lib/decouverte/aide-choix-service";
import { zoneLaPlusProche, type ZoneAvecPoint } from "@/lib/decouverte/zone-proche";
import { BUDGET_MAX_GNF, BUDGET_MIN_GNF, LIBELLES_GAMME, LIBELLES_GROUPE_CHOIX, type GroupeChoix } from "@/lib/decouverte/aide-choix";

export type OptionZone = ZoneAvecPoint;

interface Props {
  quartiers: OptionZone[];
  communes: OptionZone[];
  cuisines: OptionZone[];
  connecte: boolean;
  quartierRetenu: string | null;
  rayonKm: number;
  /** Recherche rouverte depuis un lien partagé (valeurs déjà vérifiées par le serveur). */
  initial: { budget: number | null; quartierId: string | null; communeId: string | null; cuisineId: string | null };
}

const BUDGETS_RAPIDES = [15_000, 30_000, 50_000, 100_000, 200_000];
const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;

type Mode = "gps" | "quartier" | "commune";

/** Assistant de choix : budget (curseur, montants rapides, saisie), position (GPS, quartier ou commune), cuisine facultative. */
export function AideAuChoix({ quartiers, communes, cuisines, connecte, quartierRetenu, rayonKm, initial }: Props) {
  const depuisLien = initial.quartierId !== null || initial.communeId !== null;
  const [budget, setBudget] = useState(initial.budget ?? 30_000);
  const [mode, setMode] = useState<Mode>(initial.communeId && !initial.quartierId ? "commune" : quartierRetenu || initial.quartierId ? "quartier" : quartiers.length > 0 ? "quartier" : "commune");
  const [quartierId, setQuartierId] = useState(initial.quartierId ?? quartierRetenu ?? "");
  const [communeId, setCommuneId] = useState(initial.communeId ?? "");
  const [cuisineId, setCuisineId] = useState(initial.cuisineId ?? "");
  const [retenir, setRetenir] = useState(false);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [etatGps, setEtatGps] = useState<"repos" | "recherche" | "ok" | "refuse">("repos");
  const [retenuActif, setRetenuActif] = useState(quartierRetenu);
  const [lieuTrouve, setLieuTrouve] = useState<{ libelle: string; km: number } | "inconnu" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatAideChoix | null>(null);
  const [resultatPour, setResultatPour] = useState("");
  const [saisie, setSaisie] = useState((initial.budget ?? 30_000).toLocaleString("fr-FR"));
  const [lienCopie, setLienCopie] = useState(false);
  const lancee = useRef(false);
  const [enCours, demarrer] = useTransition();
  const zoneRef = useRef<HTMLElement>(null);

  // Les critères du moment : un résultat affiché pour d'autres critères est signalé comme périmé.
  const cle = JSON.stringify([budget, mode, mode === "gps" ? gps : mode === "quartier" ? quartierId : communeId, cuisineId]);
  const perime = resultat !== null && resultatPour !== cle;

  function fixerBudget(n: number) {
    setBudget(n);
    setSaisie(n > 0 ? n.toLocaleString("fr-FR") : "");
  }

  function localiser() {
    if (!("geolocation" in navigator)) {
      setEtatGps("refuse");
      return;
    }
    setEtatGps("recherche");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setGps(point);
        setEtatGps("ok");
        // On dit au visiteur où il se trouve et on remplit le champ « quartier » : il peut le corriger ou passer en « Mon quartier ».
        const proche = zoneLaPlusProche(point, quartiers, 5);
        if (proche) {
          setQuartierId(proche.zone.id);
          setLieuTrouve({ libelle: `${proche.zone.libelle}, ${proche.zone.groupe ?? ""}`.replace(/, $/, ""), km: proche.km });
        } else {
          setLieuTrouve("inconnu");
        }
      },
      () => setEtatGps("refuse"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  const positionPrete = mode === "gps" ? gps !== null : mode === "quartier" ? quartierId !== "" : communeId !== "";

  function chercher(rayonKm?: number) {
    setErreur(null);
    const position = mode === "gps" && gps ? ({ type: "gps", ...gps } as const) : mode === "quartier" ? ({ type: "quartier", id: quartierId } as const) : ({ type: "commune", id: communeId } as const);
    demarrer(async () => {
      const r = await aideAuChoixAction({ budgetGnf: budget, position, categorieId: cuisineId || undefined, rayonKm, retenirQuartier: retenir && mode === "quartier" });
      if (r.ok) {
        setResultat(r.resultat);
        setResultatPour(cle);
        if (retenir && mode === "quartier") setRetenuActif(quartierId);
      } else {
        setErreur(r.erreur);
        setResultat(null);
      }
    });
  }

  /** Lien partageable : budget, zone choisie (quartier ou commune) et cuisine ; jamais la position GPS. */
  function lienPartage(): string | null {
    if (mode === "gps") return null;
    const zone = mode === "quartier" ? quartierId : communeId;
    if (!zone) return null;
    const u = new URL("/aide-au-choix", window.location.origin);
    u.searchParams.set("b", String(budget));
    u.searchParams.set(mode === "quartier" ? "q" : "c", zone);
    if (cuisineId) u.searchParams.set("k", cuisineId);
    return u.toString();
  }

  async function copierLien() {
    const lien = lienPartage();
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setLienCopie(true);
      window.setTimeout(() => setLienCopie(false), 3000);
    } catch {
      window.prompt("Copiez ce lien :", lien);
    }
  }

  // Un lien partagé rouvre la recherche tout de suite (une seule fois).
  useEffect(() => {
    if (depuisLien && !lancee.current) {
      lancee.current = true;
      chercher();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lancement unique à l'ouverture
  }, []);

  // Amène les résultats à l'écran (et au lecteur d'écran) quand une recherche vient d'aboutir.
  useEffect(() => {
    if (resultat && !perime) zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resultat, perime]);

  const groupes: GroupeChoix[] = ["dans_budget", "un_peu_au_dessus"];
  const libelleZone = mode === "gps" ? "votre position" : (mode === "quartier" ? quartiers : communes).find((z) => z.id === (mode === "quartier" ? quartierId : communeId))?.libelle ?? "";
  const libelleCuisine = cuisines.find((c) => c.id === cuisineId)?.libelle;

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
            aria-valuetext={gnf(budget)}
            onChange={(e) => fixerBudget(Number(e.target.value))}
          />
          <div className="aide-choix-puces">
            {BUDGETS_RAPIDES.map((b) => (
              <button key={b} type="button" aria-pressed={budget === b} className={`chip ${budget === b ? "actif" : ""}`} onClick={() => fixerBudget(b)}>
                {gnf(b)}
              </button>
            ))}
          </div>
          <label className="aide-choix-champ">
            Ou saisissez un montant (GNF)
            <input
              inputMode="numeric"
              value={saisie}
              onChange={(e) => {
                const chiffres = e.target.value.replace(/\D/g, "");
                const n = Math.min(Number(chiffres || 0), BUDGET_MAX_GNF);
                setBudget(n);
                setSaisie(chiffres === "" ? "" : n.toLocaleString("fr-FR"));
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
              {etatGps === "ok" && lieuTrouve && lieuTrouve !== "inconnu" ? (
                lieuTrouve.km < 1 ? (
                  <p className="aide-choix-lieu" role="status">
                    Vous êtes près de <strong>{lieuTrouve.libelle}</strong>. Ce quartier est pré-rempli dans « Mon quartier » : changez-le si besoin.
                  </p>
                ) : (
                  <p className="aide-choix-lieu" role="status">
                    Le quartier repéré le plus proche est <strong>{lieuTrouve.libelle}</strong>, à environ {lieuTrouve.km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km. Ce n&apos;est peut-être pas le vôtre (tous les quartiers n&apos;ont pas encore de repère GPS) : choisissez le vôtre dans « Mon quartier ».
                  </p>
                )
              ) : null}
              {etatGps === "ok" && lieuTrouve === "inconnu" ? (
                <p className="aide-choix-lieu" role="status">
                  Position trouvée, mais aucun quartier connu à moins de 5 km : la recherche utilise votre position exacte.
                </p>
              ) : null}
              {etatGps === "refuse" ? <Alert ton="info">La position n&apos;a pas pu être obtenue. Choisissez votre quartier ou votre commune.</Alert> : null}
            </div>
          ) : mode === "quartier" ? (
            <label className="aide-choix-champ">
              Quartier
              <select value={quartierId} onChange={(e) => setQuartierId(e.target.value)}>
                <option value="">Choisir…</option>
                {[...new Set(quartiers.map((q) => q.groupe ?? ""))].map((groupe) => (
                  <optgroup key={groupe} label={groupe || "Autres"}>
                    {quartiers
                      .filter((q) => (q.groupe ?? "") === groupe)
                      .map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.libelle}
                        </option>
                      ))}
                  </optgroup>
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

      {enCours ? (
        <p className="aide-choix-chargement" role="status">
          Recherche des restaurants…
        </p>
      ) : null}

      {resultat && !enCours ? (
        <section ref={zoneRef} className={`aide-choix-resultats${perime ? " aide-choix-perime" : ""}`} aria-live="polite" aria-label="Propositions">
          {perime ? (
            <p className="aide-choix-aide" role="status">
              Vos critères ont changé : relancez la recherche pour mettre ces propositions à jour.
            </p>
          ) : (
            <p className="aide-choix-recap">
              Pour {gnf(budget)}
              {libelleZone ? ` · ${libelleZone}` : ""}
              {libelleCuisine ? ` · ${libelleCuisine}` : ""}
              {resultat.rayonKm !== rayonKm ? ` · rayon ${resultat.rayonKm.toLocaleString("fr-FR")} km` : ""}
            </p>
          )}
          {!perime && lienPartage() ? (
            <div className="aide-choix-partage">
              <button type="button" className="btn btn-secondary" onClick={copierLien}>
                {lienCopie ? "Lien copié" : "Copier le lien de cette recherche"}
              </button>
              <a
                className="btn btn-secondary"
                href={`https://wa.me/?text=${encodeURIComponent(`Restaurants pour ${gnf(budget)} par personne : ${lienPartage()}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Partager sur WhatsApp
              </a>
            </div>
          ) : null}
          {resultat.propositions.length === 0 ? (
            <div className="aide-choix-vide" role="status">
              <h2>Aucune proposition pour ce budget ici</h2>
              <p>
                {resultat.diagnostic.restaurantsPublies === 0
                  ? resultat.diagnostic.cuisineFiltree
                    ? "Aucun restaurant de cette cuisine n'est publié pour le moment. Essayez « Peu importe »."
                    : "Aucun restaurant n'est publié pour le moment."
                  : resultat.diagnostic.ouvertsAuxCommandes === 0
                    ? "Aucun restaurant n'accepte de commandes en ce moment."
                    : resultat.diagnostic.dansLaZone === 0
                      ? `Aucun restaurant ouvert dans un rayon de ${resultat.rayonKm.toLocaleString("fr-FR")} km ou dans cette zone.`
                      : resultat.diagnostic.avecPrix === 0
                        ? "Les restaurants ouverts de cette zone n'ont pas encore de plat disponible avec un prix."
                        : "Les restaurants ouverts de cette zone dépassent ce budget. Essayez avec un budget un peu plus élevé."}
              </p>
              {resultat.elargissement ? (
                <div className="aide-choix-elargir">
                  <p>
                    Le restaurant le plus proche pour ce budget est <strong>{resultat.elargissement.nom}</strong>, à {resultat.elargissement.approchee ? "environ " : ""}
                    {resultat.elargissement.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km (votre rayon actuel : {resultat.rayonKm.toLocaleString("fr-FR")} km).
                  </p>
                  <button type="button" className="btn btn-primary" disabled={enCours} onClick={() => chercher(Math.min(50, Math.ceil(resultat.elargissement!.distanceKm)))}>
                    Élargir la recherche à {Math.min(50, Math.ceil(resultat.elargissement.distanceKm)).toLocaleString("fr-FR")} km
                  </button>
                </div>
              ) : null}
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
      {p.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
        <img src={p.photoUrl} alt="" className="aide-choix-photo" loading="lazy" />
      ) : null}
      <div className="aide-choix-carte-corps">
        <div className="aide-choix-carte-tete">
          <h3 className="aide-choix-carte-nom">{p.nom}</h3>
          {p.gamme ? <span className="aide-choix-gamme">{LIBELLES_GAMME[p.gamme]}</span> : null}
          <span className="aide-choix-ouvert">Ouvert</span>
        </div>
        <p className="aide-choix-aide">
          {[p.categorie, p.quartier || p.communeNom].filter(Boolean).join(" · ")} · prix typique {gnf(p.prixTypique)}
        </p>
        {p.note !== null ? (
          <p className="aide-choix-note">
            <span aria-hidden="true">★</span> {p.note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 5 · {p.avisTotal} avis
          </p>
        ) : null}
        {p.horaires ? <p className="aide-choix-horaires">Horaires : {p.horaires}</p> : null}
        <ul className="aide-choix-raisons">
          {p.raisons
            .filter((r) => !r.startsWith("Noté"))
            .map((r) => (
              <li key={r}>{r}</li>
            ))}
        </ul>
        <Link href={`/restaurants/${p.id}`} className="btn btn-primary">
          Voir le menu et commander
        </Link>
      </div>
    </li>
  );
}
