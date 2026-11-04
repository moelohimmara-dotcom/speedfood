import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { DepsPhoto, SourcePhoto } from './photoPlat';

/**
 * Lot D4c : le branchement du domaine `photoPlat.ts` sur le téléphone (Expo). Aucune règle ici : les règles (annulation, permission, réduction, taille) sont dans `photoPlat.ts` et testées.
 *
 *  - Galerie : le sélecteur SYSTÈME (aucune permission de stockage demandée). Appareil photo : permission « appareil photo » seulement, demandée au moment de l'usage.
 *  - Une seule image, jamais de vidéo, sans données EXIF (pas de position GPS dans la photo envoyée).
 *  - Aucun réseau : la lecture de la taille se fait sur le fichier local.
 */
export const depsPhotoNatives: DepsPhoto = {
  async demanderCamera() {
    const reponse = await ImagePicker.requestCameraPermissionsAsync();
    return reponse.granted === true;
  },
  async ouvrir(source: SourcePhoto) {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsMultipleSelection: false, allowsEditing: false, exif: false, quality: 1 };
    const resultat = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (resultat.canceled || !resultat.assets || resultat.assets.length === 0) return { annule: true as const };
    const image = resultat.assets[0];
    return { annule: false as const, uri: image.uri, largeur: image.width, hauteur: image.height };
  },
  async reduire(uri, largeur, hauteur, _coteLong, qualite) {
    const contexte = ImageManipulator.manipulate(uri);
    // `largeur` et `hauteur` sont déjà les dimensions d'arrivée (côté long ramené à la limite, jamais agrandi, proportions gardées).
    const image = await (hauteur > 0 ? contexte.resize({ width: largeur, height: hauteur }) : contexte.resize({ width: largeur })).renderAsync();
    const resultat = await image.saveAsync({ compress: qualite, format: SaveFormat.JPEG });
    return { uri: resultat.uri };
  },
  async taille(uri) {
    const reponse = await fetch(uri);
    const blob = await reponse.blob();
    return blob.size;
  },
};
