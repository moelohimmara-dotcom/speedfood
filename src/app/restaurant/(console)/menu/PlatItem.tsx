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
import { Illustration } from "@/components/illustrations/Illustration";
import { EditeurIllustration } from "@/components/illustrations/EditeurIllustration";
import { definirIllustrationRestoAction } from "@/lib/restaurant/illustrations";
import { illustrationPlat } from "@/lib/illustrations/automatique";
import type { PALETTES, Illustration as ModeleIllustration } from "@/lib/illustrations/modele";

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
  illustration?: ModeleIllustration | null;
  section_id: string | null;
  options: { id: string; nom: string; prix: number }[];
  /** État de disponibilité tel que les clients le voient (calculé côté serveur). */
  disponibilite: LibelleDisponibilite;
}

const etatInitial: EtatFormulaireMenu = {};

export function PlatItem({ plat, sections = [], restaurantId, famille = "defaut" }: { plat: Plat; sections?: Section[]; restaurantId: string; famille?: keyof typeof PALETTES }) {
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
    <Card className="plat-ligne">
      <div className="plat-ligne-corps">
        <div className="plat-ligne-media" aria-hidden="true">
          {plat.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage dynamique, pas un asset local.
            <img src={plat.photo_url} alt="" />
          ) : (
            <Illustration valeur={plat.illustration ?? illustrationPlat(plat.nom, famille)} nom="" decoratif />
          )}
        </div>
        <div className="plat-ligne-infos">
          <div className="plat-ligne-titre">
            <strong>{plat.nom}</strong>
            <Badge ton={plat.disponibilite.ton}>{plat.disponibilite.court}</Badge>
          </div>
          {plat.disponibilite.detail ? <p className="plat-ligne-detail">{plat.disponibilite.detail}</p> : null}
          {plat.description ? <p className="plat-ligne-detail">{plat.description}</p> : null}
          {plat.prix_promo !== null ? (
            <p className="plat-ligne-prix">
              <span className="plat-ligne-prix-barre">{plat.prix.toLocaleString("fr-FR")} GNF</span>
              <strong style={{ color: "var(--rouge-fonce)" }}>{plat.prix_promo.toLocaleString("fr-FR")} GNF</strong>
            </p>
          ) : (
            <p className="plat-ligne-prix">
              <strong>{plat.prix.toLocaleString("fr-FR")} GNF</strong>
            </p>
          )}
        </div>
        <label className="interrupteur" title="Un plat épuisé n'est plus proposé aux clients">
          <input
            type="checkbox"
            role="switch"
            checked={plat.disponible}
            disabled={enTransition}
            onChange={() =>
              demarrerTransition(() => {
                basculerDisponibiliteAction(plat.id, !plat.disponible);
              })
            }
          />
          <span className="interrupteur-piste" aria-hidden="true" />
          <span className="interrupteur-texte">{plat.disponible ? "Disponible" : "Épuisé"}</span>
        </label>
      </div>
      <div className="plat-ligne-actions">
        {plat.disponible ? (
          <Button
            type="button"
            variante="secondary"
            className="btn-compact"
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
        <Button type="button" variante="secondary" className="btn-compact" onClick={() => setEnEdition(true)}>
          Modifier
        </Button>
        <Button
          type="button"
          variante="danger"
          className="btn-compact"
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
      <OptionsPlat menuItemId={plat.id} options={plat.options} />
      {plat.photo_url ? null : (
        <details className="ad-plat-ill rc-illustration">
          <summary>Illustration du plat</summary>
          <EditeurIllustration
            cible="plat"
            id={plat.id}
            restaurantId={restaurantId}
            nom={plat.nom}
            famille={famille}
            valeur={plat.illustration ?? null}
            styles={["pastille", "assiette"]}
            action={definirIllustrationRestoAction}
          />
        </details>
      )}
    </Card>
  );
}
