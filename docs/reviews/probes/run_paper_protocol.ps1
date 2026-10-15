param([switch]$IncludePaperDefaults, [switch]$OnlyPaper,
    [ValidateRange(1,86400)][int]$TimeoutSeconds=120,
    [ValidateRange(128,32768)][int]$HeapMiB=768,
    [string]$OutputDirectory='docs/reviews/paper-optimized/runs',
    [ValidateRange(1,1000000000000)][long]$ResultTransactionLimit=1000000000,
    [ValidateRange(1,4096)][int]$MaxCompressedResultMiB=256)
$ErrorActionPreference = 'Stop'
$paperRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$paperJava = Join-Path $env:JAVA_HOME 'bin/java.exe'
if (!(Test-Path -LiteralPath $paperJava)) { throw 'JAVA_HOME must point to JDK 21+' }
$paperInvocation = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
$paperJar = Join-Path $paperRoot "tmp/paper-optimized-$paperInvocation.jar"
New-Item -ItemType Directory -Path (Join-Path $paperRoot 'tmp') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $paperRoot 'backend/target/cartlens-backend-0.0.1-SNAPSHOT.jar') -Destination $paperJar
$paperOutputRoot = if ([IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $paperRoot $OutputDirectory }
$paperOutput = Join-Path $paperOutputRoot $paperInvocation
New-Item -ItemType Directory -Path $paperOutput -Force | Out-Null
$paperHardware = & node -e "const os=require('os');console.log(JSON.stringify({memoryBytes:os.totalmem(),cpu:os.cpus()[0].model,logicalProcessors:os.cpus().length,os:os.version(),osVersion:os.release(),freeMemoryBytesBeforeExperiment:os.freemem()}))"
if ($LASTEXITCODE -ne 0) { throw 'Cannot capture hardware information with Node.js' }
$paperHardware | Set-Content -LiteralPath (Join-Path $paperOutput 'hardware.json') -Encoding utf8
$paperCases = @(
    @{ name='retail-small'; dataset='Retail'; panes=1000; minWus='0.01'; batch=100; repeats=2; paperDimensions=$false },
    @{ name='accidents-small'; dataset='Accidents'; panes=40; minWus='0.9'; batch=5; repeats=2; paperDimensions=$false }
)
if ($OnlyPaper) { $paperCases = @() }
if ($IncludePaperDefaults -or $OnlyPaper) {
    $paperCases += @{ name='retail-paper'; dataset='Retail'; panes=88000; minWus='0.003'; batch=10000; repeats=1; paperDimensions=$true }
    $paperCases += @{ name='accidents-paper'; dataset='Accidents'; panes=340000; minWus='0.6'; batch=5000; repeats=1; paperDimensions=$true }
}
$paperManifestPath = Join-Path $paperOutput 'manifest.json'
$paperRecords = @()
$paperJarSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $paperJar).Hash.ToLowerInvariant()
foreach ($paperCase in $paperCases) {
    foreach ($paperAlgorithm in @('FWUDS_CT','FWUDS_DWT')) {
        for ($paperRepeat=1; $paperRepeat -le $paperCase.repeats; $paperRepeat++) {
            $paperName = "$($paperCase.name)-$paperAlgorithm-$paperRepeat"
            $paperResult = Join-Path $paperOutput "$paperName.json"
            $paperStdout = Join-Path $paperOutput "$paperName.stdout.log"
            $paperStderr = Join-Path $paperOutput "$paperName.stderr.log"
            $paperSource = Join-Path $paperRoot "$($paperCase.dataset)-metadata"
            $paperLimit = if ($paperCase.paperDimensions) { $TimeoutSeconds } else { $TimeoutSeconds }
            # Workspace paths in this project have no spaces; reject unsafe quoting assumptions.
            if ($paperJar.Contains(' ') -or $paperResult.Contains(' ') -or $paperSource.Contains(' ')) {
                throw 'This launcher requires workspace paths without spaces.'
            }
            $paperFingerprintMode = if ($paperCase.paperDimensions) { 'compact' } else { 'legacy' }
            $paperLogicalLimit = if ($paperCase.paperDimensions) { $ResultTransactionLimit } else { 1000000 }
            $paperArguments = @("-Xmx$($HeapMiB)m", "-Dcartlens.max-result-transactions=$paperLogicalLimit",
                "-Dcartlens.max-result-storage-bytes=$([long]$MaxCompressedResultMiB*1024*1024)",'-Dloader.main=com.cartlens.benchmark.PaperProtocolBenchmark','-cp',$paperJar,
                'org.springframework.boot.loader.launch.PropertiesLauncher','--algorithm',$paperAlgorithm,
                '--source',$paperSource,'--output',$paperResult,'--pane','1','--window-panes',"$($paperCase.panes)",
                '--slides','50','--min-wus',$paperCase.minWus,'--weight-batch',"$($paperCase.batch)",
                '--seed','42','--timeout-seconds',"$paperLimit",'--fingerprint-mode',$paperFingerprintMode)
            $paperStarted = [DateTime]::UtcNow
            $paperProcess = Start-Process -FilePath $paperJava -ArgumentList $paperArguments -WorkingDirectory $paperRoot `
                -WindowStyle Hidden -PassThru -RedirectStandardOutput $paperStdout -RedirectStandardError $paperStderr
            $null = $paperProcess.Handle
            $paperPeakWorkingSet = 0L; $paperTimedOut = $false
            while (!$paperProcess.WaitForExit(500)) {
                $paperObservation = Get-Process -Id $paperProcess.Id -ErrorAction SilentlyContinue
                if ($paperObservation) { $paperPeakWorkingSet = [Math]::Max($paperPeakWorkingSet,$paperObservation.PeakWorkingSet64) }
                if (([DateTime]::UtcNow-$paperStarted).TotalSeconds -gt $paperLimit+30) {
                    # Stop only the specific benchmark process started above.
                    Stop-Process -Id $paperProcess.Id
                    $paperTimedOut = $true
                    $paperProcess.WaitForExit()
                    break
                }
            }
            $paperProcess.WaitForExit()
            $paperStatus = if ($paperTimedOut) { 'PROCESS_TIME_LIMIT' } elseif (Test-Path -LiteralPath $paperResult) {
                (Get-Content -LiteralPath $paperResult -Raw | ConvertFrom-Json).status
            } else { 'PROCESS_FAILED' }
            $paperRecord = [pscustomobject]@{
                invocation=$paperInvocation; jarSha256=$paperJarSha256; fingerprintMode=$paperFingerprintMode
                name=$paperName; dataset=$paperCase.dataset; algorithm=$paperAlgorithm; repetition=$paperRepeat
                requestedPaperDimensions=$paperCase.paperDimensions; status=$paperStatus; exitCode=$paperProcess.ExitCode
                startedUtc=$paperStarted.ToString('o'); elapsedSeconds=([DateTime]::UtcNow-$paperStarted).TotalSeconds
                observedPeakWorkingSetBytes=$paperPeakWorkingSet
                memoryMeaning='OS process working-set peak observed while alive, including JVM/native memory; not algorithm heap'
                executable=$paperJava; arguments=$paperArguments; resultFile=$paperResult; stdoutFile=$paperStdout; stderrFile=$paperStderr
            }
            $paperRecords = @($paperRecords | Where-Object { $_.name -ne $paperName }) + @($paperRecord)
            ConvertTo-Json -InputObject @($paperRecords) -Depth 8 | Set-Content -LiteralPath $paperManifestPath -Encoding utf8
            Write-Output "$paperName : $paperStatus (exit $($paperProcess.ExitCode))"
        }
    }
}

Write-Output "Evidence directory: $paperOutput"
