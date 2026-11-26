# Signe le candidat Expo avec la NOUVELLE clé Speedfood (créée le 11 novembre 2026, l'ancienne est perdue). À lancer par Malika, jamais par un agent.
# Le mot de passe est demandé en saisie masquée : il n'est ni affiché, ni écrit dans un fichier, ni passé en argument de commande.
# Usage : powershell -ExecutionPolicy Bypass -File signer-candidat.ps1 -Apk <APK non signé> -Sortie <APK signé> -Sdk <dossier build-tools Android>
# -Sdk : dossier des outils Android contenant zipalign.exe et lib\apksigner.jar (build-tools 36.0.0 ou plus récent).
param(
  [Parameter(Mandatory = $true)][string]$Apk,
  [Parameter(Mandatory = $true)][string]$Sortie,
  [Parameter(Mandatory = $true)][string]$Sdk,
  [string]$Keystore = 'C:\Users\moelo\speedfood-signature-v2\speedfood-prod.keystore',
  [string]$Alias = 'speedfood',
  [string]$Java = '',
  # Empreinte SHA-256 PUBLIQUE de la nouvelle clé (sans les deux-points, en minuscules).
  [string]$EmpreinteAttendue = '256b6efe37199cb1dd630a634f6c854b6ca4259e5461330febd416edb69806b5'
)
$ErrorActionPreference = 'Stop'
$sdk = $Sdk
if (-not $Java) {
  $dossierJdk = Get-ChildItem 'C:\Program Files\Microsoft\jdk-17*' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($dossierJdk) { $Java = Join-Path $dossierJdk.FullName 'bin\java.exe' } elseif ($env:JAVA_HOME) { $Java = Join-Path $env:JAVA_HOME 'bin\java.exe' }
}
$java = $Java
$empreinteAttendue = $EmpreinteAttendue.ToLower() -replace ':', ''
if (-not (Test-Path $java)) { throw "Java introuvable : $java (indiquez -Java)" }
if (-not (Test-Path "$sdk\zipalign.exe")) { throw "zipalign.exe introuvable dans $sdk (indiquez -Sdk : dossier build-tools Android)" }
if (-not (Test-Path $Apk)) { throw "APK introuvable : $Apk" }
if (-not (Test-Path $Keystore)) { throw "Clé introuvable : $Keystore" }
if (Test-Path $Sortie) { throw "Le fichier de sortie existe déjà : $Sortie (choisissez un autre nom)" }

$aligne = [System.IO.Path]::GetTempFileName() + '.apk'
Remove-Item $aligne -ErrorAction SilentlyContinue
& "$sdk\zipalign.exe" -p 4 $Apk $aligne
if ($LASTEXITCODE -ne 0) { throw 'zipalign a échoué' }

$mdp = Read-Host -AsSecureString 'Mot de passe de la NOUVELLE clé Speedfood (saisie masquée)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mdp)
try {
  $clair = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  # Le mot de passe passe par l'entrée standard d'apksigner, pas par la ligne de commande.
  $clair | & $java -jar "$sdk\lib\apksigner.jar" sign --ks $Keystore --ks-key-alias $Alias --ks-pass stdin --out $Sortie $aligne
  if ($LASTEXITCODE -ne 0) { throw 'La signature a échoué (mot de passe ou alias incorrect ?)' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $clair = $null
  Remove-Item $aligne -ErrorAction SilentlyContinue
}

$verif = & $java -jar "$sdk\lib\apksigner.jar" verify --print-certs $Sortie | Out-String
if ($verif -notmatch $empreinteAttendue) { Remove-Item $Sortie; throw "Empreinte du certificat DIFFÉRENTE de la nouvelle clé attendue : APK supprimée. Ce n'est pas la bonne clé." }
Write-Host "OK : APK signée avec la nouvelle clé Speedfood : $Sortie"
Write-Host "Empreinte du certificat conforme ($empreinteAttendue)."
