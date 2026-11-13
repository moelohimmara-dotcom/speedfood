package com.speedfood.veille

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Pont TypeScript de la veille native (prototype, compilation CI requise). Aucun jeton ne traverse ce pont :
 * le TypeScript décide (logique de surveillance testée) et envoie les positions par sa session.
 */
class SpeedfoodVeilleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SpeedfoodVeille")

    Events("onPosition")

    OnCreate {
      SuiviLivreurService.emetteur = { latitude, longitude ->
        sendEvent("onPosition", mapOf("latitude" to latitude, "longitude" to longitude))
      }
    }

    OnDestroy {
      SuiviLivreurService.emetteur = null
    }

    AsyncFunction("DemarrerVeilleRestaurateur") {
      val contexte = appContext.reactContext
      if (contexte == null) {
        false
      } else {
        VeilleRestaurateurService.demarrer(contexte)
        true
      }
    }

    AsyncFunction("AlerterVeilleRestaurateur") { nombre: Int, reference: String ->
      val contexte = appContext.reactContext
      if (contexte == null) {
        false
      } else {
        VeilleRestaurateurService.alerter(contexte, nombre, reference)
        true
      }
    }

    AsyncFunction("ArreterVeilleRestaurateur") {
      val contexte = appContext.reactContext
      if (contexte == null) {
        false
      } else {
        VeilleRestaurateurService.arreter(contexte)
        true
      }
    }

    AsyncFunction("DemarrerSuiviLivreur") {
      val contexte = appContext.reactContext
      if (contexte == null) {
        false
      } else {
        SuiviLivreurService.demarrer(contexte)
        true
      }
    }

    AsyncFunction("ArreterSuiviLivreur") {
      val contexte = appContext.reactContext
      if (contexte == null) {
        false
      } else {
        SuiviLivreurService.arreter(contexte)
        true
      }
    }
  }
}
