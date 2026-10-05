"use client";

import { useEffect } from "react";
import { lireNumeroTable } from "@/lib/commande/mode";
import { memoriserTable, oublierTable, useTableMemorisee } from "@/lib/commande/table-memoire";

/**
 * Sur la fiche d'un restaurant : si la page a été ouverte depuis le QR d'une table (`?table=7`), retient le numéro et l'affiche. Le client peut
 * le retirer. Rien n'est envoyé au serveur ici ; la commande « à table » est vérifiée au moment de commander.
 */
export function MemoireTable({ restaurantId, accepteSurPlace }: { restaurantId: string; accepteSurPlace: boolean }) {
  const table = useTableMemorisee(restaurantId);

  useEffect(() => {
    const dansLien = lireNumeroTable(new URLSearchParams(window.location.search).get("table"));
    if (dansLien) {
      memoriserTable(restaurantId, dansLien);
    }
  }, [restaurantId]);

  if (!table) return null;
  return (
    <p className="fiche-table" role="status">
      <span>
        {accepteSurPlace ? <>Vous êtes à la <strong>table {table}</strong> : choisissez vos plats, la commande arrivera à votre table.</> : <>Table {table} : ce restaurant ne prend pas encore les commandes à table, choisissez le retrait ou la livraison.</>}
      </span>
      <button
        type="button"
        className="lien-texte"
        onClick={oublierTable}
      >
        Ce n&apos;est pas ma table
      </button>
    </p>
  );
}
