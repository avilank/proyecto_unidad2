# Limpia lecturas, análisis, órdenes y alertas del simulador.
# Conserva usuarios, técnicos, máquinas y configuración.
#
# Uso:
#   .\scripts\reset-demo-day.ps1                    # pide --yes vía node
#   .\scripts\reset-demo-day.ps1 -Yes               # borra eventos de hoy
#   .\scripts\reset-demo-day.ps1 -All -Yes          # borra todo el historial operativo
#   .\scripts\reset-demo-day.ps1 -DryRun            # solo muestra conteos

param(
    [switch]$All,
    [switch]$Yes,
    [switch]$DryRun
)

$apiRoot = Join-Path $PSScriptRoot "..\predictmaint-api"
$nodeArgs = @("scripts/reset-demo-day.js")

if ($All) { $nodeArgs += "--all" }
if ($DryRun) { $nodeArgs += "--dry-run" }
if ($Yes) { $nodeArgs += "--yes" }

Push-Location $apiRoot
try {
    node @nodeArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
