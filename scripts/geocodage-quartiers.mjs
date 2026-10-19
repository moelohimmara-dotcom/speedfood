// Collecte ponctuelle des coordonnées (approximatives) des quartiers qui n'en ont pas, depuis OpenStreetMap (Nominatim).
// Usage : node scripts/geocodage-quartiers.mjs  -> écrit scripts/.geocodage-quartiers.json (résultats et rejets)
//
// Garde-fous : 1 requête par seconde et User-Agent identifiable (politique d'usage de Nominatim) ; un résultat n'est retenu que s'il est de
// classe « place » (quartier, village, lieu-dit…) ET proche du centre de la commune du quartier (homonymes : beaucoup de quartiers
// portent le même nom dans plusieurs villes). Sans centre de commune connu, rien n'est retenu. Les points sont APPROXIMATIFS : ils servent
// seulement à trouver la zone la plus proche d'une position GPS. Les clés lues viennent de .env.local (lecture publique, rien n'est écrit en base).
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const racine = fileURLToPath(new URL("..", import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(racine + ".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")])
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_BASE || !CLE) throw new Error("Variables Supabase publiques absentes de .env.local");

const lire = async (chemin) => {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, { headers: { apikey: CLE, Authorization: `Bearer ${CLE}` } });
  if (!r.ok) throw new Error(`Lecture ${chemin} : ${r.status}`);
  return r.json();
};

const normaliser = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const km = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const quartiers = await lire("neighborhoods?select=id,nom,generique,latitude,communes(nom,latitude,longitude,prefectures(nom))&latitude=is.null&generique=eq.false&order=nom&limit=2000");
console.log(`${quartiers.length} quartiers sans coordonnées`);

const CLASSES_OK = new Set(["suburb", "neighbourhood", "quarter", "village", "hamlet", "town", "city", "locality", "city_block", "borough", "isolated_dwelling", "farm", "square"]);
const resultats = [];
const rejets = [];
let i = 0;
for (const q of quartiers) {
  i++;
  const commune = Array.isArray(q.communes) ? q.communes[0] : q.communes;
  const prefecture = commune?.prefectures ? (Array.isArray(commune.prefectures) ? commune.prefectures[0] : commune.prefectures)?.nom : "";
  const centre = commune && commune.latitude !== null && commune.longitude !== null ? { lat: Number(commune.latitude), lon: Number(commune.longitude) } : null;
  if (!centre) {
    rejets.push({ id: q.id, nom: q.nom, commune: commune?.nom, raison: "commune sans centre" });
    continue;
  }
  // Requête volontairement large (nom + préfecture) : les communes de la base ne suivent pas toujours le découpage d'OpenStreetMap.
  const requete = [q.nom, prefecture, "Guinée"].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=gn&q=${encodeURIComponent(requete)}`;
  let propositions = [];
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Speedfood-geocodage-ponctuel/1.0 (https://speedfood-app.moelohimmara.workers.dev)", "Accept-Language": "fr" } });
    if (r.ok) propositions = await r.json();
    else rejets.push({ id: q.id, nom: q.nom, commune: commune?.nom, raison: `HTTP ${r.status}` });
  } catch (e) {
    rejets.push({ id: q.id, nom: q.nom, commune: commune?.nom, raison: "réseau" });
  }
  const seuil = ["Conakry"].includes(prefecture) ? 20 : 40;
  const retenu = propositions
    .filter((p) => (p.category === "place" && CLASSES_OK.has(p.type)) || (p.category === "boundary" && p.type === "administrative"))
    .filter((p) => normaliser(String(p.display_name).split(",")[0]) === normaliser(q.nom))
    .map((p) => ({ lat: Number(p.lat), lon: Number(p.lon), nom: p.display_name, distCommuneKm: km(centre, { lat: Number(p.lat), lon: Number(p.lon) }) }))
    .filter((p) => p.distCommuneKm <= seuil)
    .sort((a, b) => a.distCommuneKm - b.distCommuneKm)[0];
  if (retenu) resultats.push({ id: q.id, nom: q.nom, commune: commune?.nom, lat: +retenu.lat.toFixed(5), lon: +retenu.lon.toFixed(5), distCommuneKm: +retenu.distCommuneKm.toFixed(1), osm: retenu.nom });
  else if (!rejets.some((x) => x.id === q.id)) rejets.push({ id: q.id, nom: q.nom, commune: commune?.nom, raison: propositions.length ? "résultats trop loin de la commune ou hors classe lieu" : "introuvable" });
  if (i % 25 === 0) console.log(`${i}/${quartiers.length} — retenus ${resultats.length}`);
  fs.writeFileSync(racine + "scripts/.geocodage-quartiers.json", JSON.stringify({ resultats, rejets }, null, 1));
  await new Promise((res) => setTimeout(res, 1100));
}
fs.writeFileSync(racine + "scripts/.geocodage-quartiers.json", JSON.stringify({ resultats, rejets }, null, 1));
console.log(`Terminé : ${resultats.length} retenus, ${rejets.length} rejetés`);
