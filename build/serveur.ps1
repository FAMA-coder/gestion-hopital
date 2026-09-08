# ============================================================
#  Serveur web local pour Gestion Hospitaliere
#  - Sert les fichiers du dossier racine du projet
#  - Ouvre automatiquement le navigateur
#  - Utilise System.Net.Sockets (TcpListener) : aucune
#    dependance externe, aucun droit admin, aucun URLACL:
#    fonctionne sur n'importe quel Windows 10/11.
#  - Arret : fermer la fenetre ou arreter avec Ctrl+C
# ============================================================
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

# ------------------------------------------------------------
#  MIME types
# ------------------------------------------------------------
$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".mjs"  = "application/javascript; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".txt"  = "text/plain; charset=utf-8"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
}

# ------------------------------------------------------------
#  Recherche d'un port libre (utilisation de TcpListener)
#  pour verifier la disponibilite reelle avant d'ecouter.
# ------------------------------------------------------------
function Test-PortLibre([int]$port) {
    $t = $null
    try {
        $t = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
        $t.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($t) { try { $t.Stop() } catch {} }
    }
}

$port = 8080
$portLibre = $false
for ($i = 0; $i -lt 100; $i++) {
    if (Test-PortLibre $port) { $portLibre = $true; break }
    $port++
}
if (-not $portLibre) {
    Write-Host "Impossible de trouver un port libre (8080-8179)." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# ------------------------------------------------------------
#  Ouvrir le navigateur des que le serveur ecoute
# ------------------------------------------------------------
$nbPort = $port
Start-Process -NoNewWindow powershell -ArgumentList "-NoProfile -Command", "Start-Sleep -Milliseconds 800; Start-Process 'http://localhost:$nbPort/'"

# ------------------------------------------------------------
#  Demarrage du serveur
# ------------------------------------------------------------
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host ""
Write-Host "  ===========================================" -ForegroundColor Cyan
Write-Host "   Gestion Hospitaliere - Serveur local" -ForegroundColor Cyan
Write-Host "   URL: http://localhost:$port/" -ForegroundColor Green
Write-Host "   Racine: $root" -ForegroundColor Gray
Write-Host "   Arret: fermez cette fenetre" -ForegroundColor Gray
Write-Host "  ===========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
#  Securisation du chemin (anti ../)
# ------------------------------------------------------------
function Get-SafePath([string]$raw) {
    $path = "index.html"
    if ($raw -and $raw -ne "/") {
        $p = $raw.Split('?')[0].Split('#')[0]
        if ($p.Length -gt 1) {
            try { $decoded = [System.Uri]::UnescapeDataString($p) } catch { $decoded = $p }
            $decoded = $decoded -replace '\.\.', ''
            $decoded = $decoded -replace '/+', '/'
            $decoded = $decoded.TrimStart('/', '\')
            if ($decoded -ne "") { $path = $decoded }
        }
    }
    try {
        $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    } catch {
        $full = Join-Path $root "index.html"
    }
    if (-not $full.StartsWith($root)) { $full = Join-Path $root "index.html" }
    return $full
}

# ------------------------------------------------------------
#  Unicode -> encodage UTF-8 (pour les en-tetes/traces)
# ------------------------------------------------------------
function Get-Utf8([string]$s) {
    return [System.Text.Encoding]::UTF8.GetBytes($s)
}

function Send-Response([System.Net.Sockets.NetworkStream]$stream, [string]$statusLine, [string]$contentType, [byte[]]$body) {
    $headerText = "$statusLine`r`n" +
                  "Content-Type: $contentType`r`n" +
                  "Cache-Control: no-store, no-cache, must-revalidate`r`n" +
                  "Pragma: no-cache`r`n" +
                  "Expires: 0`r`n" +
                  "Content-Length: $($body.Length)`r`n" +
                  "Connection: close`r`n" +
                  "`r`n"
    $header = Get-Utf8 $headerText
    $stream.Write($header, 0, $header.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
}

# ------------------------------------------------------------
#  Boucle principale
# ------------------------------------------------------------
while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
    } catch {
        # Le serveur a ete arrete
        break
    }

    try {
        $client.ReceiveTimeout = 5000
        $stream = $client.GetStream()

        # Lecture de la requete
        $buffer = New-Object byte[] 8192
        $request = ""
        try {
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -gt 0) {
                $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
            }
        } catch {
            # timeout / client ferme
        }

        if ($request -ne "") {
            $requestLine = ($request -split "`r`n")[0]
            $parts = $requestLine -split ' '
            $method = if ($parts.Length -gt 0) { $parts[0] } else { "" }
            $url    = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

            # Champs d'entete Host (indicatif pour les logs)
            $hostHeader = ($request -split "`r`n") | Where-Object { $_ -match '^Host:' }
            $hostVal = if ($hostHeader) { ($hostHeader -split ': ', 2)[1] } else { "localhost" }

            if ($method -eq "GET" -or $method -eq "HEAD") {
                $path = Get-SafePath $url
                $ext = [System.IO.Path]::GetExtension($path).ToLower()
                $type = "application/octet-stream"
                if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }

                if (Test-Path -LiteralPath $path) {
                    $body = [System.IO.File]::ReadAllBytes($path)
                    $status = "HTTP/1.1 200 OK"
                    Write-Host ("  [OK] " + $url) -ForegroundColor Gray
                } else {
                    $body = Get-Utf8 "<!DOCTYPE html><html><head><meta charset='utf-8'><title>404</title></head><body><h1>404 - Non trouve</h1><p>Fichier introuvable: $url</p></body></html>"
                    $status = "HTTP/1.1 404 Not Found"
                    $type = "text/html; charset=utf-8"
                    Write-Host (" [404] " + $url) -ForegroundColor Yellow
                }

                Send-Response $stream $status $type $body
            } else {
                $body = Get-Utf8 "<html><body><h1>405 - Methode non autorisee</h1></body></html>"
                Send-Response $stream "HTTP/1.1 405 Method Not Allowed" "text/html; charset=utf-8" $body
            }
        }
    } catch {
        # Connexion anormale - on continue
    } finally {
        try { $client.Close() } catch {}
    }
}

$listener.Stop()
