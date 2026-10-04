/**
 * Position d'un restaurant (lot « carte »). Deux coordonnées vont ensemble ; elles doivent rester dans la zone Guinée,
 * comme la contrainte `restaurants_position_coherente` de la base. Un champ vide des deux côtés = pas de position.
 */
export interface Position {
  latitude: number;
  longitude: number;
}

export type ResultatPosition = { ok: true; position: Position | null } | { ok: false; erreur: string };

const LATITUDE = { min: 7, max: 13 };
const LONGITUDE = { min: -15, max: -7 };

function lireNombre(brut: string): number | null {
  const texte = brut.trim().replace(",", ".");
  if (!/^-?\d{1,3}(\.\d+)?$/.test(texte)) {
    return null;
  }
  return Number(texte);
}

export function analyserPosition(latitudeBrute: string, longitudeBrute: string): ResultatPosition {
  if (latitudeBrute.trim() === "" && longitudeBrute.trim() === "") {
    return { ok: true, position: null };
  }
  const latitude = lireNombre(latitudeBrute);
  const longitude = lireNombre(longitudeBrute);
  if (latitude === null || longitude === null) {
    return { ok: false, erreur: "La position doit comporter une latitude et une longitude en chiffres (ex. 9.5370 et -13.6785)." };
  }
  if (latitude < LATITUDE.min || latitude > LATITUDE.max || longitude < LONGITUDE.min || longitude > LONGITUDE.max) {
    return { ok: false, erreur: "Cette position est hors de la Guinée. Vérifiez la latitude et la longitude." };
  }
  return {
    ok: true,
    position: { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 },
  };
}
