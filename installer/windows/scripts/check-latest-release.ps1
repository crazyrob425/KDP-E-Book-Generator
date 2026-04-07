param(
  [string]$RepoApi = 'https://api.github.com/repos/crazyrob425/KDP-E-Book-Generator/releases/latest',
  [string]$OutputJson = "$PSScriptRoot/latest-release.json"
)

$ErrorActionPreference = 'Stop'

try {
  $headers = @{ 'User-Agent' = 'KDP-E-Book-Generator-Installer' }
  $release = Invoke-RestMethod -Uri $RepoApi -Headers $headers -Method Get
  $release | ConvertTo-Json -Depth 12 | Set-Content -Path $OutputJson -Encoding UTF8
  Write-Host "Latest release metadata saved to: $OutputJson"
  Write-Host "Tag: $($release.tag_name)"
  exit 0
}
catch {
  Write-Error "Failed to fetch latest release metadata: $($_.Exception.Message)"
  exit 1
}
