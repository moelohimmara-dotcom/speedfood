package com.speedfood.app.data

/**
 * Normalise un numéro guinéen en « +224XXXXXXXXX » (9 chiffres commençant par 6 ou 7), ou null s'il est invalide. Même règle que le serveur
 * (`src/lib/commande/telephone.ts`) : le serveur revérifie toujours, ceci ne sert qu'à répondre plus vite à la personne.
 */
fun normaliserTelephone(brut: String): String? {
    val chiffres = brut.replace(Regex("[\\s.\\-()]"), "")
    Regex("^(?:\\+|00)?224(?:0)?([67]\\d{8})$").find(chiffres)?.let { return "+224" + it.groupValues[1] }
    Regex("^0?([67]\\d{8})$").find(chiffres)?.let { return "+224" + it.groupValues[1] }
    return null
}
