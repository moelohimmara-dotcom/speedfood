package com.speedfood.app

import com.speedfood.app.data.cleZoneAccueil
import kotlin.test.Test
import kotlin.test.assertEquals

class OnboardingTest {
    @Test
    fun visiteGuideeTientEnDeuxEcransEtZoneEstNommee() {
        assertEquals(2, com.speedfood.app.ui.NOMBRE_DIAPOS)
        assertEquals("zone-kaloum", cleZoneAccueil("kaloum"))
    }
}
