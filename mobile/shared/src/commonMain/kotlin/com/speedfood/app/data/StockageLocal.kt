package com.speedfood.app.data

/**
 * Stockage local clé/valeur de l'application (session, commandes passées depuis cet appareil). Chaque plateforme fournit le sien : Android (fichier privé
 * de l'application), iPhone (préférences de l'application), ordinateur (préférences de l'utilisateur, aperçu seulement).
 *
 * Aucun mot de passe n'y est jamais écrit : seulement la session (jetons) et les références de commandes. Chiffrement par le coffre du système
 * (Android Keystore, Trousseau iOS) : amélioration prévue avant la publication sur les magasins (voir docs/NATIF-PLAN.md).
 */
interface StockageLocal {
    fun lire(cle: String): String?
    fun ecrire(cle: String, valeur: String)
    fun effacer(cle: String)
}

/** Stockage en mémoire : tests et repli. Rien ne survit à la fermeture de l'application. */
class StockageMemoire : StockageLocal {
    private val valeurs = mutableMapOf<String, String>()
    override fun lire(cle: String): String? = valeurs[cle]
    override fun ecrire(cle: String, valeur: String) {
        valeurs[cle] = valeur
    }
    override fun effacer(cle: String) {
        valeurs.remove(cle)
    }
}
