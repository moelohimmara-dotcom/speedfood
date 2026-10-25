package com.speedfood.app.data

/**
 * Nom et téléphone saisis dans le formulaire de commande, gardés EN MÉMOIRE seulement (jamais sur le disque) le temps d'aller créer un compte :
 * l'écran de création les reprend au lieu de les redemander. Perdus à la fermeture de l'application, comme un brouillon.
 */
object BrouillonContact {
    var nom: String = ""
        private set
    var telephone: String = ""
        private set

    fun garder(nom: String, telephone: String) {
        this.nom = nom.trim()
        this.telephone = telephone.trim()
    }

    fun vider() {
        nom = ""
        telephone = ""
    }
}
