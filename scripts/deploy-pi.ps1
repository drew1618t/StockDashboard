$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$targetPath = Join-Path $repoRoot 'deploy/pi-target.json'
$target = Get-Content $targetPath -Raw | ConvertFrom-Json
$runtimeDataFiles = @(
  'portfolio.json',
  'data/todos.json',
  'data/writing-analytics.json',
  'data/writing.json'
)
$runtimeDataArgs = $runtimeDataFiles -join ' '

# Schwab transaction exports are gitignored, so git pull cannot carry them.
# Push them ahead of the pull so the tax pipeline sees new exports on restart.
# Scoped to data/transactions on purpose: the Pi's data/taxes.state.json holds
# sale confirmations that exist nowhere else and must never be overwritten.
$transactionsDir = Join-Path $repoRoot 'data/transactions'
if (Test-Path $transactionsDir) {
  Write-Host "Syncing transaction exports to $($target.ssh)..."
  scp -r -q $transactionsDir "$($target.ssh):$($target.appDir)/data/"
  if ($LASTEXITCODE -ne 0) { throw "Failed to sync data/transactions to the Pi" }
}

$remoteCommand = @"
cd $($target.appDir) &&
backup_dir=`$(mktemp -d) &&
for file in $runtimeDataArgs; do
  if [ -f "`$file" ]; then
    mkdir -p "`$backup_dir/`$(dirname "`$file")" &&
    cp "`$file" "`$backup_dir/`$file"
  fi
done &&
if [ ! -f data/taxes.state.json ] && [ -f data/taxes.json ]; then cp data/taxes.json data/taxes.state.json; fi &&
(git restore -- data/taxes.json 2>/dev/null || true) &&
(git restore -- $runtimeDataArgs 2>/dev/null || true) &&
git pull --ff-only origin $($target.branch) &&
for file in $runtimeDataArgs; do
  if [ -f "`$backup_dir/`$file" ]; then
    cp "`$backup_dir/`$file" "`$file"
  fi
done &&
rm -rf "`$backup_dir" &&
node scripts/seed-writing.js &&
npm install --omit=dev &&
sudo systemctl restart $($target.service) &&
sleep 4 &&
systemctl status $($target.service) --no-pager
"@

ssh $target.ssh $remoteCommand
