# Surveillance de disponibilite de Speedfood, sur le poste de la proprietaire.
# LECTURE SEULE : des requetes GET anonymes sur quelques pages publiques, rien d'autre. Aucun compte, aucun secret, aucun service externe.
# Une alerte (notification Windows) n'est envoyee qu'apres deux controles consecutifs en echec (au moins 5 minutes), pour ne pas crier pour un incident d'une seconde.
# Elle surveille aussi l'age du dernier export de sauvegarde (le 11 octobre 2026, la tache d'export a echoue pendant 6 jours sans que personne le sache).
# Journal et etat : %USERPROFILE%\speedfood-surveillance (hors du depot). Voir docs/SURVEILLANCE.md.
param(
    [switch]$SansNotification,
    [switch]$NotificationDEssai
)

$ErrorActionPreference = "Stop"
$base = "https://speedfood-app.moelohimmara.workers.dev"
$pages = @(
    @{ Chemin = "/"; Attendu = "ok" },
    @{ Chemin = "/restaurants"; Attendu = "ok" },
    @{ Chemin = "/connexion"; Attendu = "ok" },
    # Sans session, /restaurant redirige vers /connexion : une redirection prouve que le Worker repond et execute son code.
    @{ Chemin = "/restaurant"; Attendu = "redirection" }
)
$delaiMaxSecondes = 20
$ageMaxExportJours = 8

$dossier = Join-Path $env:USERPROFILE "speedfood-surveillance"
$journal = Join-Path $dossier "journal.log"
$fichierEtat = Join-Path $dossier "etat.json"
if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier | Out-Null }

function Ecrire-Journal([string]$texte) {
    $ligne = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $texte
    Add-Content -Path $journal -Value $ligne -Encoding UTF8
    # Le journal garde les 2000 dernieres lignes.
    $lignes = Get-Content -Path $journal -Encoding UTF8
    if ($lignes.Count -gt 2000) { $lignes | Select-Object -Last 2000 | Set-Content -Path $journal -Encoding UTF8 }
}

function Envoyer-Notification([string]$titre, [string]$texte) {
    if ($SansNotification) { Ecrire-Journal "notification (non envoyee) : $titre - $texte"; return }
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $t = [System.Security.SecurityElement]::Escape($titre)
        $x = [System.Security.SecurityElement]::Escape($texte)
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml("<toast scenario='reminder'><visual><binding template='ToastGeneric'><text>$t</text><text>$x</text></binding></visual></toast>")
        $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
        $identifiant = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($identifiant).Show($toast)
        Ecrire-Journal "notification envoyee : $titre"
    } catch {
        Ecrire-Journal "notification impossible : $($_.Exception.Message)"
    }
}

function Tester-Page($page) {
    $chrono = [System.Diagnostics.Stopwatch]::StartNew()
    $code = 0
    try {
        $reponse = Invoke-WebRequest -Uri ($base + $page.Chemin + "?surveillance=" + [DateTime]::UtcNow.Ticks) -UseBasicParsing -MaximumRedirection 0 -TimeoutSec $delaiMaxSecondes -ErrorAction Stop
        $code = [int]$reponse.StatusCode
    } catch {
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode } else { $code = 0 }
    }
    $chrono.Stop()
    if ($page.Attendu -eq "ok") { $ok = ($code -eq 200) } else { $ok = ($code -ge 300 -and $code -lt 400) }
    [pscustomobject]@{ Chemin = $page.Chemin; Code = $code; Ms = [int]$chrono.ElapsedMilliseconds; Ok = $ok }
}

# --- etat precedent
$etat = [pscustomobject]@{ EchecsConsecutifs = 0; EnPanne = $false; DerniereAlerteExport = "" }
if (Test-Path $fichierEtat) {
    try { $lu = Get-Content $fichierEtat -Raw -Encoding UTF8 | ConvertFrom-Json; foreach ($p in $etat.PSObject.Properties.Name) { if ($null -ne $lu.$p) { $etat.$p = $lu.$p } } } catch { }
}

if ($NotificationDEssai) {
    Envoyer-Notification "Speedfood : essai de notification" "Si vous lisez ceci, les alertes de la surveillance arriveront bien ici."
    return
}

# --- controle des pages (un nouvel essai apres 15 secondes pour celles qui echouent)
$resultats = foreach ($page in $pages) { Tester-Page $page }
$enEchec = @($resultats | Where-Object { -not $_.Ok })
if ($enEchec.Count -gt 0) {
    Start-Sleep -Seconds 15
    $resultats = foreach ($r in $resultats) { if ($r.Ok) { $r } else { Tester-Page ($pages | Where-Object { $_.Chemin -eq $r.Chemin }) } }
    $enEchec = @($resultats | Where-Object { -not $_.Ok })
}
$resume = ($resultats | ForEach-Object { "{0}={1}/{2}ms" -f $_.Chemin, $_.Code, $_.Ms }) -join "  "
if ($enEchec.Count -eq 0) {
    Ecrire-Journal "OK   $resume"
    if ($etat.EnPanne) {
        Envoyer-Notification "Speedfood : site retabli" "Les pages repondent de nouveau. Notez l'heure de la panne dans le journal d'incident."
    }
    $etat.EchecsConsecutifs = 0
    $etat.EnPanne = $false
} else {
    $etat.EchecsConsecutifs = [int]$etat.EchecsConsecutifs + 1
    $detail = ($enEchec | ForEach-Object { "{0} (code {1})" -f $_.Chemin, $_.Code }) -join ", "
    Ecrire-Journal "ECHEC ($($etat.EchecsConsecutifs) de suite)  $resume"
    if ($etat.EchecsConsecutifs -ge 2 -and -not $etat.EnPanne) {
        $etat.EnPanne = $true
        Envoyer-Notification "Speedfood : le site ne repond pas" "Pages en echec : $detail. Voir docs/PLAN-INCIDENT.md, section 2."
    }
}

# --- age du dernier export de sauvegarde
$dossierExports = Join-Path $env:USERPROFILE "speedfood-exports"
$aujourdhui = (Get-Date).ToString("yyyy-MM-dd")
if (Test-Path $dossierExports) {
    $dernier = Get-ChildItem $dossierExports -Directory -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
    $ageJours = if ($dernier) { [int]((Get-Date) - $dernier.CreationTime).TotalDays } else { 9999 }
} else { $ageJours = 9999 }
if ($ageJours -gt $ageMaxExportJours) {
    Ecrire-Journal "ALERTE  dernier export de sauvegarde vieux de $ageJours jours (limite $ageMaxExportJours)"
    if ($etat.DerniereAlerteExport -ne $aujourdhui) {
        Envoyer-Notification "Speedfood : sauvegarde ancienne" "Le dernier export a plus de $ageMaxExportJours jours. Voir docs/RUNBOOK-EXPORT.md, section 9."
        $etat.DerniereAlerteExport = $aujourdhui
    }
}

$etat | ConvertTo-Json | Set-Content -Path $fichierEtat -Encoding UTF8
