$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$targetPath = Join-Path $repoRoot 'deploy/pi-target.json'
$target = Get-Content $targetPath -Raw | ConvertFrom-Json
$runtimeDataFiles = @(
  'data/todos.json',
  'data/writing-analytics.json',
  'data/writing.json'
)
$runtimeDataArgs = $runtimeDataFiles -join ' '

$remoteCommand = @"
cd $($target.appDir) &&
runtime_data_files="$runtimeDataArgs" &&
backup_dir=`$(mktemp -d) &&
for file in `$runtime_data_files; do
  if [ -f "`$file" ]; then
    mkdir -p "`$backup_dir/`$(dirname "`$file")" &&
    cp "`$file" "`$backup_dir/`$file"
  fi
done &&
if [ ! -f data/taxes.state.json ] && [ -f data/taxes.json ]; then cp data/taxes.json data/taxes.state.json; fi &&
(git restore -- data/taxes.json 2>/dev/null || true) &&
(git restore -- $runtimeDataArgs 2>/dev/null || true) &&
git pull --ff-only origin $($target.branch) &&
for file in `$runtime_data_files; do
  if [ -f "`$backup_dir/`$file" ]; then
    cp "`$backup_dir/`$file" "`$file"
  fi
done &&
rm -rf "`$backup_dir" &&
npm install --omit=dev &&
sudo systemctl restart $($target.service) &&
sleep 4 &&
systemctl status $($target.service) --no-pager
"@

ssh $target.ssh $remoteCommand
