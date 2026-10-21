package com.speedfood.app

import android.app.Application
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.di.initKoin

class SpeedfoodApp : Application() {
    override fun onCreate() {
        super.onCreate()
        config = SpeedfoodConfig(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
            siteUrl = BuildConfig.SITE_URL,
        )
        initKoin(config)
    }

    companion object {
        lateinit var config: SpeedfoodConfig
            private set
    }
}
