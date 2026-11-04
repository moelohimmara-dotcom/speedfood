import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creerAuth } from '../src/connexion/client.ts';
import { ErreurRestaurateur, MESSAGE_SECURITE } from '../src/connexion/restaurateur.ts';
import {
  COTE_LONG_PHOTO_PX, COTE_LONG_PHOTO_REPLI_PX, MESSAGE_CAMERA_REFUSEE, MESSAGE_PHOTO_ILLISIBLE, MESSAGE_PHOTO_TROP_GROSSE_APP, QUALITE_JPEG, QUALITE_JPEG_REPLI,
  choisirPhoto, dimensionsReduites, type DepsPhoto, type SelectionPhoto,
} from '../src/connexion/photoPlat.ts';
import {
  actionPhotoDefinir, actionPhotoRetirer, boutonExiste, confirmationDe, confirmationRetirerPhoto, corpsDeAction, etatCorrespond, evoluerService, fichierPhotoPret, lireMenuRestaurateur, peutEnvoyerService,
  refusService, serviceVerrouille, verdictService, ETAT_SERVICE_REPOS, type ActionService, type FichierPhotoPrete, type MenuRestaurateur, type PlatRestaurateur,
} from '../src/connexion/serviceRestaurateur.ts';

const P1 = '00000000-0000-4000-8000-0000000000a1';
const P2 = '00000000-0000-4000-8000-0000000000a2';
const ACCES = 'acces-factice';
const API = 'https://speedfood-api.moelohimmara.workers.dev';
const CINQ_MO = 5 * 1024 * 1024;
const PHOTO_A = 'https://ggldjdizqrtpetdiohxy.supabase.co/storage/v1/object/public/medias/plats/11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
const PHOTO_B = 'https://ggldjdizqrtpetdiohxy.supabase.co/storage/v1/object/public/medias/plats/22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';

const platBrut = (id: string, surcharge: Record<string, unknown> = {}) => ({ id, nom: 'Plat ' + id.slice(-2), description: '', prix: 45000, prixPromo: null, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z', sectionId: null, photoUrl: null, options: [], ...surcharge });
const menu = (plats: unknown[]): MenuRestaurateur => lireMenuRestaurateur({ ok: true, sections: [], plats });
const platDe = (m: MenuRestaurateur, id = P1): PlatRestaurateur => m.plats.find(p => p.id === id)!;
const fichier = (size = 200_000): FichierPhotoPrete => ({ uri: 'file:///cache/ImageManipulator/abc.jpg', size, type: 'image/jpeg', nom: 'photo.jpg' });

// ---------- sélecteur et préparation de la photo (domaine pur, téléphone simulé) ----------
interface Journal { appels: string[]; reductions: Array<{ largeur: number; hauteur: number; coteLong: number; qualite: number }> }
function telephone(options: { camera?: boolean; selection?: SelectionPhoto; tailles?: number[]; reduireEchoue?: boolean; ouvrirEchoue?: boolean } = {}) {
  const journal: Journal = { appels: [], reductions: [] };
  const tailles = [...(options.tailles ?? [300_000])];
  const deps: DepsPhoto = {
    async demanderCamera() { journal.appels.push('permission'); return options.camera ?? true; },
    async ouvrir(source) { journal.appels.push('ouvrir:' + source); if (options.ouvrirEchoue) throw new Error('sélecteur indisponible'); return options.selection ?? { annule: false, uri: 'file:///galerie/original.heic', largeur: 4000, hauteur: 3000 }; },
    async reduire(uri, largeur, hauteur, coteLong, qualite) { journal.appels.push('reduire'); journal.reductions.push({ largeur, hauteur, coteLong, qualite }); if (options.reduireEchoue) throw new Error('mémoire'); return { uri: 'file:///cache/reduite-' + journal.reductions.length + '.jpg' }; },
    async taille() { journal.appels.push('taille'); return tailles.length > 1 ? tailles.shift()! : tailles[0]; },
  };
  return { deps, journal };
}

test('photo : annuler le sélecteur (galerie ou appareil photo) = AUCUNE erreur, aucun message, rien n’est réduit ni envoyé', async () => {
  for (const source of ['galerie', 'camera'] as const) {
    const t = telephone({ selection: { annule: true } });
    assert.deepEqual(await choisirPhoto(source, t.deps), { genre: 'annule' });
    assert.ok(!t.journal.appels.includes('reduire') && !t.journal.appels.includes('taille'), source);
  }
});
test('photo : appareil photo refusé = message clair qui renvoie vers les réglages ET la galerie, le sélecteur n’est pas ouvert ; la galerie ne demande aucune permission', async () => {
  const refus = telephone({ camera: false });
  assert.deepEqual(await choisirPhoto('camera', refus.deps), { genre: 'permission_refusee', message: MESSAGE_CAMERA_REFUSEE });
  assert.deepEqual(refus.journal.appels, ['permission']);
  assert.ok(MESSAGE_CAMERA_REFUSEE.includes('réglages') && MESSAGE_CAMERA_REFUSEE.includes('galerie'));
  const galerie = telephone({ camera: false });
  assert.equal((await choisirPhoto('galerie', galerie.deps)).genre, 'pret');
  assert.ok(!galerie.journal.appels.includes('permission'), 'le sélecteur système de la galerie n’exige aucune permission');
});
test('photo : une photo valide est réduite (côté long 1 600 px, JPEG 80 %) puis mesurée ; le fichier rendu est celui de la réduction', async () => {
  const t = telephone({ tailles: [350_000] });
  const r = await choisirPhoto('galerie', t.deps);
  assert.equal(r.genre, 'pret');
  if (r.genre === 'pret') {
    assert.deepEqual(r.fichier, { uri: 'file:///cache/reduite-1.jpg', size: 350_000, type: 'image/jpeg', nom: 'photo.jpg' });
    assert.ok(fichierPhotoPret(r.fichier));
  }
  assert.deepEqual(t.journal.reductions, [{ largeur: 1600, hauteur: 1200, coteLong: COTE_LONG_PHOTO_PX, qualite: QUALITE_JPEG }]);
  assert.deepEqual(t.journal.appels, ['ouvrir:galerie', 'reduire', 'taille']);
});
test('photo : l’appareil photo demande sa permission, ouvre l’appareil, puis réduit', async () => {
  const t = telephone();
  assert.equal((await choisirPhoto('camera', t.deps)).genre, 'pret');
  assert.deepEqual(t.journal.appels, ['permission', 'ouvrir:camera', 'reduire', 'taille']);
});
test('photo : encore trop lourde après la première réduction = seconde réduction plus forte ; sous 5 Mo elle est acceptée', async () => {
  const t = telephone({ tailles: [CINQ_MO + 1, 900_000] });
  const r = await choisirPhoto('galerie', t.deps);
  assert.equal(r.genre, 'pret');
  assert.equal(t.journal.reductions.length, 2);
  assert.deepEqual(t.journal.reductions[1], { largeur: 1000, hauteur: 750, coteLong: COTE_LONG_PHOTO_REPLI_PX, qualite: QUALITE_JPEG_REPLI });
  if (r.genre === 'pret') assert.equal(r.fichier.size, 900_000);
});
test('photo : toujours au-dessus de 5 Mo après les deux réductions = REFUSÉE ici, jamais un fichier prêt à envoyer', async () => {
  const t = telephone({ tailles: [CINQ_MO + 1] });
  assert.deepEqual(await choisirPhoto('galerie', t.deps), { genre: 'refuse', message: MESSAGE_PHOTO_TROP_GROSSE_APP });
  assert.equal(t.journal.reductions.length, 2);
});
test('photo : exactement 5 Mo est accepté ; 5 Mo + 1 octet est refusé (limite du serveur)', async () => {
  assert.equal((await choisirPhoto('galerie', telephone({ tailles: [CINQ_MO] }).deps)).genre, 'pret');
  assert.equal((await choisirPhoto('galerie', telephone({ tailles: [CINQ_MO + 1] }).deps)).genre, 'refuse');
});
test('photo : taille illisible (0, négative, NaN) ou panne du téléphone (sélecteur, réduction) = refus avec message fixe, jamais une exception', async () => {
  for (const taille of [0, -5, Number.NaN, 1.5]) assert.deepEqual(await choisirPhoto('galerie', telephone({ tailles: [taille] }).deps), { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE }, String(taille));
  assert.deepEqual(await choisirPhoto('galerie', telephone({ reduireEchoue: true }).deps), { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE });
  assert.deepEqual(await choisirPhoto('galerie', telephone({ ouvrirEchoue: true }).deps), { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE });
  assert.deepEqual(await choisirPhoto('galerie', telephone({ selection: { annule: false, uri: '', largeur: 10, hauteur: 10 } }).deps), { genre: 'refuse', message: MESSAGE_PHOTO_ILLISIBLE });
});
test('photo : dimensions inconnues (0) = largeur fixée, hauteur 0 (le téléphone garde les proportions)', async () => {
  const t = telephone({ selection: { annule: false, uri: 'file:///x.jpg', largeur: 0, hauteur: 0 } });
  assert.equal((await choisirPhoto('galerie', t.deps)).genre, 'pret');
  assert.deepEqual(t.journal.reductions[0], { largeur: 1600, hauteur: 0, coteLong: 1600, qualite: QUALITE_JPEG });
});
test('photo : dimensionsReduites ramène le côté long à la limite, sans jamais agrandir, proportions gardées', () => {
  assert.deepEqual(dimensionsReduites(4000, 3000, 1600), { largeur: 1600, hauteur: 1200 });
  assert.deepEqual(dimensionsReduites(3000, 4000, 1600), { largeur: 1200, hauteur: 1600 });
  assert.deepEqual(dimensionsReduites(800, 600, 1600), { largeur: 800, hauteur: 600 });
  assert.deepEqual(dimensionsReduites(1, 100000, 1600), { largeur: 1, hauteur: 1600 });
  for (const [l, h, c] of [[0, 10, 5], [10, 0, 5], [-1, 5, 5], [Number.NaN, 5, 5], [5, 5, 0]] as const) assert.equal(dimensionsReduites(l, h, c), null);
});
test('photo : fichierPhotoPret n’accepte que du JPEG, nommé photo.jpg, de 1 octet à 5 Mo, avec une adresse locale propre', () => {
  assert.ok(fichierPhotoPret(fichier(1)) && fichierPhotoPret(fichier(CINQ_MO)));
  for (const f of [fichier(0), fichier(CINQ_MO + 1), fichier(-1), fichier(1.5), { ...fichier(), type: 'image/png' }, { ...fichier(), nom: '../../x.jpg' }, { ...fichier(), uri: '' }, { ...fichier(), uri: 'file:///a\nb' }, { ...fichier(), uri: 'x'.repeat(2049) }, null, 'photo', { size: 5, type: 'image/jpeg' }]) {
    assert.equal(fichierPhotoPret(f), false, JSON.stringify(f)?.slice(0, 60));
  }
});

// ---------- lecture de la photo dans le menu ----------
test('menu D4c : l’adresse de la photo est lue ; absente, illisible ou non https n’invalide JAMAIS le plat (pas d’aperçu)', () => {
  const m = menu([platBrut(P1, { photoUrl: PHOTO_A }), platBrut(P2, { photoUrl: null })]);
  assert.deepEqual([platDe(m).photoRef, platDe(m).photoUrl], [PHOTO_A, PHOTO_A]);
  assert.deepEqual([platDe(m, P2).photoRef, platDe(m, P2).photoUrl], [null, null]);
  const bizarres = menu([platBrut(P1, { photoUrl: 12 }), platBrut(P2, { photoUrl: 'http://x/y.jpg' }), platBrut('00000000-0000-4000-8000-0000000000a3', { photoUrl: 'https://x/ y.jpg' }), platBrut('00000000-0000-4000-8000-0000000000a4', { photoUrl: 'https://x/' + 'a'.repeat(2100) }), platBrut('00000000-0000-4000-8000-0000000000a5', { photoUrl: 'javascript:alert(1)' }), platBrut('00000000-0000-4000-8000-0000000000a6', { photoUrl: '' })]);
  assert.equal(bizarres.plats.length, 6, 'aucun plat n’est écarté à cause de sa photo');
  assert.equal(bizarres.illisibles, 0);
  assert.deepEqual(bizarres.plats.map(p => p.photoUrl), [null, null, null, null, null, null], 'seule une adresse https propre est affichée');
  assert.equal(bizarres.plats[1].photoRef, 'http://x/y.jpg', 'le serveur a une photo, même non affichable : elle sert à comparer');
});

// ---------- corps de la requête ----------
test('corps D4c : l’envoi porte le plat et le fichier PRÉPARÉ, le retrait le plat et retirer=1 ; jamais de restaurant', () => {
  const p = platDe(menu([platBrut(P1, { photoUrl: PHOTO_A })]));
  const envoi = corpsDeAction(actionPhotoDefinir(p, fichier()));
  assert.deepEqual(envoi, { chemin: '/api/v1/restaurant/menu/photo', corps: { platId: P1 }, fichier: fichier() });
  assert.deepEqual(corpsDeAction(actionPhotoRetirer(p)), { chemin: '/api/v1/restaurant/menu/photo', corps: { platId: P1, retirer: '1' } });
  assert.ok(!JSON.stringify(envoi).includes('restaurant_id') && !JSON.stringify(envoi).includes('restaurantId'));
});
test('corps D4c : un fichier trop gros, vide, d’un autre type, un plat non UUID ou une action truquée ne produit AUCUN envoi', () => {
  const p = platDe(menu([platBrut(P1)]));
  for (const f of [fichier(CINQ_MO + 1), fichier(0), { ...fichier(), type: 'image/png' }, { ...fichier(), uri: '' }, null, undefined] as unknown[]) {
    assert.equal(corpsDeAction({ type: 'photo_definir', platId: P1, avant: null, fichier: f } as ActionService), null, JSON.stringify(f)?.slice(0, 50));
  }
  for (const platId of ['', 'abc', P1 + 'x', '../../x']) {
    assert.equal(corpsDeAction({ type: 'photo_definir', platId, avant: null, fichier: fichier() }), null, platId);
    assert.equal(corpsDeAction({ type: 'photo_retirer', platId, nom: 'x' }), null, platId);
  }
  assert.ok(corpsDeAction(actionPhotoDefinir(p, fichier())) !== null);
});

// ---------- confirmation et machine d’états ----------
test('machine D4c : retirer une photo passe par la confirmation (texte honnête : le plat reste en vente, sans image) ; envoyer une photo, non', () => {
  const p = platDe(menu([platBrut(P1, { photoUrl: PHOTO_A })]));
  const retrait = actionPhotoRetirer(p);
  assert.equal(peutEnvoyerService(ETAT_SERVICE_REPOS, retrait, 0), false, 'jamais sans confirmation');
  const c = evoluerService(ETAT_SERVICE_REPOS, { type: 'demander_confirmation', action: retrait, lecture: 0 });
  assert.equal(c.phase, 'confirmation');
  assert.equal(peutEnvoyerService(c, retrait, 0), true);
  assert.equal(evoluerService(c, { type: 'annuler_confirmation' }).phase, 'repos');
  const textes = confirmationDe(retrait)!;
  assert.deepEqual(textes, confirmationRetirerPhoto(p.nom));
  assert.ok(textes.question.includes('reste en vente') && textes.question.includes('sans image'));
  const envoi = actionPhotoDefinir(p, fichier());
  assert.equal(confirmationDe(envoi), null);
  assert.equal(peutEnvoyerService(ETAT_SERVICE_REPOS, envoi, 0), true);
});
test('machine D4c : bouton verrouillé pendant l’envoi et la relecture ; un seul envoi à la fois ; aucune relance automatique', () => {
  const p = platDe(menu([platBrut(P1)]));
  const a = actionPhotoDefinir(p, fichier());
  const e1 = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: a, lecture: 3 });
  assert.equal(e1.phase, 'envoi');
  assert.equal(serviceVerrouille(e1, 3), true);
  assert.equal(evoluerService(e1, { type: 'envoyer', action: a, lecture: 3 }), e1, 'un second envoi pendant l’envoi est ignoré');
  const e2 = evoluerService(e1, { type: 'repondre', erreur: null });
  assert.equal(e2.phase, 'relecture');
  assert.equal(serviceVerrouille(e2, 3), true);
  assert.equal(evoluerService(e2, { type: 'envoyer', action: a, lecture: 3 }), e2);
});

// ---------- verdicts : jamais « enregistré » sans que le serveur l’ait confirmé ----------
const incertain = () => new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood.', true);
const sansPhoto = () => menu([platBrut(P1, { photoUrl: null }), platBrut(P2)]);
const avecPhoto = (url = PHOTO_A) => menu([platBrut(P1, { photoUrl: url }), platBrut(P2)]);

test('verdict D4c envoi : réponse {ok:true} ET menu relu avec une photo différente = « Photo enregistrée »', () => {
  for (const [avant, relu] of [[null, avecPhoto()], [PHOTO_A, avecPhoto(PHOTO_B)]] as const) {
    const a = actionPhotoDefinir(platDe(avant === null ? sansPhoto() : avecPhoto(avant)), fichier());
    const v = verdictService({ erreur: null, action: a, relue: { menu: relu } });
    assert.deepEqual(v, { genre: 'confirme', message: 'Photo enregistrée.' });
  }
});
test('verdict D4c envoi : réponse {ok:true} mais menu relu SANS changement de photo = jamais « enregistré » (état différent signalé)', () => {
  const a = actionPhotoDefinir(platDe(avecPhoto()), fichier());
  const v = verdictService({ erreur: null, action: a, relue: { menu: avecPhoto() } });
  assert.equal(v.genre, 'incertain');
  assert.ok(!/enregistr/i.test(v.message.replace('enregistrée', '')) || v.genre === 'incertain');
  assert.equal(etatCorrespond(a, { menu: avecPhoto() }), false);
  const sans = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  assert.equal(etatCorrespond(sans, { menu: sansPhoto() }), false, 'toujours aucune photo = pas enregistré');
});
test('verdict D4c envoi : menu non relu = confirmé mais avec la mention « n’a pas pu être relu » ; réponse incertaine + menu non relu = verrouillé, pas de réessai', () => {
  const a = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  const ok = verdictService({ erreur: null, action: a, relue: {} });
  assert.equal(ok.genre, 'confirme'); assert.ok(ok.message.includes('n’a pas pu être relu'));
  const v = verdictService({ erreur: incertain(), action: a, relue: {} });
  assert.equal(v.genre, 'incertain'); assert.equal((v as { reessayer: boolean }).reessayer, false);
  assert.equal(serviceVerrouille({ phase: 'verdict', action: a, verdict: v, lectureVerdict: 4 }, 4), true, 'verrouillé tant que le menu n’a pas été relu');
  assert.equal(serviceVerrouille({ phase: 'verdict', action: a, verdict: v, lectureVerdict: 4 }, 5), false, 'libéré par une relecture réussie');
});
test('verdict D4c envoi : réponse incertaine puis menu relu avec une photo différente = confirmé (avec la réserve « autre appareil ») ; sans changement = JAMAIS « non enregistrée » ni réessai (une insertion tardive est possible), écran verrouillé jusqu’à relecture', () => {
  const a = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  assert.deepEqual(verdictService({ erreur: incertain(), action: a, relue: { menu: avecPhoto() } }), { genre: 'confirme', message: 'Une photo différente est maintenant enregistrée pour ce plat (la vôtre, sauf si elle a été changée depuis un autre appareil : vérifiez l’aperçu).' });
  const v = verdictService({ erreur: incertain(), action: a, relue: { menu: sansPhoto() } });
  assert.equal(v.genre, 'incertain'); assert.equal((v as { reessayer: boolean }).reessayer, false);
  assert.ok(v.message.includes('peut-être pas été enregistrée') && !v.message.includes('Vous pouvez réessayer'));
  const bloque = { phase: 'verdict' as const, action: a, verdict: v, lectureVerdict: 7 };
  assert.equal(serviceVerrouille(bloque, 7), true, 'verrouillé tant que le menu n’a pas été relu');
  assert.equal(serviceVerrouille(bloque, 8), false, 'libéré par une relecture réussie');
});
test('verdict D4c : « réessayer » seulement quand le bouton existe encore (plat disparu = refus ; photo déjà retirée = confirmé, pas de réessai)', () => {
  const envoi = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  const disparu = menu([platBrut(P2)]);
  assert.equal(boutonExiste(envoi, { menu: disparu }), false);
  const v = verdictService({ erreur: incertain(), action: envoi, relue: { menu: disparu } });
  assert.equal(v.genre, 'refus');
  const retrait = actionPhotoRetirer(platDe(avecPhoto()));
  assert.equal(boutonExiste(retrait, { menu: disparu }), false);
  const inconnu = verdictService({ erreur: incertain(), action: retrait, relue: { menu: disparu } });
  assert.equal(inconnu.genre, 'incertain', 'plat disparu : état inconnu, jamais « bien retirée »');
  assert.equal((inconnu as { reessayer: boolean }).reessayer, false);
  assert.equal(boutonExiste(retrait, { menu: sansPhoto() }), false, 'plus de photo = plus de bouton « Retirer la photo »');
  assert.deepEqual(verdictService({ erreur: incertain(), action: retrait, relue: { menu: sansPhoto() } }), { genre: 'confirme', message: 'La photo est bien retirée.' });
  assert.equal(boutonExiste(retrait, { menu: avecPhoto() }), true);
  const encore = verdictService({ erreur: incertain(), action: retrait, relue: { menu: avecPhoto() } });
  assert.equal(encore.genre, 'incertain'); assert.equal((encore as { reessayer: boolean }).reessayer, true);
});
test('verdict D4c retrait : confirmé seulement si le menu relu n’a plus de photo ; plat disparu = inconnu (jamais « bien retirée »)', () => {
  const a = actionPhotoRetirer(platDe(avecPhoto()));
  assert.deepEqual(verdictService({ erreur: null, action: a, relue: { menu: sansPhoto() } }), { genre: 'confirme', message: 'Photo retirée : le plat reste en vente, sans image.' });
  assert.equal(verdictService({ erreur: null, action: a, relue: { menu: avecPhoto() } }).genre, 'incertain', 'le serveur dit ok mais la photo est toujours là');
  assert.equal(etatCorrespond(a, { menu: menu([platBrut(P2)]) }), null);
  assert.equal(etatCorrespond(a, {}), null);
});
test('verdict D4c : refus certains (400, 404, 409, 413, 429) non incertains, sans texte du serveur ; 413 = photo trop volumineuse ; 403 sécurité = message vers le site ; 401 = session terminée', () => {
  const a = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  for (const statut of [400, 404, 409, 413, 429]) {
    const e = refusService(statut);
    assert.equal(e.incertain, false, String(statut));
    const v = verdictService({ erreur: e, action: a, relue: { menu: sansPhoto() } });
    assert.equal(v.genre, 'refus', String(statut));
    assert.ok(!/enregistr/.test(v.message), 'un refus n’est jamais présenté comme enregistré : ' + v.message);
  }
  assert.ok(refusService(413).message.includes('5 Mo'));
  assert.equal(refusService(500).incertain, true);
  assert.deepEqual(verdictService({ erreur: refusService(403, 'mfa'), action: a, relue: {} }), { genre: 'securite', message: MESSAGE_SECURITE });
  assert.equal(verdictService({ erreur: null, sessionTerminee: 'Votre session a pris fin.', action: a, relue: {} }).genre, 'session');
});

// ---------- client : multipart, un seul essai, rien d’invalide sur le réseau ----------
type Appel = { url: string; options: RequestInit };
function api(repondre: (appel: Appel) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const appels: Appel[] = [];
  const a = creerAuth(async (url, options) => { const appel = { url: String(url), options: options ?? {} }; appels.push(appel); return repondre(appel); }, 20000,
    (f) => new File([new Uint8Array([0xff, 0xd8, 0xff])], f.nom, { type: f.type }));
  return { a, appels };
}
const json = (corps: unknown, status = 200) => Response.json(corps, { status });

test('client D4c : envoi = UN POST multipart sur /menu/photo avec le jeton porteur, les champs platId et photo seulement, sans Content-Type écrit à la main, sans cookie', async () => {
  const { a, appels } = api();
  await a.ecrireService(ACCES, actionPhotoDefinir(platDe(sansPhoto()), fichier()));
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, API + '/api/v1/restaurant/menu/photo');
  assert.equal(appels[0].options.method, 'POST');
  assert.equal(appels[0].options.credentials, 'omit');
  const entetes = appels[0].options.headers as Record<string, string>;
  assert.equal(entetes.Authorization, 'Bearer ' + ACCES);
  assert.ok(!('Content-Type' in entetes), 'la frontière du multipart est posée par le système');
  const corps = appels[0].options.body as FormData;
  assert.ok(corps instanceof FormData);
  assert.deepEqual([...corps.keys()].sort(), ['photo', 'platId']);
  assert.equal(corps.get('platId'), P1);
  const photo = corps.get('photo') as File;
  assert.equal(photo.type, 'image/jpeg'); assert.equal(photo.name, 'photo.jpg');
});
test('client D4c : retrait = UN POST multipart avec platId et retirer=1, sans fichier', async () => {
  const { a, appels } = api();
  await a.ecrireService(ACCES, actionPhotoRetirer(platDe(avecPhoto())));
  assert.equal(appels.length, 1);
  const corps = appels[0].options.body as FormData;
  assert.deepEqual([...corps.keys()].sort(), ['platId', 'retirer']);
  assert.equal(corps.get('retirer'), '1'); assert.equal(corps.get('platId'), P1);
});
test('client D4c : un fichier trop gros, vide, d’un autre type ou un plat invalide n’atteint JAMAIS le réseau', async () => {
  const p = platDe(sansPhoto());
  for (const f of [fichier(CINQ_MO + 1), fichier(0), { ...fichier(), type: 'image/png' }, { ...fichier(), uri: '' }, { ...fichier(), nom: 'x.jpg' }] as unknown[]) {
    const { a, appels } = api();
    await assert.rejects(a.ecrireService(ACCES, { type: 'photo_definir', platId: p.id, avant: null, fichier: f } as ActionService), ErreurRestaurateur);
    assert.equal(appels.length, 0, JSON.stringify(f).slice(0, 60));
  }
  const { a, appels } = api();
  await assert.rejects(a.ecrireService(ACCES, { type: 'photo_retirer', platId: 'pas-un-uuid', nom: 'x' }), ErreurRestaurateur);
  assert.equal(appels.length, 0);
});
test('client D4c : panne réseau ou 5xx = réponse incertaine, UN SEUL appel (jamais de relance automatique) ; 413 et 400 = refus certains', async () => {
  const a1 = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  for (const repondre of [() => { throw new TypeError('réseau'); }, () => json({}, 500), () => json({}, 502), () => new Response('pas du json', { status: 200 }), () => json({ ok: false })] as Array<() => Response>) {
    const { a, appels } = api(repondre);
    await assert.rejects(a.ecrireService(ACCES, a1), (e: unknown) => e instanceof ErreurRestaurateur && e.incertain === true);
    assert.equal(appels.length, 1);
  }
  for (const statut of [400, 413]) {
    const { a, appels } = api(() => json({ ok: false, erreur: { code: 'VALIDATION', message: 'detail-confidentiel-serveur' } }, statut));
    await assert.rejects(a.ecrireService(ACCES, a1), (e: unknown) => e instanceof ErreurRestaurateur && !e.incertain && !e.message.includes('detail-confidentiel-serveur'));
    assert.equal(appels.length, 1);
  }
});
test('client D4c : le 403 de sécurité du compte et le 401 sont traités comme pour les autres écritures', async () => {
  const a1 = actionPhotoDefinir(platDe(sansPhoto()), fichier());
  for (const raison of ['mfa', 'questions']) {
    const { a } = api(() => json({ ok: false, erreur: { code: 'NON_AUTORISE', message: 'texte serveur', champs: { securite: raison } } }, 403));
    await assert.rejects(a.ecrireService(ACCES, a1), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'securite' && e.raison === raison && e.message === MESSAGE_SECURITE);
  }
  const { a } = api(() => json({ ok: false }, 401));
  await assert.rejects(a.ecrireService(ACCES, a1), (e: unknown) => (e as { definitive?: boolean }).definitive === true);
});

// ---------- écran et branchement natif (lecture du texte source) ----------
const ecran = readFileSync(new URL('../src/connexion/ServiceMenuReel.tsx', import.meta.url), 'utf8');
const natif = readFileSync(new URL('../src/connexion/photoPlatNatif.ts', import.meta.url), 'utf8');
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo as { plugins: unknown[]; android: Record<string, unknown> };

test('écran D4c : « Ajouter / Changer la photo » et « Retirer la photo » par plat ; le retrait passe par la confirmation ; l’aperçu vient de l’adresse du serveur', () => {
  assert.ok(ecran.includes("(p.photoRef === null ? 'Ajouter une photo à ' : 'Changer la photo de ') + p.nom"));
  assert.ok(ecran.includes("{p.photoRef !== null && <Action titre={'Retirer la photo de ' + p.nom}"), 'pas de bouton « Retirer » sans photo');
  assert.ok(ecran.includes("appliquer({ type: 'demander_confirmation', action: actionPhotoRetirer(p), lecture: lectureVerrou })"));
  assert.ok(ecran.includes("confirmation?.type === 'photo_retirer' && confirmation.platId === p.id"));
  assert.ok(ecran.includes('<Image source={{ uri: p.photoUrl }}') && ecran.includes('onError='), 'aperçu avec repli si l’image est illisible');
});
test('écran D4c : annuler le sélecteur ne fait RIEN (ni envoi ni message) ; une permission refusée affiche son message ; l’envoi passe par `envoyer` (un seul essai, relecture, verdict)', () => {
  assert.ok(ecran.includes("if (!actif.current || choix.genre === 'annule') return;"), 'annulation = retour silencieux');
  const bloc = ecran.slice(ecran.indexOf('async function prendrePhoto'), ecran.indexOf('const lectureVerrou'));
  assert.ok(bloc.includes('else setMessagePhoto({ platId: plat.id, texte: choix.message })'), 'refus et permission refusée = message fixe');
  assert.ok(bloc.includes('await envoyer(action)') && !bloc.includes('gestion.'), 'la photo passe par envoyer(), jamais directement par la session');
  assert.ok(bloc.includes('actionPhotoDefinir(courant, choix.fichier)'), 'l’état « avant » est la photo de la dernière lecture');
  assert.ok(bloc.includes('serviceVerrouille(etatRef.current') && bloc.includes('selectionEnCours.current'), 'verrou : pas de second sélecteur, pas de photo pendant un envoi ou après une réponse incertaine');
  const boutons = ecran.match(/<Action [^\n]*/g) ?? [];
  assert.deepEqual(boutons.filter(b => !/disabled=\{/.test(b)), [], 'chaque bouton a une condition de désactivation');
  assert.ok(boutons.filter(b => /photo|galerie/i.test(b)).every(b => /bloque|selection/.test(b)), 'les boutons de photo sont verrouillés par le verrou général et le sélecteur');
});
test('écran D4c : aucun libellé « espèces » ; aucun accès réseau direct (tout passe par la session)', () => {
  assert.ok(!/esp[eè]ces|cash/i.test(ecran + natif));
  assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\//.test(ecran), 'l’écran n’appelle aucune adresse');
});
test('natif D4c : sélecteur système (aucune permission de stockage), appareil photo seulement à l’usage, images seules, sans EXIF, JPEG compressé ; aucune adresse réseau', () => {
  assert.ok(natif.includes("mediaTypes: ['images']") && natif.includes('allowsMultipleSelection: false') && natif.includes('exif: false'));
  assert.ok(natif.includes('requestCameraPermissionsAsync') && !natif.includes('requestMediaLibraryPermissionsAsync') && !/getMediaLibraryPermissions/.test(natif), 'aucune permission de médiathèque');
  assert.ok(natif.includes('SaveFormat.JPEG') && natif.includes('compress: qualite'));
  assert.ok(!/https?:\/\//.test(natif.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucune adresse réseau');
  assert.equal((natif.match(/fetch\(/g) ?? []).length, 1, 'un seul fetch, sur le fichier local, pour lire sa taille');
  assert.ok(natif.includes('await fetch(uri)'));
});
test('app.json D4c : le plugin du sélecteur est déclaré SANS microphone ; aucune permission Android de stockage ou d’enregistrement n’est ajoutée à la main', () => {
  const plugin = appJson.plugins.find(p => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined;
  assert.ok(plugin, 'plugin expo-image-picker déclaré');
  assert.equal(plugin![1].microphonePermission, false);
  assert.equal(typeof plugin![1].cameraPermission, 'string');
  assert.equal(appJson.android.permissions, undefined, 'aucune permission Android écrite à la main (le plugin ajoute la caméra seulement)');
});

test('écran D4c : une photo choisie pendant un autre envoi n’est jamais abandonnée en silence (message), et le garde de prendrePhoto est épinglé', () => {
  const bloc = ecran.slice(ecran.indexOf('async function prendrePhoto'), ecran.indexOf('const lectureVerrou'));
  assert.ok(bloc.startsWith('async function prendrePhoto') && bloc.includes('if (selectionEnCours.current || envoiEnCours.current || lectureEnCours.current || serviceVerrouille('), 'garde au début');
  const apres = bloc.slice(bloc.indexOf('if (action !== null && actif.current)'));
  assert.ok(apres.indexOf('Un autre changement est en cours') > 0 && apres.indexOf('Un autre changement est en cours') < apres.indexOf('await envoyer(action)'), 'message AVANT l’envoi');
  assert.ok(apres.includes('envoiEnCours.current || lectureEnCours.current || serviceVerrouille('));
});
test('app.json D4c : les permissions de stockage ajoutées par la bibliothèque sont BLOQUÉES', () => {
  assert.deepEqual([...(appJson.android.blockedPermissions as string[])].sort(), ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']);
});
