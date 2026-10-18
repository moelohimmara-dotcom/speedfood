"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { prendreCommandeSalleAction } from "@/lib/table/actions";

export interface PlatSaisie {
  id: string;
  nom: string;
  prix: number;
  options: { id: string; nom: string; prix: number }[];
}

interface Props {
  plats: PlatSaisie[];
  tablesOuvertes: string[];
  /** Restaurant en mode comptoir : pas de numéro de table, la commande reçoit un numéro d'appel. */
  comptoir: boolean;
}

interface LigneChoisie {
  quantite: number;
  options: string[];
}

const gnf = (n: number) => `${n.toLocaleString("fr-FR")} GNF`;
const nouvelleCle = () => crypto.randomUUID();

/** Saisie rapide : table, plats avec quantités (et suppléments), prénom facultatif. Le serveur recalcule tous les prix. */
export function SaisieServeur({ plats, tablesOuvertes, comptoir }: Props) {
  const [table, setTable] = useState(comptoir ? "Comptoir" : "");
  const [nom, setNom] = useState("");
  const [filtre, setFiltre] = useState("");
  const [lignes, setLignes] = useState<Record<string, LigneChoisie>>({});
  const [cle, setCle] = useState(nouvelleCle);
  const [message, setMessage] = useState<{ ton: "succes" | "danger"; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const prixOptions = (p: PlatSaisie, choisies: string[]) => p.options.filter((o) => choisies.includes(o.id)).reduce((s, o) => s + o.prix, 0);
  const total = useMemo(
    () => plats.reduce((s, p) => (lignes[p.id] ? s + (p.prix + prixOptions(p, lignes[p.id].options)) * lignes[p.id].quantite : s), 0),
    [plats, lignes]
  );
  const articles = Object.values(lignes).reduce((s, l) => s + l.quantite, 0);
  const visibles = plats.filter((p) => p.nom.toLowerCase().includes(filtre.trim().toLowerCase()));

  function changer(id: string, delta: number) {
    setLignes((l) => {
      const actuelle = l[id] ?? { quantite: 0, options: [] };
      const quantite = Math.max(0, Math.min(20, actuelle.quantite + delta));
      const suivant = { ...l };
      if (quantite === 0) delete suivant[id];
      else suivant[id] = { ...actuelle, quantite };
      return suivant;
    });
  }

  function basculerOption(id: string, optionId: string) {
    setLignes((l) => {
      const actuelle = l[id];
      if (!actuelle) return l;
      const options = actuelle.options.includes(optionId) ? actuelle.options.filter((o) => o !== optionId) : [...actuelle.options, optionId];
      return { ...l, [id]: { ...actuelle, options } };
    });
  }

  function envoyer(sousTotalAffiche = total) {
    setMessage(null);
    if (!comptoir && table.trim() === "") {
      setMessage({ ton: "danger", texte: "Indiquez le numéro de la table." });
      return;
    }
    if (articles === 0) {
      setMessage({ ton: "danger", texte: "Choisissez au moins un plat." });
      return;
    }
    demarrer(async () => {
      const r = await prendreCommandeSalleAction({
        cleIdempotence: cle,
        table: table.trim(),
        nom,
        sousTotalAffiche,
        lignes: Object.entries(lignes).map(([menuItemId, l]) => ({ menuItemId, quantite: l.quantite, optionIds: l.options })),
      });
      if (r.ok) {
        setMessage({ ton: "succes", texte: `Commande ${r.reference} envoyée en cuisine.` });
        setLignes({});
        setNom("");
        setCle(nouvelleCle());
      } else {
        setMessage({ ton: "danger", texte: r.sousTotalServeur !== undefined ? `${r.erreur} Contrôlez la commande puis envoyez de nouveau.` : r.erreur });
      }
    });
  }

  return (
    <div className="saisie-contenu">
      <div className="saisie-entete">
        {comptoir ? (
          <p className="notation-aide">Mode comptoir : la commande reçoit un numéro d&apos;appel.</p>
        ) : (
          <label className="aide-choix-champ">
            Table
            <input list="saisie-tables" value={table} onChange={(e) => setTable(e.target.value)} maxLength={10} autoComplete="off" placeholder="Ex. 7" />
            <datalist id="saisie-tables">
              {tablesOuvertes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>
        )}
        <label className="aide-choix-champ">
          Prénom (facultatif)
          <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} autoComplete="off" />
        </label>
        <label className="aide-choix-champ">
          Chercher un plat
          <input type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)} autoComplete="off" />
        </label>
      </div>

      <ul className="saisie-plats">
        {visibles.map((p) => {
          const l = lignes[p.id];
          return (
            <li key={p.id} className={`saisie-plat ${l ? "saisie-plat-choisi" : ""}`}>
              <div className="saisie-plat-ligne">
                <span className="saisie-plat-nom">
                  {p.nom} <span className="notation-aide">{gnf(p.prix)}</span>
                </span>
                <span className="saisie-quantite">
                  <button type="button" className="btn btn-secondary" aria-label={`Retirer un ${p.nom}`} onClick={() => changer(p.id, -1)} disabled={!l}>
                    −
                  </button>
                  <strong aria-live="polite">{l?.quantite ?? 0}</strong>
                  <button type="button" className="btn btn-secondary" aria-label={`Ajouter un ${p.nom}`} onClick={() => changer(p.id, 1)}>
                    +
                  </button>
                </span>
              </div>
              {l && p.options.length > 0 ? (
                <div className="saisie-options">
                  {p.options.map((o) => (
                    <label key={o.id} className="aide-choix-case">
                      <input type="checkbox" checked={l.options.includes(o.id)} onChange={() => basculerOption(p.id, o.id)} />
                      {o.nom} (+{gnf(o.prix)})
                    </label>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="saisie-pied">
        {message ? <Alert ton={message.ton}>{message.texte}</Alert> : null}
        <p className="salle-total">
          {articles} article{articles > 1 ? "s" : ""} · {gnf(total)}
        </p>
        <div className="salle-actions">
          <button type="button" className="btn btn-primary" disabled={enCours || articles === 0} onClick={() => envoyer()}>
            {enCours ? "Envoi…" : "Envoyer en cuisine"}
          </button>
          <Link href="/restaurant/salle" className="btn btn-secondary">
            Voir la salle
          </Link>
        </div>
      </div>
    </div>
  );
}
