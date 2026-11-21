param([ValidateSet('cpu','lowvram')][string]$Profile = 'cpu')
$ErrorActionPreference = 'Stop'
$portableRoot = 'D:\ComfyUI_windows_portable'
$comfyArguments = @('-s','ComfyUI\main.py','--windows-standalone-build','--listen','127.0.0.1','--port','8188','--use-pytorch-cross-attention','--preview-method','none')
if ($Profile -eq 'cpu') {
    $comfyArguments += '--cpu'
} else {
    $comfyArguments += @('--lowvram','--reserve-vram','0.5')
}
# Do not stop an active engine: queued prompts belong to the existing process.
try {
    $probe = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8188/system_stats' -TimeoutSec 3
    if ($probe.StatusCode -eq 200) {
        Write-Output 'ComfyUI is already online. Let its queue finish before changing launch profiles.'
        return
    }
} catch { }
$logRoot = Join-Path (Split-Path -Parent $PSScriptRoot) '.runtime'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stdout = Join-Path $logRoot "comfyui-$Profile-$stamp.out.log"
$stderr = Join-Path $logRoot "comfyui-$Profile-$stamp.err.log"
$comfyProcess = Start-Process -FilePath (Join-Path $portableRoot 'python_embeded\python.exe') -ArgumentList $comfyArguments -WorkingDirectory $portableRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Write-Output "Started ComfyUI $Profile profile, PID $($comfyProcess.Id). Logs: $stdout and $stderr"
