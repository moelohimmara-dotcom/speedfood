plugins {
    alias(libs.plugins.kotlinJvm)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
}

dependencies {
    implementation(projects.shared)

    implementation(compose.desktop.currentOs)
    implementation(libs.kotlinx.coroutines.swing)

    implementation(libs.compose.uiToolingPreview)
}

// Aperçu de l'interface sur ordinateur (travail sans émulateur) : `gradlew :desktopApp:run`.
compose.desktop {
    application {
        mainClass = "com.speedfood.app.MainKt"
    }
}
