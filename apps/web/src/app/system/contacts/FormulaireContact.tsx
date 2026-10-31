"use client";

import { useActionState, useState } from "react";
import { enregistrerContactAction, type EtatActionContact } from "@/lib/system-admin/contacts-actions";
import { Button, Alert } from "@/components/ui";
import { ListeChoix } from "@/components/ui/ListeChoix";

/**
 * Lot L7 — note de contact avec l'établissement.
 *
 * Le compte rendu est obligatoire (sans lui, le journal ne sert à rien) et la prochaine action porte
 * une échéance : elle est ensuite suivie comme rappel par la console.
 */

export interface EtablissementChoix {
  id: string;
  nom: string;
}

const ETAT_INITIAL: EtatActionContact = {};

export function FormulaireContact({
  etablissements,
  selectionne,
  peutAgir,
}: {
  etablissements: EtablissementChoix[];
  /** Établissement déjà filtré dans la page (le formulaire le propose en premier). */
  selectionne?: string;
  peutAgir: boolean;
}) {
  const [etat, action, enCours] = useActionState(enregistrerContactAction, ETAT_INITIAL);
  const [restaurantId, setRestaurantId] = useState(selectionne ?? etablissements[0]?.id ?? "");
  const [type, setType] = useState("appel");

  if (!peutAgir) {
    return (
      <p className="ad-aide-champ">
        Votre rôle système permet de consulter le journal, mais pas d&apos;y consigner un contact.
      </p>
    );
  }

  if (etablissements.length === 0) {
    return <p className="ad-aide-champ">Aucun établissement tenu par l&apos;équipe : rien à consigner pour l&apos;instant.</p>;
  }

  return (
    <>
      {etat.succes ? <Alert ton="succes">{etat.succes}</Alert> : null}
      {etat.erreur ? <Alert ton="danger">{etat.erreur}</Alert> : null}

      <form action={action} className="ad-formulaire">
        <div className="field ad-dialogue-champ">
          <label htmlFor="contact-etablissement">Établissement</label>
          <ListeChoix
            nom="restaurant_id"
            options={etablissements.map((e) => ({ valeur: e.id, libelle: e.nom }))}
            valeur={restaurantId}
            onChange={setRestaurantId}
            placeholder="Établissement"
            libelleAccessible="Établissement contacté"
            idEtiquette="contact-etablissement"
          />
        </div>

        <div className="field ad-dialogue-champ">
          <label htmlFor="contact-type">Type de contact</label>
          <ListeChoix
            nom="type_contact"
            options={[
              { valeur: "appel", libelle: "Appel" },
              { valeur: "visite", libelle: "Visite" },
              { valeur: "relance", libelle: "Relance" },
              { valeur: "whatsapp", libelle: "WhatsApp" },
            ]}
            valeur={type}
            onChange={setType}
            placeholder="Type de contact"
            libelleAccessible="Type de contact"
            idEtiquette="contact-type"
          />
        </div>

        <div className="field ad-dialogue-champ">
          <label htmlFor="contact-compte-rendu">Compte rendu (obligatoire)</label>
          <textarea id="contact-compte-rendu" name="compte_rendu" rows={4} maxLength={2000} required />
        </div>

        <div className="field ad-dialogue-champ">
          <label htmlFor="contact-prochaine-action">Prochaine action</label>
          <input id="contact-prochaine-action" name="prochaine_action" type="text" maxLength={300} />
        </div>

        <div className="field ad-dialogue-champ">
          <label htmlFor="contact-echeance">Échéance de la prochaine action</label>
          <input id="contact-echeance" name="echeance_le" type="datetime-local" />
          <span className="ad-aide-champ">
            Une échéance sans prochaine action n&apos;est pas acceptée : le rappel ne dirait pas quoi faire.
          </span>
        </div>

        <div className="ad-actions-ligne">
          <Button type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Consigner le contact"}
          </Button>
        </div>
      </form>
    </>
  );
}
