package com.speedfood.app.data

/** Photo choisie par la personne, déjà réduite (JPEG) pour un envoi rapide sur le réseau mobile. */
class PhotoChoisie(val octets: ByteArray, val type: String = "image/jpeg")

sealed interface ResultatPhoto {
    class Choisie(val photo: PhotoChoisie) : ResultatPhoto

    /** La personne a refermé le choix sans rien sélectionner. */
    data object Annule : ResultatPhoto

    data class Erreur(val message: String) : ResultatPhoto
}

/**
 * Choix d'une photo dans la galerie du téléphone (sélecteur du système : l'application n'a besoin d'aucune autorisation d'accès aux photos). La plateforme réduit l'image
 * (côté 1 280 px au plus, JPEG) avant de la rendre : une photo de téléphone fait souvent 4 à 10 Mo, trop pour un réseau lent.
 */
interface SelecteurPhoto {
    val disponible: Boolean

    /** Ouvre le sélecteur et rend la photo réduite. Ne lève jamais d'exception. */
    suspend fun choisir(): ResultatPhoto
}

class PhotoIndisponible : SelecteurPhoto {
    override val disponible = false
    override suspend fun choisir(): ResultatPhoto = ResultatPhoto.Erreur("Le choix de photo n'est pas disponible sur cet appareil.")
}
