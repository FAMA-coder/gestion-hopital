# ============================================================
#  Serveur web local pour Gestion Hospitaliere
#  - Sert les fichiers du dossier racine du projet
#  - Ouvre automatiquement le navigateur
#  - Utilise System.Net.Sockets (TcpListener) : aucune
#    dependance externe, aucun droit admin, aucun URLACL:
#    fonctionne sur n'importe quel Windows 10/11.
#  - Arret : fermer la fenetre ou arreter avec Ctrl+C
# ------------------------------------------------------------
#  Usage :
#    .\serveur.ps1                 poste seul (127.0.0.1)
#    .\serveur.ps1 -Sync           poste serveur du reseau local
#                                 (accepte les autres postes et
#                                 heberge la derniere image des
#                                 donnees pour la synchro LAN)
#    .\serveur.ps1 -Sync -SyncSecret "mon-secret"
#                                 secret impose (sinon genere puis
#                                 conserve dans build\.synchro)
#    .\serveur.ps1 -NoBrowser      n'ouvre pas le navigateur
#    .\serveur.ps1 -ShowSecret     affiche le secret en clair dans la
#                                 console (par defaut il est masque)
# ============================================================
param(
    [switch]$Sync,
    [switch]$NoBrowser,
    [switch]$ShowSecret,
    [string]$SyncSecret = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

# ------------------------------------------------------------
#  Synchronisation reseau local (option -Sync)
# ------------------------------------------------------------
$syncDir = Join-Path $PSScriptRoot '.synchro'
$syncStateFile = Join-Path $syncDir 'etat.json'
$syncMetaFile = Join-Path $syncDir 'etat.meta.json'
$syncSecretFile = Join-Path $syncDir 'secret.txt'

function New-RandomSecret {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $sb = New-Object System.Text.StringBuilder
    for ($i = 0; $i -lt 16; $i += 1) {
        [void]$sb.Append($chars[(Get-Random -Maximum $chars.Length)])
    }
    return $sb.ToString()
}

if ($Sync) {
    if (-not (Test-Path -LiteralPath $syncDir)) {
        New-Item -ItemType Directory -Path $syncDir -Force | Out-Null
    }
    if ($SyncSecret -and $SyncSecret.Trim().Length -ge 6) {
        $script:secret = $SyncSecret.Trim()
        Set-Content -LiteralPath $syncSecretFile -Value $script:secret -Encoding ASCII
    } elseif (Test-Path -LiteralPath $syncSecretFile) {
        $script:secret = (Get-Content -LiteralPath $syncSecretFile -Raw).Trim()
        if ($script:secret.Length -lt 6) { $script:secret = New-RandomSecret }
    } else {
        $script:secret = New-RandomSecret
    }
    if (-not (Test-Path -LiteralPath $syncSecretFile)) {
        Set-Content -LiteralPath $syncSecretFile -Value $script:secret -Encoding ASCII
    }
}

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
$bindAddress = if ($Sync) { [System.Net.IPAddress]::Any } else { [System.Net.IPAddress]::Loopback }

function Test-PortLibre([int]$port) {
    $t = $null
    try {
        $t = New-Object System.Net.Sockets.TcpListener($bindAddress, $port)
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
for ($i = 0; $i -lt 100; $i += 1) {
    if (Test-PortLibre $port) { $portLibre = $true; break }
    $port += 1
}
if (-not $portLibre) {
    Write-Host "Impossible de trouver un port libre (8080-8179)." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Adresses du poste a communiquer aux autres postes du reseau.
function Get-LanAddresses {
    try {
        return @([System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName()).AddressList |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.AddressToString -and $_.AddressToString -notlike '127.*' } |
            ForEach-Object { $_.AddressToString } |
            Select-Object -Unique)
    } catch {
        return @()
    }
}

# ------------------------------------------------------------
#  Ouvrir le navigateur des que le serveur ecoute
# ------------------------------------------------------------
$nbPort = $port
if (-not $NoBrowser) {
    Start-Process -NoNewWindow powershell -ArgumentList "-NoProfile -Command", "Start-Sleep -Milliseconds 800; Start-Process 'http://localhost:$nbPort/'"
}

# ------------------------------------------------------------
#  Demarrage du serveur
# ------------------------------------------------------------
$listener = New-Object System.Net.Sockets.TcpListener($bindAddress, $port)
$listener.Start()

Write-Host ""
Write-Host "  ===========================================" -ForegroundColor Cyan
Write-Host "   Gestion Hospitaliere - Serveur local" -ForegroundColor Cyan
Write-Host "   URL: http://localhost:$port/" -ForegroundColor Green
Write-Host "   Racine: $root" -ForegroundColor Gray
Write-Host "   Arret: fermez cette fenetre" -ForegroundColor Gray
if ($Sync) {
    Write-Host "  -------------------------------------------" -ForegroundColor Cyan
    Write-Host "   SYNCHRONISATION RESEAU LOCAL : ACTIVE" -ForegroundColor Yellow
    Write-Host "   Ce poste heberge les donnees pour les autres postes." -ForegroundColor Yellow
    $lanAdresses = @(Get-LanAddresses)
    if ($lanAdresses.Count -gt 0) {
        foreach ($ad in $lanAdresses) {
            Write-Host ("   Sur les autres postes : http://{0}:{1}/" -f $ad, $port) -ForegroundColor Green
        }
    } else {
        Write-Host "   Aucune adresse reseau detectee sur ce poste." -ForegroundColor Red
        Write-Host "   Verifiez la connexion reseau (ou utilisez l'adresse IP de la machine)." -ForegroundColor DarkGray
    }
    if ($ShowSecret) {
        Write-Host "   Secret partage : $script:secret" -ForegroundColor Yellow
    } else {
        Write-Host "   Secret partage : masque (fichier : $syncSecretFile)" -ForegroundColor Yellow
        Write-Host "   Pour l'afficher : .\serveur.ps1 -Sync -ShowSecret" -ForegroundColor DarkGray
    }
    Write-Host "   (a recopier dans Parametres > Synchro de chaque poste)" -ForegroundColor DarkGray
    Write-Host "   Si Windows bloque l'acces, autorisez PowerShell dans le pare-feu." -ForegroundColor DarkGray
    if (Test-Path -LiteralPath $syncStateFile) {
        Write-Host "   Image hebergee : $syncStateFile" -ForegroundColor DarkGray
    } else {
        Write-Host "   Image hebergee : aucune (elle sera creee au premier envoi)" -ForegroundColor DarkGray
    }
}
Write-Host "  ===========================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
#  Securisation du chemin
#  Retourne $null si la requete ne doit pas etre servie : le
#  client reçoit alors 403 plutot qu'un fichier du projet.
# ------------------------------------------------------------
function Get-SafePath([string]$raw) {
    $path = "index.html"
    if ($raw -and $raw -ne "/") {
        $p = $raw.Split('?')[0].Split('#')[0]
        if ($p.Length -gt 1) {
            try { $decoded = [System.Uri]::UnescapeDataString($p) } catch { $decoded = $p }
            $decoded = $decoded -replace '\\', '/'
            $decoded = $decoded -replace '\.\.', ''
            $decoded = $decoded -replace '/+', '/'
            $decoded = $decoded.TrimStart('/', '\')
            if ($decoded -ne "") { $path = $decoded }
        }
    }

    # Fichiers internes jamais diffusables : ils ne servent pas a
    # l'application et contiennent des informations sensibles ou
    # inutiles pour le navigateur.
    #   build/          : secret de synchronisation, image des donnees,
    #                     scripts de build, journal de verification
    #   .* (cachés)     : .git, .synchro, .env, ...
    #   cloud/          : configuration de deploiement
    foreach ($seg in ($decoded -split '/')) {
        if ($seg -eq '') { continue }
        if ($seg.StartsWith('.')) { return $null }
        if ($seg -eq 'build' -or $seg -eq 'cloud') { return $null }
    }

    try {
        $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    } catch {
        return $null
    }
    if (-not $full.StartsWith($root)) { return $null }
    return $full
}

# Chemin journalisable : sans la query string (elle peut porter le
# secret de synchronisation).
function Get-LogPath([string]$raw) {
    if (-not $raw) { return '/' }
    $i = $raw.IndexOf('?')
    if ($i -ge 0) { return $raw.Substring(0, $i) }
    return $raw
}

# ------------------------------------------------------------
#  Unicode -> encodage UTF-8 (pour les en-tetes/traces)
# ------------------------------------------------------------
function Get-Utf8([string]$s) {
    return [System.Text.Encoding]::UTF8.GetBytes($s)
}

function Send-Response([System.Net.Sockets.NetworkStream]$stream, [string]$statusLine, [string]$contentType, [byte[]]$body) {
    # CORS : l'application peut etre servie par un autre poste que
    # celui qui heberge les donnees (http://localhost:8080 vers
    # http://192.168.1.20:8080). Les en-tetes ci-dessous autorisent
    # aussi le « Private Network Access » des navigateurs recents.
    $headerText = "$statusLine`r`n" +
                  "Content-Type: $contentType`r`n" +
                  "Cache-Control: no-store, no-cache, must-revalidate`r`n" +
                  "Pragma: no-cache`r`n" +
                  "Expires: 0`r`n" +
                  "Access-Control-Allow-Origin: *`r`n" +
                  "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
                  "Access-Control-Allow-Headers: Content-Type, X-Sync-Secret`r`n" +
                  "Access-Control-Max-Age: 600`r`n" +
                  "Access-Control-Allow-Private-Network: true`r`n" +
                  "Content-Length: $($body.Length)`r`n" +
                  "Connection: close`r`n" +
                  "`r`n"
    $header = Get-Utf8 $headerText
    $stream.Write($header, 0, $header.Length)
    if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

function Send-Json([System.Net.Sockets.NetworkStream]$stream, [string]$statusLine, $obj) {
    $body = Get-Utf8 ($obj | ConvertTo-Json -Depth 64 -Compress)
    Send-Response $stream $statusLine "application/json; charset=utf-8" $body
}

# ------------------------------------------------------------
#  Lecture d'une requete HTTP (en-tetes + corps)
#  Les en-tetes et le corps sont lus separement : on ne recopie
#  jamais le buffer a chaque lecture, ce qui rendrait le traitement
#  d'une image de plusieurs Mo inutilement lent.
# ------------------------------------------------------------
function Read-HttpRequest([System.Net.Sockets.NetworkStream]$stream) {
    $result = @{ Method = ''; Path = ''; Body = ''; Headers = @{} }
    $maxBody = 32MB

    # --- En-tetes (toujours courts) ---
    $head = New-Object System.Collections.Generic.List[byte]
    $buffer = New-Object byte[] 8192
    $headerEnd = -1
    $headerLen = 0
    $contentLength = 0
    $headText = ""

    while ($head.Count -lt 65536) {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { break }
        for ($i = 0; $i -lt $read; $i++) { $head.Add($buffer[$i]) }

        $headText = [System.Text.Encoding]::ASCII.GetString($head.ToArray())
        $headerEnd = $headText.IndexOf("`r`n`r`n")
        if ($headerEnd -ge 0) {
            $headerLen = $headerEnd + 4
            foreach ($line in ($headText.Substring(0, $headerEnd) -split "`r`n")) {
                $c = $line.IndexOf(':')
                if ($c -gt 0) {
                    $name = $line.Substring(0, $c).Trim().ToLower()
                    $value = $line.Substring($c + 1).Trim()
                    $result.Headers[$name] = $value
                    if ($name -eq 'content-length') {
                        $n = 0
                        if ([int]::TryParse($value, [ref]$n) -and $n -gt 0) { $contentLength = $n }
                    }
                }
            }
            break
        }
    }
    if ($headerEnd -lt 0) { return $result }

    $lines = $headText.Substring(0, $headerEnd) -split "`r`n"
    $parts = ($lines[0] -split ' ')
    if ($parts.Count -ge 2) {
        $result.Method = $parts[0]
        $result.Path = $parts[1]
    }

    # Les octets deja lus au-dela des en-tetes (corpus du body).
    $avail = $head.Count - $headerLen
    if ($avail -lt 0) { $avail = 0 }

    # --- Corps ---
    if ($contentLength -gt $maxBody) {
        $result.Headers['x-sync-overflow'] = '1'
        return $result
    }
    if ($contentLength -gt 0) {
        $body = New-Object byte[] $contentLength
        if ($avail -gt 0) {
            $take = [Math]::Min($avail, $contentLength)
            [Array]::Copy($head.ToArray(), $headerLen, $body, 0, $take)
            $avail = $take
        }
        $got = $avail
        while ($got -lt $contentLength) {
            $read = $stream.Read($body, $got, $contentLength - $got)
            if ($read -le 0) { break }
            $got += $read
        }
        if ($got -gt 0) { $result.Body = [System.Text.Encoding]::UTF8.GetString($body, 0, $got) }
    }
    return $result
}

# ------------------------------------------------------------
#  Endpoints de synchronisation (/__sync/...)
#  Voir js/lan.js pour le protocole cote application.
#  Le secret est transmis dans l'en-tete X-Sync-Secret (et non
#  dans l'URL) pour qu'il n'apparaisse jamais dans un journal, un
#  historique de navigateur ou un trace serveur.
# ------------------------------------------------------------
function Get-SyncSecretFrom($req) {
    $secret = ''
    if ($req.Headers -and $req.Headers.ContainsKey('x-sync-secret')) {
        $secret = [string]$req.Headers['x-sync-secret']
    }
    if (-not $secret) {
        # Repli : ancien format (secret dans le corps, puis dans la
        # query string), pour ne pas rendre inutilisable une version
        # precedente de l'application. La query string n'est jamais
        # journalisee.
        if ($req.Body -and $req.Body.Length -le 4096) {
            $i = $req.Body.IndexOf('"secret"')
            if ($i -ge 0 -and $req.Body -match '"secret"\s*:\s*"([^"\\]*)"') { $secret = $matches[1] }
        }
        if (-not $secret) {
            $i = $req.Path.IndexOf('?')
            if ($i -ge 0) {
                foreach ($kv in $req.Path.Substring($i + 1) -split '&') {
                    if ($kv -like 'secret=*') {
                        try { $secret = [System.Uri]::UnescapeDataString($kv.Substring(7)) } catch { $secret = $kv.Substring(7) }
                    }
                }
            }
        }
    }
    return $secret
}

# L'image est stockee telle quelle (octets JSON) et accompagnee d'un
# petit fichier de metadonnees : ainsi /__sync/state reste instantane
# (lecture de quelques octets) et /__sync/pull renvoie l'image sans
# avoir a la/deserialiser puis la reserialiser en PowerShell, operation
# tres lente sur plusieurs Mo.
function Get-SyncMeta() {
    if (Test-Path -LiteralPath $syncMetaFile) {
        try {
            return ([System.IO.File]::ReadAllText($syncMetaFile)) | ConvertFrom-Json
        } catch { return $null }
    }
    # Compatibilite : image anterieure sans fichier de metadonnees.
    if (Test-Path -LiteralPath $syncStateFile) {
        try {
            $st = ([System.IO.File]::ReadAllText($syncStateFile)) | ConvertFrom-Json
            return [ordered]@{
                v = $st.v; src = $st.src; poste = $st.poste
                updatedAt = $st.updatedAt
                bytes = (Get-Item -LiteralPath $syncStateFile).Length
            }
        } catch { return $null }
    }
    return $null
}

# Ecriture atomique (fichier temporaire puis remplacement) : un poste
# client ne doit jamais lire une image partielle.
function Write-AtomicFile([string]$path, [string]$content) {
    $tmp = "$path.tmp"
    [System.IO.File]::WriteAllText($tmp, $content, (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $tmp -Destination $path -Force
}

# Lecture de l'enveloppe (v / src / poste) sans analyser l'image
# entiere. Le client ecrit ces champs en tete de charge utile et
# n'envoie que du JSON issu de JSON.stringify : l'image est donc
# conservee telle quelle (aucune conversion, operation tres lente
# sur plusieurs Mo). Les controles ci-dessous rejettent les corps
# evidemment malformes (enveloppe abimee, champ data absent) ; en
# cas de doute on analyse complet, plus lent mais sur.
function Get-PushEnvelope([string]$body) {
    $head = if ($body.Length -gt 2048) { $body.Substring(0, 2048) } else { $body }
    if ($head -notmatch '"data"\s*:') { return $null }
    # Le nombre de version doit etre suivi de la virgule de fin
    # d'objet : « 1700000005000 + 8 » ou « 17000...abc » sont
    # rejetes au lieu d'etre pris pour une version valide.
    if ($head -notmatch '"v"\s*:\s*(\d+)\s*[,}]') { return $null }
    $v = [int64]$matches[1]
    $src = ''
    $poste = ''
    if ($head -match '"src"\s*:\s*"([^"\\]*)"') { $src = $matches[1] }
    if ($head -match '"poste"\s*:\s*"([^"\\]*)"') { $poste = $matches[1] }
    if ($v -gt 0) { return @{ v = $v; src = $src; poste = $poste } }
    try {
        $j = $body | ConvertFrom-Json
        return @{ v = [int64]$j.v; src = [string]$j.src; poste = [string]$j.poste }
    } catch {
        return $null
    }
}

function Handle-SyncRequest($req, [System.Net.Sockets.NetworkStream]$stream) {
    $path = $req.Path
    $secret = Get-SyncSecretFrom $req
    if ($secret -ne $script:secret) {
        Write-Host (" [SYNC 401] " + (Get-LogPath $path)) -ForegroundColor Red
        Send-Json $stream "HTTP/1.1 401 Unauthorized" @{ ok = $false; error = "secret invalide" }
        return $true
    }
    $clean = $path.Split('?')[0].TrimEnd('/')

    if ($clean -eq '/__sync/state' -and $req.Method -eq 'GET') {
        $st = Get-SyncMeta
        if (-not $st) {
            Write-Host (" [SYNC] state (vide)") -ForegroundColor DarkGray
            Send-Json $stream "HTTP/1.1 200 OK" @{ ok = $true; v = 0; src = "" }
            return $true
        }
        Send-Json $stream "HTTP/1.1 200 OK" @{ ok = $true; v = $st.v; src = $st.src }
        return $true
    }

    if ($clean -eq '/__sync/pull' -and $req.Method -eq 'GET') {
        $st = Get-SyncMeta
        if (-not $st -or -not (Test-Path -LiteralPath $syncStateFile)) {
            Send-Json $stream "HTTP/1.1 200 OK" @{ ok = $true; v = 0; src = ""; data = $null }
            return $true
        }
        Write-Host (" [SYNC] pull v" + $st.v + " (" + $st.poste + ", " + [Math]::Round($st.bytes / 1MB, 2) + " Mo)") -ForegroundColor DarkGray
        # Renvoi des octets tels quels : aucune conversion en cours.
        Send-Response $stream "HTTP/1.1 200 OK" "application/json; charset=utf-8" ([System.IO.File]::ReadAllBytes($syncStateFile))
        return $true
    }

    if ($clean -eq '/__sync/push' -and $req.Method -eq 'POST') {
        if ($req.Headers.ContainsKey('x-sync-overflow')) {
            Send-Json $stream "HTTP/1.1 413 Payload Too Large" @{ ok = $false; error = "image trop volumineuse (max 32 Mo)" }
            return $true
        }
        $body = [string]$req.Body
        if (-not $body) {
            Send-Json $stream "HTTP/1.1 400 Bad Request" @{ ok = $false; error = "corps vide" }
            return $true
        }
        $trimmed = $body.TrimStart()
        if (-not $trimmed.StartsWith('{') -or -not $body.TrimEnd().EndsWith('}')) {
            Send-Json $stream "HTTP/1.1 400 Bad Request" @{ ok = $false; error = "corps JSON illisible" }
            return $true
        }
        $env = Get-PushEnvelope $body
        if (-not $env -or $env.v -le 0) {
            Send-Json $stream "HTTP/1.1 400 Bad Request" @{ ok = $false; error = "horodatage manquant" }
            return $true
        }
        $v = $env.v
        $cur = Get-SyncMeta
        if ($cur -and ([int64]$cur.v -ge $v)) {
            # Image deja plus recente : le plus recent gagne (LWW).
            # On renvoie un drapeau explicite : le poste sait alors que
            # son image n'a pas ete retenue et doit tirer celle du serveur.
            Write-Host (" [SYNC] push ecarte (v" + $v + " <= v" + $cur.v + " de " + $cur.poste + ")") -ForegroundColor DarkGray
            Send-Json $stream "HTTP/1.1 200 OK" @{ ok = $true; v = $cur.v; src = $cur.src; ecarte = $true }
            return $true
        }
        try {
            # L'image est conservee telle quelle ; les metadonnees
            # (version, poste, taille) sont ecrites a part pour que
            # /__sync/state reste rapide.
            Write-AtomicFile $syncStateFile $body
            Write-AtomicFile $syncMetaFile (([ordered]@{
                v = $v
                src = $env.src
                poste = $env.poste
                updatedAt = (Get-Date).ToString('o')
                bytes = [System.Text.Encoding]::UTF8.GetByteCount($body)
            }) | ConvertTo-Json -Compress)
        } catch {
            Write-Host (" [SYNC] echec d'ecriture de l'image : " + $_.Exception.Message) -ForegroundColor Red
            Send-Json $stream "HTTP/1.1 500 Internal Server Error" @{ ok = $false; error = "image non enregistree" }
            return $true
        }
        Write-Host (" [SYNC] push recu v" + $v + " (" + $env.poste + ")") -ForegroundColor Green
        Send-Json $stream "HTTP/1.1 200 OK" @{ ok = $true; v = $v; src = $env.src; ecarte = $false }
        return $true
    }

    Send-Json $stream "HTTP/1.1 404 Not Found" @{ ok = $false; error = "operation inconnue" }
    return $true
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
        $client.ReceiveTimeout = 30000
        $client.SendTimeout = 60000
        $stream = $client.GetStream()

        $req = Read-HttpRequest $stream

        # --- Endpoints de synchronisation ---
        if ($req.Method -eq "") {
            # Requete incomplete : rien a repondre.
        } elseif ($req.Method -eq "OPTIONS") {
            # Preflight CORS (le secret transite par un en-tete, ce qui
            # declenche systematiquement une verification prealable).
            Send-Response $stream "HTTP/1.1 204 No Content" "text/plain" (New-Object byte[] 0)
        } elseif ($Sync -and $req.Path -like '/__sync*') {
            $null = Handle-SyncRequest $req $stream
        }
        # --- Fichiers statiques ---
        elseif ($req.Method -eq "GET" -or $req.Method -eq "HEAD") {
            $path = Get-SafePath $req.Path
            if (-not $path) {
                Write-Host ("  [403] " + (Get-LogPath $req.Path)) -ForegroundColor Yellow
                $body403 = Get-Utf8 "<!DOCTYPE html><html><head><meta charset='utf-8'><title>403</title></head><body><h1>403 - Acces refuse</h1><p>Ce dossier n'est pas diffuse par le serveur.</p></body></html>"
                Send-Response $stream "HTTP/1.1 403 Forbidden" "text/html; charset=utf-8" $body403
            } else {
                $ext = [System.IO.Path]::GetExtension($path).ToLower()
                $type = "application/octet-stream"
                if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }

                if (Test-Path -LiteralPath $path) {
                    $body = [System.IO.File]::ReadAllBytes($path)
                    $status = "HTTP/1.1 200 OK"
                    Write-Host ("  [OK] " + (Get-LogPath $req.Path)) -ForegroundColor Gray
                } else {
                    $body = Get-Utf8 "<!DOCTYPE html><html><head><meta charset='utf-8'><title>404</title></head><body><h1>404 - Non trouve</h1><p>Fichier introuvable: $(Get-LogPath $req.Path)</p></body></html>"
                    $status = "HTTP/1.1 404 Not Found"
                    $type = "text/html; charset=utf-8"
                    Write-Host (" [404] " + (Get-LogPath $req.Path)) -ForegroundColor Yellow
                }

                Send-Response $stream $status $type $body
            }
        } else {
            $body = Get-Utf8 "<html><body><h1>405 - Methode non autorisee</h1></body></html>"
            Send-Response $stream "HTTP/1.1 405 Method Not Allowed" "text/html; charset=utf-8" $body
        }
    } catch {
        # Requete anormale : on journalise pour rester diagnosticable
        # et on ferme la connexion sans interrompre le serveur.
        Write-Host ("  [ERREUR] " + $_.Exception.Message) -ForegroundColor Red
    } finally {
        try { $client.Close() } catch {}
    }
}

$listener.Stop()