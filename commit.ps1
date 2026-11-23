# Usage (from the repo root):
#   .\commit.ps1                 # commit with the default message
#   .\commit.ps1 -Push           # commit and push
#   .\commit.ps1 -Message "..."  # custom message
param(
  [string]$Message = "Deploy to GitHub Pages: relative paths and Actions workflow",
  [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Stage everything except the .claude folder
git add -A -- . ':!.commit.ps1'

# Make sure nothing from .claude slipped into the index
git reset -q -- .claude 2>$null

if (-not (git diff --cached --name-only)) {
  Write-Host "Nothing to commit."
  exit 0
}

git status --short
git commit -m $Message

if ($Push) { git push }
