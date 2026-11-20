param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\app')).TrimEnd('\') + '\'
if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "app\ folder missing or incomplete / dossier app\ introuvable : $root" -ForegroundColor Red
    Read-Host 'Press Enter to close / Entree pour fermer'
    exit 1
}

$types = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.wasm' = 'application/wasm'
    '.bin' = 'application/octet-stream'; '.uf2' = 'application/octet-stream'; '.onnx' = 'application/octet-stream'
    '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = $null
foreach ($p in 8765..8785) {
    try {
        $l = [System.Net.HttpListener]::new()
        $l.Prefixes.Add("http://localhost:$p/")
        $l.Start()
        $listener = $l
        $port = $p
        break
    } catch { }
}
if (-not $listener) {
    Write-Host 'No free port (8765-8785) / aucun port libre.' -ForegroundColor Red
    Read-Host 'Press Enter to close / Entree pour fermer'
    exit 1
}

$url = "http://localhost:$port/"
Write-Host ''
Write-Host '  AutoOcarina is running / est lance !' -ForegroundColor Green
Write-Host "  Address / adresse : $url"
Write-Host '  Keep this window open while you use the site / garde cette fenetre ouverte.'
Write-Host '  To stop: close this window / pour arreter : ferme cette fenetre.'
Write-Host ''

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($NoBrowser) { }
elseif ($chrome) { Start-Process $chrome $url }
else { Start-Process 'msedge' $url }

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
        $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
        if ($rel -eq '') { $rel = 'index.html' }
        $file = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
        if (-not $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $file -PathType Leaf)) {
            $res.StatusCode = 404
        } else {
            $ext = [System.IO.Path]::GetExtension($file).ToLower()
            $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
            $res.Headers.Add('Cross-Origin-Opener-Policy', 'same-origin')
            $res.Headers.Add('Cross-Origin-Embedder-Policy', 'credentialless')
            $res.Headers.Add('Cache-Control', 'no-cache')
            $stream = [System.IO.File]::OpenRead($file)
            try {
                $res.ContentLength64 = $stream.Length
                if ($ctx.Request.HttpMethod -ne 'HEAD') { $stream.CopyTo($res.OutputStream) }
            } finally { $stream.Dispose() }
        }
    } catch {
    } finally {
        try { $res.Close() } catch { }
    }
}
