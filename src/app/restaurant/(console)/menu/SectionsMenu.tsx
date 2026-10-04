"use client";

import { useActionState, useRef, useTransition } from "react";
import {
  creerSectionAction,
  renommerSectionAction,
  supprimerSectionAction,
  deplacerSectionAction,
  type EtatFormulaireSection,
} from "@/lib/menu/actions";
import { Card, Button, Alert } from "@/components/ui";

interface Section {
  id: string;
  nom: string;
}

const etatInitial: EtatFormulaireSection = {};

function LigneSection({ section, index, total }: { section: Section; index: number; total: number }) {
  const [etat, action, enCours] = useActionState(renommerSectionAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();

  return (
    <div className="section-ligne">
      <div className="section-fleches">
        <button
          type="button"
          className="section-bouton-icone"
          aria-label={`Monter « ${section.nom} »`}
          disabled={index === 0 || enTransition}
          onClick={() => demarrerTransition(() => deplacerSectionAction(section.id, "haut"))}
        >
          ▲
        </button>
        <button
          type="button"
          className="section-bouton-icone"
          aria-label={`Descendre « ${section.nom} »`}
          disabled={index === total - 1 || enTransition}
          onClick={() => demarrerTransition(() => deplacerSectionAction(section.id, "bas"))}
        >
          ▼
        </button>
      </div>
      <form action={action} className="section-renommer">
        <input type="hidden" name="id" value={section.id} />
        <label htmlFor={`section-nom-${section.id}`} className="sr-only">
          Nom de la section
        </label>
        <input
          id={`section-nom-${section.id}`}
          name="nom"
          type="text"
          defaultValue={section.nom}
          maxLength={60}
          required
        />
        <Button type="submit" variante="secondary" disabled={enCours}>
          {enCours ? "…" : "Renommer"}
        </Button>
      </form>
      <button
        type="button"
        className="section-bouton-icone section-supprimer"
        aria-label={`Supprimer la section « ${section.nom} »`}
        disabled={enTransition}
        onClick={() => {
          if (
            confirm(
              `Supprimer la section « ${section.nom} » ? Les plats qu'elle contient redeviendront non classés.`
            )
          ) {
            demarrerTransition(() => supprimerSectionAction(section.id));
          }
        }}
      >
        ✕
      </button>
      {etat.erreur ? (
        <Alert ton="danger" style={{ flexBasis: "100%" }}>
          {etat.erreur}
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * Sections libres du menu (pas de taxonomie imposée) : chaque restaurant
 * compose ses propres sections, dans l'ordre qu'il veut. Un plat sans
 * section reste affiché normalement (voir menu/page.tsx) — cette fonction
 * est purement organisationnelle, jamais obligatoire.
 */
export function SectionsMenu({ sections }: { sections: Section[] }) {
  const [etat, action, enCours] = useActionState(creerSectionAction, etatInitial);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card style={{ marginBottom: "var(--space-5)" }}>
      <h2 style={{ marginBottom: "var(--space-3)", fontSize: "1.25rem" }}>Sections du menu</h2>
      <p style={{ margin: "0 0 var(--space-3)", fontSize: "0.85rem", color: "var(--secondaire)" }}>
        Organisez vos plats comme vous voulez (ex. Entrées froides, Plats — Riz, Desserts).
        Facultatif : un plat sans section reste visible normalement.
      </p>
      {sections.length > 0 ? (
        <div style={{ marginBottom: "var(--space-3)" }}>
          {sections.map((section, index) => (
            <LigneSection key={section.id} section={section} index={index} total={sections.length} />
          ))}
        </div>
      ) : (
        <p style={{ margin: "0 0 var(--space-3)", fontSize: "0.85rem", color: "var(--secondaire)" }}>
          Aucune section pour l&apos;instant.
        </p>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          action(formData);
          formRef.current?.reset();
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
          <label htmlFor="nouvelle-section">Nouvelle section</label>
          <input id="nouvelle-section" name="nom" type="text" maxLength={60} placeholder="Ex. Entrées froides" required />
        </div>
        <Button type="submit" variante="secondary" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </form>
      {etat.erreur ? (
        <Alert ton="danger" style={{ marginTop: 8 }}>
          {etat.erreur}
        </Alert>
      ) : null}
    </Card>
  );
}
