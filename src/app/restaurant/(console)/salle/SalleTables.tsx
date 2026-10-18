"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acquitterAppelAction, annulerTableAction, cloturerTableAction, validerTableAction } from "@/lib/table/actions";
import { LIBELLES_ETAT_TABLE, LIBELLES_REGLEMENT, MODES_REGLEMENT, ORDRE_ETAT_TABLE, compteDansAddition, etatTable, type ModeReglement } from "@/lib/table/regles";
import type { TableOuverte } from "@/lib/table/service";

const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;
const INTERVALLE_MS = 10_000;

/** Deux notes courtes : distinct du carillon des commandes, pour savoir qu'une table appelle. */
function bip() {
  try {
    const Constructeur = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructeur) return;
    const ctx = new Constructeur();
    const t = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.2 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.2 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.2);
      o.stop(t + i * 0.2 + 0.32);
    });
  } catch {
    // Son indisponible : le signal visuel reste.
  }
}

export function SalleTables({ tables }: { tables: TableOuverte[] }) {
  const routeur = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const [mode, setMode] = useState<Record<string, ModeReglement>>({});
  const precedent = useRef<number | null>(null);

  const vues = tables
    .map((t) => ({
      t,
      etat: etatTable({
        commandes: t.commandes,
        validee: t.session.valideeLe !== null,
        appelServeur: t.session.appelServeurLe !== null,
        additionDemandee: t.session.additionDemandeeLe !== null,
      }),
    }))
    .sort((a, b) => ORDRE_ETAT_TABLE[a.etat] - ORDRE_ETAT_TABLE[b.etat] || a.t.session.tableNumero.localeCompare(b.t.session.tableNumero, "fr", { numeric: true }));
  const attention = vues.filter((v) => v.etat !== "en_cours").length;

  // Rafraîchissement régulier de la salle et signal sonore quand une table demande quelque chose de plus qu'avant.
  useEffect(() => {
    const id = window.setInterval(() => routeur.refresh(), INTERVALLE_MS);
    return () => window.clearInterval(id);
  }, [routeur]);
  useEffect(() => {
    if (precedent.current !== null && attention > precedent.current) bip();
    precedent.current = attention;
  }, [attention]);

  function agir(f: () => Promise<{ ok: true } | { ok: false; erreur: string }>) {
    setErreur(null);
    demarrer(async () => {
      const r = await f();
      if (r.ok) routeur.refresh();
      else setErreur(r.erreur);
    });
  }

  return (
    <>
      {erreur ? <p className="notation-erreur" role="alert">{erreur}</p> : null}
      <div className="salle-grille">
        {vues.map(({ t, etat }) => {
          const choisi = mode[t.session.id];
          const compte = t.commandes.filter((c) => compteDansAddition(c.statut));
          return (
            <section key={t.session.id} className={`salle-table ${etat !== "en_cours" ? "salle-table-alerte" : ""}`} aria-label={`Table ${t.session.tableNumero}`}>
              <div className="salle-table-tete">
                <h2 className="salle-table-nom">Table {t.session.tableNumero}</h2>
                <span className={`salle-etat ${etat !== "en_cours" ? "salle-etat-alerte" : ""}`}>{LIBELLES_ETAT_TABLE[etat]}</span>
              </div>
              <ul className="salle-lignes">
                {compte.map((c) => (
                  <li key={c.id}>
                    <strong>{c.client}</strong> ({c.statut === "en_attente" ? "à valider" : c.statut === "terminee" ? "servie" : c.statut === "prete" ? "prête" : "en préparation"}) : {c.lignes.map((l) => `${l.quantite} × ${l.nom}`).join(", ")}
                  </li>
                ))}
              </ul>
              <p className="salle-total">Addition : {gnf(t.total)}</p>
              <div className="salle-actions">
                {t.commandes.some((c) => c.statut === "en_attente") ? (
                  <button type="button" className="btn btn-primary" disabled={enCours} onClick={() => agir(() => validerTableAction(t.session.id))}>
                    Valider et envoyer en cuisine
                  </button>
                ) : null}
                {t.session.appelServeurLe ? (
                  <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => agir(() => acquitterAppelAction(t.session.id))}>
                    J&apos;y vais
                  </button>
                ) : null}
              </div>
              <div className="salle-reglement" role="group" aria-label={`Règlement de la table ${t.session.tableNumero}`}>
                <select
                  aria-label="Mode de règlement"
                  value={choisi ?? ""}
                  onChange={(e) => setMode((m) => ({ ...m, [t.session.id]: e.target.value as ModeReglement }))}
                >
                  <option value="">Mode de règlement…</option>
                  {MODES_REGLEMENT.map((m) => (
                    <option key={m} value={m}>
                      {LIBELLES_REGLEMENT[m]}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn btn-primary" disabled={enCours || !choisi} onClick={() => choisi && agir(() => cloturerTableAction(t.session.id, choisi))}>
                  Table réglée
                </button>
                {compte.every((c) => c.statut === "en_attente") ? (
                  <button type="button" className="btn btn-secondary" disabled={enCours} onClick={() => agir(() => annulerTableAction(t.session.id))}>
                    Annuler la table
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
