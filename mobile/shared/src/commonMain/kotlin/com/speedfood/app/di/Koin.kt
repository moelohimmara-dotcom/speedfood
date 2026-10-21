package com.speedfood.app.di

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorRestaurantApi
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.ui.RestaurantsViewModel
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import org.koin.core.context.startKoin
import org.koin.core.module.dsl.factoryOf
import org.koin.dsl.module

fun modulesApplication(config: SpeedfoodConfig) = listOf(
    module {
        single { config }
        single {
            HttpClient {
                install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
                // Réseau mobile lent à Conakry : on attend, mais pas indéfiniment.
                install(HttpTimeout) {
                    requestTimeoutMillis = 20_000
                    connectTimeoutMillis = 10_000
                }
            }
        }
        single<RestaurantApi> { KtorRestaurantApi(get(), get()) }
        factoryOf(::RestaurantsViewModel)
    },
)

fun initKoin(config: SpeedfoodConfig) {
    startKoin { modules(modulesApplication(config)) }
}
