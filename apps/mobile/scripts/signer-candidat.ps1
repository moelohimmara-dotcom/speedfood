# Signe le candidat Expo avec la clé Speedfood EXISTANTE. À lancer par Malika, jamais par un agent.
# Le mot de passe est demandé en saisie masquée : il n'est ni affiché, ni écrit dans un fichier, ni passé en argument de commande.
# Usage : powershell -ExecutionPolicy Bypass -File signer-candidat.ps1 -Apk <APK non signé> -Sortie <APK signé>
param(
  [Parameter(Mandatory = $true)][string]$Apk,
  [Parameter(Mandatory = $true)][string]$Sortie,
  [string]$Keystore = 'C:\Users\moelo\speedfood-signature\speedfood.keystore',
  [string]$Alias = 'speedfood'
)
$ErrorActionPreference = 'Stop'
$sdk = 'C:\Users\moelo\.bubblewrap\android_sdk\build-tools\36.0.0'
$java = 'C:\Users\moelo\.speedfood-tools\jdk-17.0.20.1+1\bin\java.exe'
$empreinteAttendue = 'e81f0ac1276f445a83425606b3647a3dd0d37c21415d4a9e78bebae840cb1f7c'
if (-not (Test-Path $Apk)) { throw "APK introuvable : $Apk" }
if (-not (Test-Path $Keystore)) { throw "Clé introuvable : $Keystore" }
if (Test-Path $Sortie) { throw "Le fichier de sortie existe déjà : $Sortie (choisissez un autre nom)" }

$aligne = [System.IO.Path]::GetTempFileName() + '.apk'
Remove-Item $aligne -ErrorAction SilentlyContinue
& "$sdk\zipalign.exe" -p 4 $Apk $aligne
if ($LASTEXITCODE -ne 0) { throw 'zipalign a échoué' }

$mdp = Read-Host -AsSecureString 'Mot de passe de la clé Speedfood (saisie masquée)'
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
if ($verif -notmatch $empreinteAttendue) { Remove-Item $Sortie; throw "Empreinte du certificat DIFFÉRENTE de l'application actuelle : APK supprimée. Ce n'est pas la bonne clé." }
Write-Host "OK : APK signée avec la clé Speedfood existante : $Sortie"
Write-Host "Empreinte du certificat conforme ($empreinteAttendue)."
