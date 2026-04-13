$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$targetPath = Join-Path $repoRoot 'deploy/pi-target.json'
$target = Get-Content $targetPath -Raw | ConvertFrom-Json

$remoteCommand = @"
cd $($target.appDir) &&
if [ ! -f data/taxes.state.json ] && [ -f data/taxes.json ]; then cp data/taxes.json data/taxes.state.json; fi &&
(git restore -- data/taxes.json 2>/dev/null || true) &&
git pull --ff-only origin $($target.branch) &&
npm install --omit=dev &&
sudo systemctl restart $($target.service) &&
sleep 4 &&
systemctl status $($target.service) --no-pager
"@

ssh $target.ssh $remoteCommand
