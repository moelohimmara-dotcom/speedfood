// Simulation sur une COPIE jetable de la base (PGlite en mémoire : les migrations rejouées, de faux comptes, aucune donnée réelle, aucun accès à la production) du contenu de démonstration :
//   1. le chargement (supabase/demo/charger-demonstration.sql) : volumes, cohérence des commandes, des lignes, des avis, des livraisons ;
//   2. la garantie « toute nouvelle commande chez un restaurant de démonstration est de test » ;
//   3. masquer / réafficher / supprimer le lot, avec les refus (rôle, session renforcée, motif) ;
//   4. rien d'autre n'est touché : vrai restaurant, vraie commande, ancienne fiche de développement « donnees_demo ».
// Usage : npm run test:demonstration   (prérequis, une fois : cd supabase/rejeu && npm ci)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { PGlite } = await import(
  pathToFileURL(path.join(racine, "..", "..", "supabase", "rejeu", "node_modules", "@electric-sql", "pglite", "dist", "index.js")).href
).catch(() => {
  console.error("PGlite absent : lancez d'abord  cd supabase/rejeu && npm ci");
  process.exit(1);
});

let echecs = 0;
let reussis = 0;
function verifier(nom, ok, detail = "") {
  if (ok) {
    reussis += 1;
    console.log(`OK    ${nom}`);
  } else {
    echecs += 1;
    console.log(`ECHEC ${nom}${detail ? "\n         " + detail : ""}`);
  }
}

// ---------------------------------------------------------------- base jetable, comme Supabase
const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text);
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const dossierMigrations = path.join(racine, "..", "..", "supabase", "migrations");
const fichiers = fs.readdirSync(dossierMigrations).filter((n) => n.endsWith(".sql")).sort();
for (const f of fichiers) {
  try {
    await db.exec(fs.readFileSync(path.join(dossierMigrations, f), "utf8").replace(/create extension if not exists pgcrypto;?/gi, ""));
  } catch (e) {
    console.log(`ECHEC migration ${f} : ${e.message}`);
    process.exit(1);
  }
}
console.log(`${fichiers.length} migrations rejouées sur la copie jetable\n`);

const ID = {
  admin: "00000000-0000-4000-8000-00000000dddd",
  support: "00000000-0000-4000-8000-00000000eeee",
  reel: "00000000-0000-4000-8000-0000000000a1",
  dev: "00000000-0000-4000-8000-0000000000a2",
};
async function en_tant_que(qui, fn, aal = "aal2") {
  const claims = { sub: qui, role: "authenticated", aal };
  await db.exec(`select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false)`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${qui}', false)`);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.exec("select set_config('request.jwt.claims', '{}', false), set_config('request.jwt.claim.sub', '', false)");
  }
}
async function appeler(qui, sql, params = [], aal = "aal2") {
  return en_tant_que(
    qui,
    async () => {
      try {
        const r = await db.query(sql, params);
        return { rows: r.rows, erreur: null };
      } catch (e) {
        return { rows: [], erreur: e.message };
      }
    },
    aal,
  );
}
const un = async (sql, params = []) => (await db.query(sql, params)).rows[0];

// ---------------------------------------------------------------- données de départ : 12 quartiers de Conakry, 4 catégories, un vrai restaurant, une ancienne fiche « [DEV] »
await db.exec(`
  insert into auth.users (id, email) values ('${ID.admin}', 'admin@test.invalid'), ('${ID.support}', 'support@test.invalid');
  insert into system_admin_memberships (utilisateur_id, role) values ('${ID.admin}', 'super_admin'), ('${ID.support}', 'support');
  insert into menu_categories (nom, ordre) values ('Riz & sauces', 1), ('Grillades', 2), ('Fast-food', 3), ('Petit-déjeuner', 4);
  insert into neighborhoods (nom, latitude, longitude)
    select 'Quartier ' || g, 9.50 + g * 0.01, -13.70 + g * 0.01 from generate_series(1, 12) g;
  insert into restaurants (id, nom, categorie_id, quartier_id, publie)
    select '${ID.reel}', 'VRAI-RESTO', (select id from menu_categories limit 1), (select id from neighborhoods limit 1), true;
  insert into restaurants (id, nom, categorie_id, quartier_id, publie, donnees_demo)
    select '${ID.dev}', '[DEV] Restaurant non publié', (select id from menu_categories limit 1), (select id from neighborhoods limit 1), false, true;
  insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut)
    values ('SF-REEL1', 'jeton-reel', '${ID.reel}', 'Vrai client', '620000001', 'retrait', 5000, 'terminee'),
           ('SF-DEV01', 'jeton-dev', '${ID.dev}', 'Client dev', '620000002', 'retrait', 5000, 'terminee');
`);

// ---------------------------------------------------------------- 1. chargement
console.log("--- Chargement du lot de démonstration");
const t0 = Date.now();
try {
  await db.exec(fs.readFileSync(path.join(racine, "..", "..", "supabase", "demo", "charger-demonstration.sql"), "utf8"));
  verifier(`le chargement s'exécute sans erreur (${Math.round((Date.now() - t0) / 1000)} s)`, true);
} catch (e) {
  verifier("le chargement s'exécute sans erreur", false, e.message);
  console.log(`\n${reussis} réussis, ${echecs} échec(s)`);
  process.exit(1);
}
const lot = (await un(`select
  (select count(*)::int from restaurants where demo_lot is not null) restos,
  (select count(*)::int from restaurants where demo_lot is not null and publie and donnees_demo and ouvert and accepte_commandes) restos_visibles,
  (select count(distinct nom)::int from restaurants where demo_lot is not null) noms,
  (select count(*)::int from menu_items i join restaurants r on r.id = i.restaurant_id where r.demo_lot is not null) plats,
  (select count(*)::int from menu_sections s join restaurants r on r.id = s.restaurant_id where r.demo_lot is not null) sections,
  (select count(*)::int from menu_items where section_id is null and restaurant_id in (select id from restaurants where demo_lot is not null)) plats_sans_section,
  (select count(*)::int from orders o join restaurants r on r.id = o.restaurant_id where r.demo_lot is not null) commandes,
  (select count(*)::int from orders o join restaurants r on r.id = o.restaurant_id where r.demo_lot is not null and o.est_test) commandes_test,
  (select count(distinct o.restaurant_id)::int from orders o join restaurants r on r.id = o.restaurant_id where r.demo_lot is not null) restos_avec_commandes,
  (select count(distinct reference)::int from orders) refs,
  (select count(*)::int from orders where cree_le > now()) futur,
  (select count(*)::int from orders o where o.statut = 'terminee' and o.sous_total <> (select sum(prix * quantite) from order_items where order_id = o.id)) totaux_faux,
  (select count(*)::int from avis a join restaurants r on r.id = a.restaurant_id where r.demo_lot is not null) avis,
  (select round(avg(note), 2)::float from avis) note_moyenne,
  (select count(*)::int from avis where cible <> 'restaurant') avis_hors_restaurant,
  (select count(*)::int from livreurs where demo_lot is not null and simule and donnees_demo) livreurs,
  (select count(*)::int from livraisons l join restaurants r on r.id = l.restaurant_id where r.demo_lot is not null and l.statut = 'livree') livraisons,
  (select count(*)::int from restaurants r where r.demo_lot is not null and r.avis_total <> (select count(*) from avis a where a.restaurant_id = r.id and not a.est_test)) compteurs_faux`));
verifier("60 restaurants, tous visibles et distincts", lot.restos === 60 && lot.restos_visibles === 60 && lot.noms === 60, JSON.stringify(lot));
verifier("environ 2 000 plats répartis en rubriques, aucun plat sans rubrique", lot.plats >= 1680 && lot.plats <= 2400 && lot.sections >= 700 && lot.plats_sans_section === 0, JSON.stringify(lot));
verifier("3 000 commandes d'historique, aucune marquée test (elles comptent dans les chiffres)", lot.commandes === 3000 && lot.commandes_test === 0, JSON.stringify(lot));
verifier("les commandes se répartissent sur la plupart des restaurants", lot.restos_avec_commandes >= 50, String(lot.restos_avec_commandes));
verifier("références uniques, aucune commande dans le futur, totaux égaux aux lignes", lot.refs === 3002 && lot.futur === 0 && lot.totaux_faux === 0, JSON.stringify(lot));
verifier("environ 2 000 avis, uniquement du client vers le restaurant", lot.avis >= 1700 && lot.avis <= 2400 && lot.avis_hors_restaurant === 0, String(lot.avis));
verifier("note moyenne plausible (entre 4,0 et 4,8)", lot.note_moyenne >= 4.0 && lot.note_moyenne <= 4.8, String(lot.note_moyenne));
verifier("les compteurs d'avis des restaurants égalent les avis publiés", lot.compteurs_faux === 0, String(lot.compteurs_faux));
verifier("40 livreurs simulés marqués, des livraisons terminées existent", lot.livreurs === 40 && lot.livraisons > 1000, JSON.stringify(lot));
const prix = await un("select min(prix)::int mn, max(prix)::int mx from menu_items where restaurant_id in (select id from restaurants where demo_lot is not null)");
verifier("prix plausibles en GNF (de 1 000 à 330 000, plateaux familiaux compris)", prix.mn >= 1000 && prix.mx <= 330000, JSON.stringify(prix));
// Répartition géographique : Conakry et les 7 autres régions administratives.
const geo = (await db.query(`select r.nom region, count(distinct x.id)::int restos, count(distinct c.id)::int communes,
    (select count(*)::int from orders o where o.restaurant_id in (select id from restaurants where demo_lot is not null and quartier_id in (select n2.id from neighborhoods n2 join communes c2 on c2.id = n2.commune_id join prefectures p2 on p2.id = c2.prefecture_id where p2.region_id = r.id))) commandes
  from restaurants x join neighborhoods n on n.id = x.quartier_id join communes c on c.id = n.commune_id join prefectures p on p.id = c.prefecture_id join regions r on r.id = p.region_id
  where x.demo_lot is not null group by r.id, r.nom order by 2 desc`)).rows;
const conakry = geo.find((g) => g.region === "Conakry");
const autresRegions = geo.filter((g) => g.region !== "Conakry");
verifier("les restaurants couvrent les 8 régions administratives", geo.length === 8 && autresRegions.every((g) => g.restos >= 2), JSON.stringify(geo));
verifier("Conakry : 37 restaurants répartis sur 10 communes", conakry && conakry.restos === 37 && conakry.communes === 10, JSON.stringify(conakry));
verifier("les régions comptent 23 restaurants, avec 10 à 16 % des commandes", autresRegions.reduce((s, g) => s + g.restos, 0) === 23 && autresRegions.reduce((s, g) => s + g.commandes, 0) >= 300 && autresRegions.reduce((s, g) => s + g.commandes, 0) <= 480, JSON.stringify(autresRegions));
const zones = await un(`select count(*)::int n, count(distinct restaurant_id)::int restos from restaurant_zones_desservies where restaurant_id in (select id from restaurants where demo_lot is not null)`);
verifier("chaque restaurant déclare la commune où il livre", zones.n === 60 && zones.restos === 60, JSON.stringify(zones));
const dehors = await un(`select count(*)::int n from livreurs where demo_lot is not null and latitude is not null and (latitude < 9.4 or latitude > 9.8)`);
verifier("des livreurs simulés se trouvent hors de Conakry", dehors.n >= 3, JSON.stringify(dehors));
// Menus riches et variés : chaque restaurant a son propre menu.
const menus = await un(`select count(*)::int restos, min(n)::int mini, max(n)::int maxi, min(rub)::int rub_mini, count(distinct empreinte)::int distincts,
    (select count(*)::int from menu_item_options o where o.menu_item_id in (select id from menu_items where restaurant_id in (select id from restaurants where demo_lot is not null))) options
  from (select r.id, count(*) n, count(distinct i.section_id) rub, md5(string_agg(i.nom, '|' order by i.nom)) empreinte
        from restaurants r join menu_items i on i.restaurant_id = r.id where r.demo_lot is not null group by r.id) t(id, n, rub, empreinte)`.replace("min(rub)","min(rub)"));
verifier("chaque restaurant a de 30 à 52 articles répartis en au moins 12 rubriques", menus.restos === 60 && menus.mini >= 30 && menus.maxi <= 52 && menus.rub_mini >= 12, JSON.stringify(menus));
verifier("les 60 menus sont tous différents, avec des options sur les plats", menus.distincts === 60 && menus.options > 300, JSON.stringify(menus));
// Rubriques : toutes proviennent du catalogue, le socle commun (entrées, en-cas, desserts, pâtisseries, 5 familles de boissons) est dans chaque menu.
const sqlGenerateur = fs.readFileSync(path.join(racine, "..", "..", "supabase", "demo", "charger-demonstration.sql"), "utf8");
const SECTIONS_CATALOGUE = [...new Set([...sqlGenerateur.matchAll(/\('[a-z*]+',\d+,'((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'")))];
const OBLIGATOIRES = ["Entrées chaudes", "Entrées froides", "En-cas", "Desserts", "Pâtisseries", "Boissons chaudes", "Jus et smoothies", "Boissons lactées", "Sodas et rafraîchissements", "Eaux"];
const listeSql = (a) => a.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ");
verifier("le catalogue compte au moins 40 rubriques différentes", SECTIONS_CATALOGUE.length >= 40, String(SECTIONS_CATALOGUE.length));
const incompletes = await un(`select count(*)::int n from restaurants r where r.demo_lot is not null
  and (select count(distinct s.nom) from menu_sections s where s.restaurant_id = r.id and s.nom in (${listeSql(OBLIGATOIRES)})) < ${OBLIGATOIRES.length}`);
verifier("chaque restaurant a les 10 rubriques de base (entrées chaudes et froides, en-cas, desserts, pâtisseries, 5 familles de boissons)", incompletes.n === 0, JSON.stringify(incompletes));
const inconnues = await un(`select count(*)::int n from menu_sections s join restaurants r on r.id = s.restaurant_id where r.demo_lot is not null and s.nom not in (${listeSql(SECTIONS_CATALOGUE)})`);
verifier("aucune rubrique en dehors du catalogue", inconnues.n === 0, JSON.stringify(inconnues));
const ordre = await un(`select count(*)::int n from restaurants r where r.demo_lot is not null and (
    (select s.position from menu_sections s where s.restaurant_id = r.id and s.nom = 'Entrées chaudes') <> 1
    or (select s.position from menu_sections s where s.restaurant_id = r.id and s.nom = 'Eaux') <> (select max(s.position) from menu_sections s where s.restaurant_id = r.id))`);
verifier("les rubriques sont toujours dans le même ordre (entrées d'abord, eaux en dernier)", ordre.n === 0, JSON.stringify(ordre));
const marques = await un(`select count(*)::int n from menu_items i join restaurants r on r.id = i.restaurant_id where r.demo_lot is not null and i.nom ~* 'coca|fanta|sprite|pepsi|heineken|nescaf|porc|bière|\\mvin\\M|whisky|rhum'`);
verifier("aucune marque, aucun porc ni alcool dans les noms d'articles", marques.n === 0, JSON.stringify(marques));
// Variété des cuisines : des restaurants 100 % guinéens, 100 % africains, mixtes, 100 % cuisine du monde, et toutes les cuisines représentées.
const G = ["Riz et sauces", "Spécialités et viandes", "Poissons et fruits de mer", "Grillades et brochettes"];
const A = ["Riz et plats du Sénégal", "Plats d'Afrique de l'Ouest", "Soupes et fufu", "Grillades et suya"];
const CUISINES_MONDE = {
  libanaise: ["Shawarma et wraps", "Grillades et plateaux", "Spécialités libanaises", "Manakish et pains"],
  turque: ["Döner et kebabs", "Iskender et plats", "Pides et lahmacun", "Grillades turques"],
  italienne: ["Pizzas", "Pâtes", "Risottos et gnocchis", "Viandes et poissons"],
  indienne: ["Tandoor", "Currys", "Biryanis et riz", "Pains (naan)"],
  chinoise: ["Dim sum", "Riz sauté et nouilles", "Plats de viande", "Poissons et crevettes"],
  japonaise: ["Sushis et makis", "Sashimi et chirashi", "Ramen et plats chauds", "Bento et donburi"],
  americaine: ["Burgers", "Poulet frit et tenders", "Hot-dogs et sandwichs", "Salades repas"],
  francaise: ["Plats du jour", "Sandwichs et croques", "Quiches et salades repas", "Crêpes salées"],
  mexicaine: ["Tacos", "Burritos et bowls", "Quesadillas et fajitas", "Plats mexicains"],
};
const W = Object.values(CUISINES_MONDE).flat();
const aSection = (liste) => `exists (select 1 from menu_sections s where s.restaurant_id = r.id and s.nom in (${listeSql(liste)}))`;
const variete = await un(`select
    count(*) filter (where ${aSection(G)} and not ${aSection(A)} and not ${aSection(W)})::int guineen_seul,
    count(*) filter (where ${aSection(A)} and not ${aSection(G)} and not ${aSection(W)})::int africain_seul,
    count(*) filter (where ${aSection(G)} and ${aSection(A)} and not ${aSection(W)})::int afro,
    count(*) filter (where ${aSection(G)} and ${aSection(W)})::int mixte,
    count(*) filter (where ${aSection(W)} and not ${aSection(G)} and not ${aSection(A)})::int monde,
    count(*) filter (where not ${aSection(G)} and not ${aSection(A)} and not ${aSection(W)})::int sans_plat
  from restaurants r where r.demo_lot is not null`);
verifier("les restaurants se répartissent entre guinéens, africains, mixtes et cuisines du monde", variete.guineen_seul >= 8 && variete.africain_seul >= 2 && variete.mixte >= 4 && variete.monde >= 8 && variete.sans_plat === 0 && variete.afro >= 0, JSON.stringify(variete));
const couvertes = [];
for (const [cuisine, sections] of Object.entries(CUISINES_MONDE)) {
  const n = (await un(`select count(*)::int n from restaurants r where r.demo_lot is not null and ${aSection(sections)}`)).n;
  if (n > 0) couvertes.push(cuisine);
}
verifier("les 9 cuisines du monde sont toutes représentées", couvertes.length === 9, couvertes.join(", "));
const regions = await un(`select count(*) filter (where ${aSection(G)})::int guineens, count(*)::int total
  from restaurants r join neighborhoods q on q.id = r.quartier_id join communes c on c.id = q.commune_id join prefectures p on p.id = c.prefecture_id join regions g on g.id = p.region_id
  where r.demo_lot is not null and g.nom <> 'Conakry'`);
verifier("hors Conakry, la moitié des restaurants au moins propose de la cuisine guinéenne", regions.total === 23 && regions.guineens >= 12, JSON.stringify(regions));
const categories = await un(`select count(distinct categorie_id)::int n from restaurants where demo_lot is not null`);
verifier("les restaurants se répartissent dans au moins 6 catégories", categories.n >= 6, JSON.stringify(categories));
const reg = await un(`select count(*)::int n from menu_items i join restaurants r on r.id = i.restaurant_id join neighborhoods q on q.id = r.quartier_id join communes c on c.id = q.commune_id join prefectures p on p.id = c.prefecture_id join regions g on g.id = p.region_id
  where r.demo_lot is not null and g.nom in ('Labé', 'Mamou') and (i.nom in ('Fonio sauce gombo', 'Poulet du Fouta aux oignons', 'Brochettes de mouton du Fouta') or i.nom like 'Haricots à l%huile rouge')`);
verifier("les restaurants du Fouta proposent des plats du Fouta", reg.n >= 3, JSON.stringify(reg));
const rejeu = await db.exec(fs.readFileSync(path.join(racine, "..", "..", "supabase", "demo", "charger-demonstration.sql"), "utf8")).then(() => null, (e) => e.message);
verifier("recharger un lot déjà présent est refusé", rejeu !== null && rejeu.includes("déjà chargé"), String(rejeu));

// ---------------------------------------------------------------- 2. nouvelles commandes
console.log("\n--- Nouvelles commandes");
await db.exec(`insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut)
  select 'SF-NEW01', 'jeton-new-demo', id, 'Visiteur', '620000003', 'retrait', 8000, 'en_attente' from restaurants where demo_lot is not null limit 1;
  insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut)
  values ('SF-NEW02', 'jeton-new-reel', '${ID.reel}', 'Visiteur', '620000004', 'retrait', 8000, 'en_attente');
  insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut)
  values ('SF-NEW03', 'jeton-new-dev', '${ID.dev}', 'Visiteur', '620000005', 'retrait', 8000, 'en_attente');`);
verifier("une nouvelle commande chez un restaurant du lot est une commande de test", (await un("select est_test from orders where reference = 'SF-NEW01'")).est_test === true);
verifier("une nouvelle commande chez un vrai restaurant reste une vraie commande", (await un("select est_test from orders where reference = 'SF-NEW02'")).est_test === false);
verifier("une nouvelle commande chez une fiche « donnees_demo » est aussi de test", (await un("select est_test from orders where reference = 'SF-NEW03'")).est_test === true);

// ---------------------------------------------------------------- 3. masquer, réafficher, supprimer
console.log("\n--- Masquer, réafficher, supprimer");
let r = await appeler(ID.support, "select public.fn_demo_etat() j");
verifier("le support lit l'état du lot", r.erreur === null && r.rows[0].j.restaurants === 60, r.erreur ?? "");
r = await appeler(ID.support, "select public.fn_demo_visibilite(false) n");
verifier("le support ne peut pas masquer le lot", r.erreur !== null && r.erreur.includes("Acces refuse"), r.erreur ?? "");
r = await appeler(ID.admin, "select public.fn_demo_visibilite(false) n");
verifier("le super administrateur masque le lot : 60 restaurants dépubliés", r.erreur === null && r.rows[0].n === 60, r.erreur ?? "");
verifier("masquer ne touche ni le vrai restaurant ni la fiche de développement", (await un(`select publie from restaurants where id = '${ID.reel}'`)).publie === true && (await un(`select publie from restaurants where id = '${ID.dev}'`)).publie === false);
r = await appeler(ID.admin, "select public.fn_demo_visibilite(true) n");
verifier("le super administrateur réaffiche le lot sans réafficher la fiche de développement", r.erreur === null && r.rows[0].n === 60 && (await un(`select publie from restaurants where id = '${ID.dev}'`)).publie === false, r.erreur ?? "");
verifier("masquer et réafficher sont tracés dans le journal d'audit", (await un("select count(*)::int n from audit_events where action in ('demo.masquee', 'demo.reaffichee')")).n === 2);

r = await appeler(ID.support, "select public.fn_demo_supprimer('Fin de la présentation client') j");
verifier("le support ne peut pas supprimer le lot", r.erreur !== null && r.erreur.includes("Acces refuse"), r.erreur ?? "");
r = await appeler(ID.admin, "select public.fn_demo_supprimer('Fin de la présentation client') j", [], "aal1");
verifier("sans session renforcée, la suppression est refusée", r.erreur !== null && r.erreur.includes("Acces refuse"), r.erreur ?? "");
r = await appeler(ID.admin, "select public.fn_demo_supprimer('court') j");
verifier("un motif trop court est refusé", r.erreur !== null && r.erreur.includes("REFUS:motif"), r.erreur ?? "");
verifier("rien n'a été supprimé par les refus", (await un("select count(*)::int n from restaurants where demo_lot is not null")).n === 60);

r = await appeler(ID.admin, "select public.fn_demo_supprimer('Fin de la présentation client') j");
verifier("le super administrateur avec session renforcée supprime le lot", r.erreur === null && r.rows[0].j.restaurants === 60 && r.rows[0].j.commandes === 3001 && r.rows[0].j.livreurs === 40, r.erreur ?? JSON.stringify(r.rows[0]));
const reste = await un(`select
  (select count(*)::int from restaurants) restos,
  (select count(*)::int from restaurants where id in ('${ID.reel}', '${ID.dev}')) gardes,
  (select count(*)::int from orders) commandes,
  (select count(*)::int from orders where reference in ('SF-REEL1', 'SF-DEV01', 'SF-NEW02', 'SF-NEW03')) commandes_gardees,
  (select count(*)::int from menu_items) plats, (select count(*)::int from avis) avis, (select count(*)::int from livraisons) livraisons, (select count(*)::int from livreurs) livreurs`);
verifier("après suppression : le vrai restaurant et la fiche de développement sont intacts", reste.restos === 2 && reste.gardes === 2, JSON.stringify(reste));
verifier("après suppression : leurs commandes sont intactes, tout le reste est parti", reste.commandes === 4 && reste.commandes_gardees === 4 && reste.plats === 0 && reste.avis === 0 && reste.livraisons === 0 && reste.livreurs === 0, JSON.stringify(reste));
verifier("la suppression est tracée dans le journal d'audit", (await un("select count(*)::int n from audit_events where action = 'demo.supprimee' and motif like 'Fin de la présentation client [restaurants: 60%'")).n === 1);
await db.exec(fs.readFileSync(path.join(racine, "..", "..", "supabase", "demo", "charger-demonstration.sql"), "utf8"));
verifier("après suppression, le lot peut être rechargé", (await un("select count(*)::int n from restaurants where demo_lot is not null")).n === 60);

// ---------------------------------------------------------------- contre-épreuve : sans la garde, une commande chez le lot ne serait pas de test
console.log("\n--- Contre-épreuve");
await db.exec("drop trigger trg_marquer_commande_demo on orders");
await db.exec(`insert into orders (reference, jeton_suivi, restaurant_id, client_nom, client_telephone, mode, sous_total, statut)
  select 'SF-CTR01', 'jeton-ctr', id, 'Visiteur', '620000006', 'retrait', 8000, 'en_attente' from restaurants where demo_lot is not null limit 1`);
verifier("sans le déclencheur, la même commande ne serait PAS de test (la garde est bien ce qui protège)", (await un("select est_test from orders where reference = 'SF-CTR01'")).est_test === false);

console.log(`\n${reussis} contrôles réussis, ${echecs} échec(s)`);
process.exit(echecs === 0 ? 0 : 1);
