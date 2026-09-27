import { exigerPermissionPage } from "@/lib/system-admin/contexte";
import { masquerAdresse, masquerTelephone } from "@/lib/system-admin/coordonnees";
import { PlaceholderSection } from "../PlaceholderSection";

// Exemple fictif, uniquement pour montrer la règle de masquage appliquée par
// les helpers — aucune donnée réelle sur cette page, et surtout aucune donnée
// en clair : la valeur complète n'apparaît jamais par défaut, même en exemple.
const EXEMPLE_TELEPHONE = "+224 622 34 56 78";
const EXEMPLE_ADRESSE = "12 rue du Marché, Madina";

/**
 * Placeholder du bloc 8d (support commandes) : la permission est vérifiée dès
 * maintenant. Le masquage des coordonnées est déjà actif — affiché ici par les
 * vrais helpers pour en donner la preuve ; la révélation réelle passera par
 * `revelerCoordonneesCommande` (permission `coordonees.voir`, motif obligatoire
 * et trace d'audit).
 */
export default async function SupportCommandesSystemePage() {
  await exigerPermissionPage("commande.consulter");

  return (
    <PlaceholderSection
      titre="Support commandes"
      bloc="8d"
      permission="commande.consulter"
      description="Recherche par référence, statut, date et restaurant, historique des transitions, indicateurs d'activité, accès exceptionnel aux coordonnées avec permission, motif et audit."
    >
      <div
        style={{
          marginTop: "var(--space-4)",
          padding: "var(--space-3)",
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.85rem",
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 4 }}>
          Règle de masquage — exemple fictif (les écrans 8d afficheront ainsi par défaut)
        </p>
        <p style={{ color: "var(--secondaire)" }}>
          Téléphone : {masquerTelephone(EXEMPLE_TELEPHONE)} — Adresse : {masquerAdresse(EXEMPLE_ADRESSE)}
        </p>
        <p style={{ color: "var(--secondaire)" }}>
          Les valeurs complètes ne s&apos;affichent jamais par défaut : la révélation exige la
          permission coordonees.voir (support et super_admin), un motif, et laisse une trace
          dans le journal d&apos;audit.
        </p>
      </div>
    </PlaceholderSection>
  );
}
