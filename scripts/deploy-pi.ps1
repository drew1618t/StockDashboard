$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$targetPath = Join-Path $repoRoot 'deploy/pi-target.json'
$target = Get-Content $targetPath -Raw | ConvertFrom-Json

$remoteCommand = @"
cd $($target.appDir) &&
git pull --ff-only origin $($target.branch) &&
npm install --omit=dev &&
sudo systemctl restart $($target.service) &&
sleep 4 &&
systemctl status $($target.service) --no-pager
"@

ssh $target.ssh $remoteCommand
