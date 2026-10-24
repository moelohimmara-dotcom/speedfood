package com.speedfood.app

import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.Plat
import com.speedfood.app.data.totalPlat
import kotlin.test.Test
import kotlin.test.assertEquals

class FichePlatTest {
    @Test
    fun totalInclutOptionsEtQuantite() {
        val plat = Plat("p", "Riz", prix = 25_000, options = listOf(OptionPlat("o", "Poulet", 5_000)))
        assertEquals(60_000, totalPlat(plat, plat.options, 2))
    }
}
