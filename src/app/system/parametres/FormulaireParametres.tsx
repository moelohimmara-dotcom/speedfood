"use client";

import { useActionState } from "react";
import {
  modifierParametresAction,
  type EtatActionParametres,
  type ParametresAffiches,
} from "@/lib/system-admin/parametres";
import { Button, Alert } from "@/components/ui";

const etatInitial: EtatActionParametres = {};

export function FormulaireParametres({ parametres }: { parametres: ParametresAffiches }) {
  const [etat, action, enCours] = useActionState(modifierParametresAction, etatInitial);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="commande_proposition_delai_minutes">
          Délai de réponse à une proposition client (minutes)
        </label>
        <input
          id="commande_proposition_delai_minutes"
          name="commande_proposition_delai_minutes"
          type="number"
          min={1}
          max={1440}
          required
          defaultValue={parametres.commandePropositionDelaiMinutes}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="prix_plat_max_gnf">Plafond de prix d&apos;un plat (GNF)</label>
        <input
          id="prix_plat_max_gnf"
          name="prix_plat_max_gnf"
          type="number"
          min={0}
          max={10_000_000}
          step={1}
          required
          defaultValue={parametres.prixPlatMaxGnf}
        />
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="disponibilite_fraicheur_heures">
          Durée de fraîcheur d&apos;une disponibilité (heures)
        </label>
        <input
          id="disponibilite_fraicheur_heures"
          name="disponibilite_fraicheur_heures"
          type="number"
          min={1}
          max={72}
          step={1}
          required
          defaultValue={parametres.disponibiliteFraicheurHeures}
        />
        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
          Passé ce délai sans reconfirmation par le restaurant, un plat disponible s&apos;affiche
          « à confirmer ».
        </p>
      </div>
      <fieldset
        style={{
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Conservation des données personnelles</legend>
        <Alert ton="info">
          Passé ces délais, le nom, le téléphone et l&apos;adresse des clients sont <strong>effacés définitivement</strong>{" "}
          (le nom devient « Client »). Les montants et les plats restent. L&apos;anonymisation tourne chaque nuit vers
          3 h 15 (UTC) et <strong>ne peut pas être annulée</strong> : raccourcir un délai efface dès la nuit suivante des
          coordonnées qui étaient encore conservées. Allonger un délai n&apos;a d&apos;effet que pour l&apos;avenir. Les
          durées doivent rester cohérentes avec la page de confidentialité publiée.
        </Alert>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="conservation_coordonnees_jours">
            Coordonnées d&apos;une commande terminée, refusée ou annulée : jours conservés (7 à 3650)
          </label>
          <input
            id="conservation_coordonnees_jours"
            name="conservation_coordonnees_jours"
            type="number"
            min={7}
            max={3650}
            step={1}
            required
            defaultValue={parametres.conservationCoordonneesJours}
          />
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            Valeur retenue le 3 octobre 2026 : 90 jours après la clôture.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="conservation_non_cloturee_jours">
            Commande jamais clôturée : jours après sa création (7 à 3650)
          </label>
          <input
            id="conservation_non_cloturee_jours"
            name="conservation_non_cloturee_jours"
            type="number"
            min={7}
            max={3650}
            step={1}
            required
            defaultValue={parametres.conservationNonClotureeJours}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="conservation_audit_mois">Journal d&apos;audit : mois conservés (1 à 120)</label>
          <input
            id="conservation_audit_mois"
            name="conservation_audit_mois"
            type="number"
            min={1}
            max={120}
            step={1}
            required
            defaultValue={parametres.conservationAuditMois}
          />
        </div>
      </fieldset>
      <fieldset
        style={{
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Assistance, validation et carte</legend>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="whatsapp_assistance">Numéro WhatsApp d&apos;assistance</label>
          <input
            id="whatsapp_assistance"
            name="whatsapp_assistance"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={24}
            defaultValue={parametres.whatsappAssistance}
            placeholder="Ex. 224 6XX XX XX XX"
          />
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            Avec l&apos;indicatif du pays. Une fois renseigné, un bouton « Écrire sur WhatsApp » apparaît sur l&apos;aide, la
            page partenaire, l&apos;inscription et le tableau de bord des restaurateurs. Vide = aucun bouton.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="delai_validation_heures">Délai habituel de validation d&apos;une page restaurant (heures)</label>
          <input
            id="delai_validation_heures"
            name="delai_validation_heures"
            type="number"
            min={1}
            max={720}
            step={1}
            defaultValue={parametres.delaiValidationHeures ?? ""}
            placeholder="Ex. 48"
          />
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            Affiché aux restaurateurs sous la forme « réponse en général sous X ». Ne l&apos;indiquez que si vous pouvez le
            tenir. Vide = aucune durée annoncée.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="case-parametre">
            <input type="checkbox" name="position_carte_active" defaultChecked={parametres.positionCarteActive} />
            Activer la position sur carte
          </label>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            Les restaurateurs peuvent alors indiquer la position de leur établissement (bouton « Utiliser ma position »), et
            la fiche affiche des liens « Voir sur la carte » et « Itinéraire ». Aucune carte n&apos;est chargée dans la page :
            ce sont de simples liens.
          </p>
        </div>
      </fieldset>
      <fieldset
        style={{
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Comptes clients</legend>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="case-parametre">
            <input type="checkbox" name="connexion_facebook_active" defaultChecked={parametres.connexionFacebookActive} />
            Activer la connexion Facebook des clients
          </label>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
            À cocher seulement après avoir créé l&apos;application Meta et activé « Facebook » dans Supabase
            (Authentication, Providers). Tant que c&apos;est décoché, la page « Rejoindre Speedfood » indique que la création
            de compte arrive bientôt et aucun bouton Facebook n&apos;est proposé.
          </p>
        </div>
      </fieldset>
      <fieldset
        style={{
          border: "1px solid var(--bordure)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
      >
        <legend style={{ fontWeight: 700, padding: "0 6px" }}>Textes d&apos;accueil</legend>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>
          Laissez un champ vide pour garder le texte par défaut. Ne promettez que ce que l&apos;application tient : pas de délai de
          livraison, pas de chiffre non calculé.
        </p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="promesse_signature">Signature, au-dessus de l&apos;accroche (80 caractères)</label>
          <input id="promesse_signature" name="promesse_signature" type="text" maxLength={80} defaultValue={parametres.promesseSignature} placeholder="Confirmé, l'heure à l'appui" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="promesse_sous_titre">Sous-titre de l&apos;accueil (220 caractères)</label>
          <textarea id="promesse_sous_titre" name="promesse_sous_titre" rows={3} maxLength={220} defaultValue={parametres.promesseSousTitre} placeholder="Une commande se fait depuis le navigateur de votre téléphone : aucun compte à créer, aucune application à installer." />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="promesse_partage">Description de partage, WhatsApp et Google (200 caractères)</label>
          <textarea id="promesse_partage" name="promesse_partage" rows={3} maxLength={200} defaultValue={parametres.promessePartage} placeholder="Speedfood, Conakry. Chaque plat affiche l'heure à laquelle son restaurant l'a confirmé. Commande sans compte, règlement au restaurant." />
        </div>
      </fieldset>
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}
      {etat.succes ? <Alert ton="succes">Paramètres enregistrés.</Alert> : null}
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
