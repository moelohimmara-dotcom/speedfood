"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Recherches récentes (page Restaurants) : les 5 dernières recherches faites sur CET appareil, gardées dans le navigateur seulement
 * (jamais envoyées, jamais liées à une personne). Elles s'affichent sous la recherche pour rechercher de nouveau en un geste.
 * Une recherche est mémorisée quand la page s'ouvre avec `?q=…` ; « Effacer » vide la liste.
 */
const CLE = "speedfood.recherches.recentes";
const EVENEMENT = "speedfood-recherches";
const MAX = 5;

function lire(): string[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(liste) ? liste.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function instantane(): string {
  return JSON.stringify(lire());
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

export function RecherchesRecentes({ courante }: { courante: string }) {
  useEffect(() => {
    const q = courante.trim();
    if (q.length < 2 || q.length > 60) return;
    try {
      const suite = [q, ...lire().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX);
      localStorage.setItem(CLE, JSON.stringify(suite));
      window.dispatchEvent(new Event(EVENEMENT));
    } catch {
      // Stockage indisponible : la fonction est simplement absente.
    }
  }, [courante]);

  const liste = JSON.parse(useSyncExternalStore(abonner, instantane, () => "[]")) as string[];
  const autres = liste.filter((x) => x.toLowerCase() !== courante.trim().toLowerCase());
  if (autres.length === 0) return null;
  return (
    <p className="recherches-recentes">
      <span className="recherches-recentes-titre">Récemment :</span>
      {autres.map((q) => (
        <Link key={q} href={`/restaurants?q=${encodeURIComponent(q)}`} className="chip chip-recent">
          {q}
        </Link>
      ))}
      <button
        type="button"
        className="recherches-recentes-effacer"
        onClick={() => {
          try {
            localStorage.removeItem(CLE);
            window.dispatchEvent(new Event(EVENEMENT));
          } catch {
            // Rien à faire.
          }
        }}
      >
        Effacer
      </button>
    </p>
  );
}
