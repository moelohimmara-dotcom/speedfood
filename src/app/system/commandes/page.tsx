import Link from "next/link";
import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { rechercherCommandesAdmin } from "@/lib/system-admin/commandes";
import { STATUTS_COMMANDE, type StatutCommande } from "@/lib/contracts/statuts";
import { Card, Badge } from "@/components/ui";

const LIBELLES_STATUT: Record<StatutCommande, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
  prete: "Prête",
  terminee: "Terminée",
  annulee: "Annulée",
};

interface Recherche {
  reference?: string;
  statut?: string;
  jour?: string;
}

export default async function SupportCommandesSystemePage({
  searchParams,
}: {
  searchParams: Promise<Recherche>;
}) {
  await exigerPermissionPage("commande.consulter");
  const { reference, statut: statutBrut, jour: jourBrut } = await searchParams;
  const statut: StatutCommande | "tous" = (STATUTS_COMMANDE as readonly string[]).includes(
    statutBrut ?? ""
  )
    ? (statutBrut as StatutCommande)
    : "tous";
  const jour = jourBrut === "1";

  const commandes = await rechercherCommandesAdmin({ reference, statut, jour });

  const parametresSansJour = new URLSearchParams();
  if (reference) parametresSansJour.set("reference", reference);
  if (statut !== "tous") parametresSansJour.set("statut", statut);
  const lienSansJour = parametresSansJour.toString();

  return (
    <div>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "var(--space-3)" }}>Support commandes</h1>
      <p style={{ color: "var(--secondaire)", marginBottom: "var(--space-4)", fontSize: "0.9rem" }}>
        Coordonnées masquées par défaut. La révélation exige un motif et laisse une trace d&apos;audit.
      </p>

      <form method="GET" style={{ marginBottom: "var(--space-4)" }}>
        {statut !== "tous" ? <input type="hidden" name="statut" value={statut} /> : null}
        {jour ? <input type="hidden" name="jour" value="1" /> : null}
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="reference">Référence</label>
          <input id="reference" name="reference" type="search" defaultValue={reference ?? ""} placeholder="SF-4KVB9" />
        </div>
      </form>

      {jour ? (
        <div className="alerte alerte-info" role="note" style={{ marginBottom: "var(--space-4)", fontSize: "0.85rem" }}>
          Filtre « du jour » : seules les commandes créées depuis minuit (UTC) sont affichées.{" "}
          <Link href={lienSansJour ? `/system/commandes?${lienSansJour}` : "/system/commandes"} style={{ fontWeight: 700 }}>
            Voir toutes les périodes
          </Link>
        </div>
      ) : null}

      <div className="chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "var(--space-5)" }}>
        {(["tous", ...STATUTS_COMMANDE] as const).map((valeur) => {
          const params = new URLSearchParams();
          if (reference) params.set("reference", reference);
          if (jour) params.set("jour", "1");
          if (valeur !== "tous") params.set("statut", valeur);
          const chaine = params.toString();
          return (
            <Link
              key={valeur}
              href={chaine ? `/system/commandes?${chaine}` : "/system/commandes"}
              className={`chip ${statut === valeur ? "actif" : ""}`}
            >
              {valeur === "tous" ? "Tous" : LIBELLES_STATUT[valeur]}
            </Link>
          );
        })}
      </div>

      {commandes.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--secondaire)" }}>Aucune commande ne correspond à cette recherche.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {commandes.map((c) => (
            <Link key={c.id} href={`/system/commandes/${c.id}`} style={{ textDecoration: "none" }}>
              <Card style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong style={{ color: "var(--encre)" }}>{c.reference}</strong>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
                    {c.restaurantNom} · {c.clientNom} · {c.telephoneAffiche}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Badge ton="neutre">{LIBELLES_STATUT[c.statut]}</Badge>
                  <p style={{ margin: 0, fontWeight: 700 }}>{c.sousTotal.toLocaleString("fr-FR")} GNF</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
