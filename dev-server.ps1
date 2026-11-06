# Server statik ringkas untuk uji app di PC (tiada Node/Python diperlukan).
# Guna:  powershell -ExecutionPolicy Bypass -File .\dev-server.ps1 -Port 8080
# Buka:  http://localhost:8080

param(
  [int]$Port = 8080,
  [string]$Root = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
if (-not $Root) { $Root = (Get-Location).Path }

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "Waktu Solat -> http://localhost:$Port/  (root: $Root)"
Write-Host "Ctrl+C untuk henti."

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json; charset=utf-8'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

while ($true) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $stream.ReadTimeout = 5000

    $buf = New-Object byte[] 8192
    $sb = New-Object System.Text.StringBuilder
    do {
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      [void]$sb.Append([System.Text.Encoding]::ASCII.GetString($buf, 0, $n))
    } while ($sb.ToString() -notmatch "`r`n`r`n")

    $reqLine = ($sb.ToString() -split "`r`n")[0]
    $parts = $reqLine -split ' '
    $path = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
    $path = $path.Split('?')[0]
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    $full = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
    $status = '200 OK'
    $ctype = 'application/octet-stream'

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $body = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($types.ContainsKey($ext)) { $ctype = $types[$ext] }
    } else {
      $status = '404 Not Found'
      $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $ctype = 'text/plain; charset=utf-8'
    }

    $header = "HTTP/1.1 $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`n" +
              "Cache-Control: no-store`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
    $client.Close()
  } catch {
    try { if ($client) { $client.Close() } } catch {}
  }
}
