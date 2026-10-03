"use client";

import { useActionState, useState, useTransition } from "react";
import {
  modifierPlatAction,
  basculerDisponibiliteAction,
  confirmerDisponibiliteAction,
  archiverPlatAction,
  type EtatFormulaireMenu,
} from "@/lib/menu/actions";
import type { LibelleDisponibilite } from "@/lib/disponibilite/etat";
import { Card, Badge, Button, Input, Alert } from "@/components/ui";
import { OptionsPlat } from "./OptionsPlat";

interface Section {
  id: string;
  nom: string;
}

interface Plat {
  id: string;
  nom: string;
  description: string;
  prix: number;
  prix_promo: number | null;
  disponible: boolean;
  photo_url: string | null;
  section_id: string | null;
  options: { id: string; nom: string; prix: number }[];
  /** État de disponibilité tel que les clients le voient (calculé côté serveur). */
  disponibilite: LibelleDisponibilite;
}

const etatInitial: EtatFormulaireMenu = {};

export function PlatItem({ plat, sections = [] }: { plat: Plat; sections?: Section[] }) {
  const [enEdition, setEnEdition] = useState(false);
  const [etat, action, enCours] = useActionState(modifierPlatAction, etatInitial);
  const [enTransition, demarrerTransition] = useTransition();

  if (enEdition) {
    return (
      <Card>
        <form
          action={(formData) => {
            action(formData);
            setEnEdition(false);
          }}
        >
          <input type="hidden" name="id" value={plat.id} />
          <div className="field">
            <label htmlFor={`photo-${plat.id}`}>Photo du plat</label>
            {plat.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
              <img
                src={plat.photo_url}
                alt=""
                style={{ width: 120, height: 90, objectFit: "cover", borderRadius: "var(--radius-md)", marginBottom: 8, display: "block" }}
              />
            ) : null}
            <input
              id={`photo-${plat.id}`}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
              Laissez vide pour ne pas changer la photo actuelle.
            </p>
          </div>
          <Input label="Nom du plat" name="nom" type="text" required maxLength={120} defaultValue={plat.nom} />
          <Input
            label="Description"
            name="description"
            type="text"
            maxLength={500}
            defaultValue={plat.description}
          />
          <Input
            label="Prix (GNF)"
            name="prix"
            type="number"
            min={0}
            max={5_000_000}
            step={1}
            required
            defaultValue={plat.prix}
          />
          <div className="field">
            <label htmlFor={`prix_promo-${plat.id}`}>Prix promo (GNF)</label>
            <input
              id={`prix_promo-${plat.id}`}
              name="prix_promo"
              type="number"
              min={0}
              step={1}
              defaultValue={plat.prix_promo ?? ""}
            />
            <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--secondaire)" }}>
              Facultatif — inférieur ou égal au prix normal. Laissez vide pour retirer la promo.
            </p>
          </div>
          {sections.length > 0 ? (
            <div className="field">
              <label htmlFor={`section_id-${plat.id}`}>Section du menu</label>
              <select id={`section_id-${plat.id}`} name="section_id" defaultValue={plat.section_id ?? ""}>
                <option value="">Aucune section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.nom}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {etat.erreur ? (
            <Alert ton="danger" style={{ marginBottom: "var(--space-4)" }}>
              {etat.erreur}
            </Alert>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="submit" disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variante="secondary" onClick={() => setEnEdition(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <strong>{plat.nom}</strong>
            <Badge ton={plat.disponibilite.ton}>{plat.disponibilite.court}</Badge>
          </div>
          {plat.disponibilite.detail ? (
            <p style={{ margin: "0 0 2px", fontSize: "0.78rem", color: "var(--secondaire)" }}>
              {plat.disponibilite.detail}
            </p>
          ) : null}
          {plat.description ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--secondaire)" }}>{plat.description}</p>
          ) : null}
          {plat.prix_promo !== null ? (
            <p style={{ margin: 0 }}>
              <span style={{ textDecoration: "line-through", color: "var(--secondaire)", marginRight: 6 }}>
                {plat.prix.toLocaleString("fr-FR")} GNF
              </span>
              <strong style={{ color: "var(--rouge)" }}>{plat.prix_promo.toLocaleString("fr-FR")} GNF</strong>
            </p>
          ) : (
            <p style={{ margin: 0, fontWeight: 700 }}>{plat.prix.toLocaleString("fr-FR")} GNF</p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
          {plat.disponible ? (
            <Button
              type="button"
              variante="secondary"
              disabled={enTransition}
              onClick={() =>
                demarrerTransition(() => {
                  confirmerDisponibiliteAction(plat.id);
                })
              }
            >
              Confirmer disponible
            </Button>
          ) : null}
          <Button
            type="button"
            variante="secondary"
            disabled={enTransition}
            onClick={() =>
              demarrerTransition(() => {
                basculerDisponibiliteAction(plat.id, !plat.disponible);
              })
            }
          >
            {plat.disponible ? "Épuisé" : "Remettre disponible"}
          </Button>
          <Button type="button" variante="secondary" onClick={() => setEnEdition(true)}>
            Modifier
          </Button>
          <Button
            type="button"
            variante="danger"
            disabled={enTransition}
            onClick={() => {
              if (confirm(`Archiver « ${plat.nom} » ? Ce plat ne sera plus visible dans votre menu.`)) {
                demarrerTransition(() => {
                  archiverPlatAction(plat.id);
                });
              }
            }}
          >
            Archiver
          </Button>
        </div>
      </div>
      <OptionsPlat menuItemId={plat.id} options={plat.options} />
    </Card>
  );
}
