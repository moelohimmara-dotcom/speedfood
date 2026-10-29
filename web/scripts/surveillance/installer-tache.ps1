# Enregistre la tache planifiee Windows « Speedfood - surveillance » (toutes les 5 minutes, sous le compte de l'utilisateur, sans droits administrateur).
# A lancer UNE fois, par la proprietaire : powershell -ExecutionPolicy Bypass -File scripts\surveillance\installer-tache.ps1
# Pour la retirer : Unregister-ScheduledTask -TaskName "Speedfood - surveillance" -Confirm:$false
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "verifier-disponibilite.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$declencheur = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3)
Register-ScheduledTask -TaskName "Speedfood - surveillance" -Action $action -Trigger $declencheur -Settings $reglages -Description "Controle la disponibilite de Speedfood et l'age de la derniere sauvegarde. Lecture seule. Voir docs/SURVEILLANCE.md." -Force | Out-Null
Get-ScheduledTask -TaskName "Speedfood - surveillance" | Get-ScheduledTaskInfo | Select-Object LastRunTime, NextRunTime
