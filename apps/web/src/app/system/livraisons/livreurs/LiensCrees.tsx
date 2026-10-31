"use client";

import { useNotification } from "@/components/console/ConsoleProviders";
import type { LienAffiche } from "@/lib/system-admin/livreurs";

async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

function formaterExpiration(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** CSV des liens (nom, téléphone, lien) à télécharger : l'unique moment où les liens sont montrés en clair. */
function telechargerCsv(liens: LienAffiche[]) {
  const echapper = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lignes = ["nom;telephone;lien;valable_jusqu_au", ...liens.map((l) => [l.nom, l.telephone, l.lien, l.expireLe.slice(0, 10)].map(echapper).join(";"))];
  const blob = new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "liens-activation-livreurs.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Liens d'activation à envoyer par WhatsApp. Ils ne sont montrés qu'ici, une fois : seule leur empreinte est conservée. Chaque ligne a
 * « Envoyer par WhatsApp » (ouvre WhatsApp avec le message prêt, l'envoi reste à faire à la main), « Copier le lien » et « Copier le message ».
 */
export function LiensCrees({ liens }: { liens: LienAffiche[] }) {
  const notifier = useNotification();
  async function copierEtDire(texte: string, message: string) {
    const reussi = await copier(texte);
    notifier(reussi ? "succes" : "erreur", reussi ? message : "Copie impossible : sélectionnez le texte à la main.");
  }
  if (liens.length === 0) return null;
  return (
    <section className="livreurs-liens" aria-label="Liens d'activation">
      <p className="livreurs-liens-avertissement">
        Notez ou envoyez ces liens maintenant : ils ne seront plus affichés. Chacun ne sert qu&apos;une fois.
      </p>
      <ul>
        {liens.map((l) => (
          <li key={l.livreurId}>
            <div>
              <strong>{l.nom}</strong>
              <span className="ad-secondaire"> · {l.telephone} · valable jusqu&apos;au {formaterExpiration(l.expireLe)}</span>
            </div>
            <div className="livreurs-liens-actions">
              <a className="btn btn-primary" href={l.lienWhatsApp} target="_blank" rel="noopener noreferrer">
                Envoyer par WhatsApp
                <span className="sr-only"> à {l.nom} (ouvre WhatsApp dans un nouvel onglet)</span>
              </a>
              <button type="button" className="btn btn-secondary" onClick={() => void copierEtDire(l.lien, "Lien copié.")}>
                Copier le lien
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void copierEtDire(l.message, "Message copié.")}>
                Copier le message
              </button>
            </div>
          </li>
        ))}
      </ul>
      {liens.length > 1 ? (
        <button type="button" className="btn btn-secondary" onClick={() => telechargerCsv(liens)}>
          Télécharger les {liens.length} liens (CSV)
        </button>
      ) : null}
    </section>
  );
}
