import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL as NodeURL, fileURLToPath, pathToFileURL } from 'node:url';
import { codeEchecPhoto, creerAuth, fichierDeFormulaireNatif, formulaireEnvoyable, octetsDePhotoValides } from '../src/connexion/client.ts';
import { ErreurRestaurateur } from '../src/connexion/restaurateur.ts';
import { ETAT_SERVICE_REPOS, actionPhotoDefinir, evoluerService, lireMenuRestaurateur, serviceVerrouille, type FichierPhotoPrete } from '../src/connexion/serviceRestaurateur.ts';

/**
 * Correction D4c du 4 novembre 2026 : l'envoi de la photo n'atteignait jamais l'API (APK release, Android 14, Expo SDK 57).
 * Cause : le `fetch` global est `expo/fetch`, qui refuse le fichier `{ uri, name, type }` de React Native AVANT d'envoyer un octet.
 * Ces tests font tourner le VRAI code de conversion du formulaire d'Expo (copié depuis node_modules/expo, jamais réécrit ici) :
 * le formulaire du téléphone est un FormData React Native auquel Expo ajoute ses méthodes (`installFormDataPatch`).
 */
const EXPO = new NodeURL('../../../node_modules/expo/src/', import.meta.url);
let convertFormDataAsync: (f: FormData) => Promise<{ body: Uint8Array; boundary: string }>;
let FormDataTelephone: typeof FormData;

before(async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'speedfood-expo-'));
  mkdirSync(join(dossier, 'winter'), { recursive: true });
  copyFileSync(fileURLToPath(new NodeURL('utils/blobUtils.ts', EXPO)),  join(dossier, 'blobUtils.ts'));
  copyFileSync(fileURLToPath(new NodeURL('winter/FormData.ts', EXPO)),  join(dossier, 'winter', 'FormData.ts'));
  writeFileSync(join(dossier, 'convertFormData.ts'), readFileSync(fileURLToPath(new NodeURL('winter/fetch/convertFormData.ts', EXPO)),  'utf8').replace("'../../utils/blobUtils'", "'./blobUtils.ts'"));
  const conversion = await import(pathToFileURL(join(dossier, 'convertFormData.ts')).href);
  const patch = await import(pathToFileURL(join(dossier, 'winter', 'FormData.ts')).href);
  convertFormDataAsync = conversion.convertFormDataAsync;
  // Le FormData de React Native (Libraries/Network/FormData.js) : une liste `_parts`, un `append` à deux arguments, pas de `entries`.
  class FormDataReactNative { _parts: Array<[string, unknown]> = []; append(cle: string, valeur: unknown) { this._parts.push([cle, valeur]); } }
  patch.installFormDataPatch(FormDataReactNative);
  FormDataTelephone = FormDataReactNative as unknown as typeof FormData;
  globalThis.FormData = FormDataTelephone;
});

const P1 = '00000000-0000-4000-8000-0000000000a1';
const ACCES = 'jeton-factice-ne-doit-jamais-sortir';
const URI = 'file:///data/user/0/app/cache/ImageManipulator/secret-uri.jpg';
const fichier = (): FichierPhotoPrete => ({ uri: URI, size: 200_000, type: 'image/jpeg', nom: 'photo.jpg' });
const plat = () => lireMenuRestaurateur({ ok: true, sections: [], plats: [{ id: P1, nom: 'Plat', description: '', prix: 45000, prixPromo: null, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z', sectionId: null, photoUrl: null, options: [] }] }).plats[0];
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
const texte = (o: Uint8Array) => Buffer.from(o).toString('latin1');

/** Le `fetch` du téléphone : il convertit le formulaire EXACTEMENT comme `expo/fetch` avant d'ouvrir la connexion ; s'il le refuse, rien n'est envoyé. */
function fetchExpo(journal: { envois: Uint8Array[]; appels: number }) {
  return async (_url: unknown, init?: RequestInit) => {
    journal.appels++;
    const { body } = await convertFormDataAsync(init!.body as FormData);
    journal.envois.push(body);
    return Response.json({ ok: true });
  };
}

test('cause démontrée : le fichier { uri, name, type } de React Native est refusé par la conversion d’expo/fetch AVANT tout envoi', async () => {
  const f = new FormDataTelephone();
  f.append('platId', P1);
  f.append('photo', { uri: URI, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  await assert.rejects(convertFormDataAsync(f), /Unsupported FormDataPart implementation/);
  assert.equal(formulaireEnvoyable(f), false, 'la garde locale reconnaît cette forme avant le réseau');
});

test('correction : la photo part en multipart avec ses OCTETS (nom, type JPEG, contenu), lus avant l’envoi ; un seul appel', async () => {
  const lectures: string[] = [];
  const fetchGlobalAvant = globalThis.fetch;
  globalThis.fetch = (async (u: unknown) => { lectures.push(String(u)); return new Response(JPEG); }) as typeof fetch;
  const journal = { envois: [] as Uint8Array[], appels: 0 };
  try {
    // Le lecteur NATIF réel (celui du téléphone), avec la lecture locale simulée.
    const a = creerAuth(fetchExpo(journal) as typeof fetch, 20000, fichierDeFormulaireNatif);
    await a.ecrireService(ACCES, actionPhotoDefinir(plat(), fichier()));
  } finally { globalThis.fetch = fetchGlobalAvant; }
  assert.deepEqual(lectures, [URI], 'le fichier local est lu avant l’envoi');
  assert.equal(journal.appels, 1);
  const corps = texte(journal.envois[0]);
  assert.match(corps, /name="platId"\r\n\r\n00000000-0000-4000-8000-0000000000a1\r\n/);
  assert.match(corps, /name="photo"; filename="photo\.jpg"\r\ncontent-type: image\/jpeg\r\n\r\n\xff\xd8\xff\xe0\x01\x02\x03\x04\x05\r\n/);
  assert.ok(!corps.includes('secret-uri'), 'l’adresse locale du fichier ne part jamais');
});

test('échec LOCAL : lecture impossible, fichier vide, trop gros ou pas du JPEG = rien n’est envoyé, erreur « local » NON incertaine, message sans adresse ni jeton', async () => {
  const mauvais: Array<[string, () => Promise<{ name: string; type: string; size: number; bytes(): Promise<Uint8Array> }>]> = [
    ['lecture impossible', async () => { throw new Error('ENOENT ' + URI + ' ' + ACCES); }],
    ['vide', async () => ({ name: 'photo.jpg', type: 'image/jpeg', size: 0, bytes: async () => new Uint8Array(0) })],
    ['pas du JPEG', async () => ({ name: 'photo.jpg', type: 'image/jpeg', size: 4, bytes: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]) })],
    ['trop gros', async () => ({ name: 'photo.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 + 1, bytes: async () => { const o = new Uint8Array(5 * 1024 * 1024 + 1); o.set([0xff, 0xd8, 0xff]); return o; } })],
    ['octets illisibles', async () => ({ name: 'photo.jpg', type: 'image/jpeg', size: 3, bytes: async () => { throw new Error('boom'); } })],
  ];
  for (const [nom, lecteur] of mauvais) {
    const journal = { envois: [] as Uint8Array[], appels: 0 };
    const a = creerAuth(fetchExpo(journal) as typeof fetch, 20000, lecteur);
    await assert.rejects(a.ecrireService(ACCES, actionPhotoDefinir(plat(), fichier())), (e: unknown) => {
      assert.ok(e instanceof ErreurRestaurateur, nom);
      assert.equal(e.genre, 'local', nom); assert.equal(e.incertain, false, nom);
      assert.match(e.message, /rien n’a été enregistré/); assert.match(e.message, /\(code : lecture\)/);
      assert.ok(!e.message.includes('secret-uri') && !e.message.includes(ACCES) && !e.message.includes('ENOENT'), nom);
      return true;
    });
    assert.equal(journal.appels, 0, nom + ' : aucun appel réseau');
  }
});

test('échec local détecté APRÈS la préparation : le fetch refuse la forme du formulaire (avant tout octet) = local, jamais incertain ; une vraie panne réseau = incertain avec code', async () => {
  const refus = creerAuth((async () => { throw new Error('Unsupported FormDataPart implementation'); }) as typeof fetch, 20000, async f => ({ name: f.nom, type: f.type, size: 3, bytes: async () => JPEG }));
  await assert.rejects(refus.ecrireService(ACCES, actionPhotoDefinir(plat(), fichier())), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'local' && !e.incertain && /\(code : formulaire\)/.test(e.message));
  for (const panne of [new TypeError('Network request failed'), new Error('Network request failed')]) {
    let appels = 0;
    const reseau = creerAuth((async () => { appels++; throw panne; }) as typeof fetch, 20000, async f => ({ name: f.nom, type: f.type, size: 3, bytes: async () => JPEG }));
    await assert.rejects(reseau.ecrireService(ACCES, actionPhotoDefinir(plat(), fichier())), (e: unknown) => e instanceof ErreurRestaurateur && e.genre === 'reseau' && e.incertain && /\(code : reseau\)/.test(e.message) && !e.message.includes('Network request'));
    assert.equal(appels, 1, 'un seul essai');
  }
  assert.equal(codeEchecPhoto(new Error('x'), true), 'delai', 'le délai de 60 s est reconnu');
  assert.equal(codeEchecPhoto(new Error('Unsupported FormData implementation'), false), 'formulaire');
  assert.equal(codeEchecPhoto('autre chose', false), 'reseau');
});

test('garde : formulaireEnvoyable accepte chaînes et fichiers à octets, refuse toute autre forme ; octetsDePhotoValides exige 1 octet à 5 Mo et la signature JPEG', () => {
  const bon = new FormDataTelephone(); bon.append('platId', P1); bon.append('photo', { name: 'photo.jpg', type: 'image/jpeg', size: 3, bytes: async () => JPEG } as unknown as Blob);
  assert.equal(formulaireEnvoyable(bon), true);
  for (const valeur of [{ uri: URI, name: 'photo.jpg', type: 'image/jpeg' }, { name: 'photo.jpg', type: 'image/jpeg', bytes: 'pas une fonction' }, { type: 'image/jpeg', bytes: async () => JPEG }, null]) {
    const f = new FormDataTelephone(); f.append('photo', valeur as unknown as Blob);
    assert.equal(formulaireEnvoyable(f), false, JSON.stringify(valeur));
  }
  assert.equal(octetsDePhotoValides(JPEG), true);
  assert.equal(octetsDePhotoValides(new Uint8Array(0)), false);
  assert.equal(octetsDePhotoValides(new Uint8Array([0xff, 0xd8])), false);
  assert.equal(octetsDePhotoValides(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
});

test('machine : un échec local libère l’écran (verdict « refus » honnête, aucun verrou) ; une réponse incertaine après envoi verrouille toujours jusqu’à la relecture', async () => {
  const a = actionPhotoDefinir(plat(), fichier());
  const local = new ErreurRestaurateur('local', 'La photo n’a pas pu être préparée pour l’envoi : rien n’a été enregistré.', false);
  const parcours = (erreur: ErreurRestaurateur) => {
    let e = evoluerService(ETAT_SERVICE_REPOS, { type: 'envoyer', action: a, lecture: 1 });
    e = evoluerService(e, { type: 'repondre', erreur });
    // Relecture du menu réussie, sans nouvelle photo (le compteur de lectures passe de 1 à 2).
    const relue = lireMenuRestaurateur({ ok: true, sections: [], plats: [{ id: P1, nom: 'Plat', description: '', prix: 45000, prixPromo: null, disponible: true, confirmeLe: '2026-11-03T08:00:00.000Z', sectionId: null, photoUrl: null, options: [] }] });
    return evoluerService(e, { type: 'relire', relue: { menu: relue }, lecture: 2 });
  };
  const apresLocal = parcours(local);
  assert.equal(apresLocal.phase, 'verdict');
  if (apresLocal.phase === 'verdict') { assert.equal(apresLocal.verdict.genre, 'refus'); assert.match(apresLocal.verdict.message, /rien n’a été enregistré/); }
  assert.equal(serviceVerrouille(apresLocal, 2), false, 'échec local : l’écran est déverrouillé, on peut choisir une photo');
  const apresReseau = parcours(new ErreurRestaurateur('reseau', 'Impossible de joindre Speedfood pour envoyer la photo.', true));
  if (apresReseau.phase === 'verdict') assert.equal(apresReseau.verdict.genre, 'incertain');
  assert.equal(serviceVerrouille(apresReseau, 2), true, 'règle D4c inchangée : verrouillé jusqu’à une relecture réussie');
});
