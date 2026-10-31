// Hook de résolution des tests : un import relatif sans extension, écrit dans un fichier .ts, vise le fichier « .ts » voisin.
// Les règles partagées s'écrivent sans extension (Next et le lanceur du site les attendent ainsi) ; Node, lui, exige l'extension.
export async function resolve(specifieur, contexte, suivant) {
  try {
    return await suivant(specifieur, contexte);
  } catch (erreur) {
    const relatif = specifieur.startsWith("./") || specifieur.startsWith("../");
    if (relatif && erreur?.code === "ERR_MODULE_NOT_FOUND" && !/\.[a-z]+$/i.test(specifieur)) {
      return suivant(`${specifieur}.ts`, contexte);
    }
    throw erreur;
  }
}
