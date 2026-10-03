$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$jsFiles = Get-ChildItem -Path "$root\js" -Recurse -Filter *.js

Write-Host "=== Analyse syntaxique des fichiers JS ===" -ForegroundColor Cyan
$hasError = $false

foreach ($file in $jsFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw
    # Retrait des commentaires avant comptage. « http:// » ou « file:// »
    # ecrits dans une chaine ne sont pas des commentaires : on exige qu'un
    # « // » ne soit ni precede de « : » ni d'un guillemet.
    $content = $content -replace '(?s)/\*.*?\*/', ''
    $content = [regex]::Replace($content, '(?m)(?<![:"''])//.*$', '')

    $open = ([regex]::Matches($content, '\{')).Count
    $close = ([regex]::Matches($content, '\}')).Count
    $openParen = ([regex]::Matches($content, '\(')).Count
    $closeParen = ([regex]::Matches($content, '\)')).Count

    $status = "OK"
    if ($open -ne $close) { $status = "ERREUR (accolades: $open/$close)"; $hasError = $true }
    if ($openParen -ne $closeParen) { $status += " (parenth: $openParen/$closeParen)"; $hasError = $true }

    Write-Host ("  {0,-40} {1}" -f $file.Name, $status)
}

Write-Host ""
Write-Host "=== Verification des scripts charges dans app.js ===" -ForegroundColor Cyan
$appJs = Get-Content -LiteralPath "$root\js\app.js" -Raw
$scripts = [regex]::Matches($appJs, "'(js/[^']+)'\s*(?:,|\])") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique

if ($scripts.Count -eq 0) { Write-Host "  [ATTENTION] aucun script liste" -ForegroundColor Yellow }

foreach ($imp in $scripts) {
    $target = Join-Path $root ($imp -replace '^\./', '')
    if (Test-Path $target) {
        Write-Host ("  [OK] $imp")
    } else {
        Write-Host ("  [MANQUANT] $imp") -ForegroundColor Red
        $hasError = $true
    }
}

Write-Host ""
Write-Host "=== Verification des modules enregistres ===" -ForegroundColor Cyan
$appContent = Get-Content -LiteralPath "$root\js\app.js" -Raw
$modNames = [regex]::Matches($appContent, "'(dashboard|admissions|patients|consultations|urgences|hospitalisations|services|pharmacie|laboratoire|imagerie|chirurgie|personnel|facturation|paiements|documents|reporting|parametres)'") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique

foreach ($name in $modNames) {
    $moduleFile = Get-ChildItem -Path "$root\js\modules" -Filter "$name.js"
    if ($moduleFile) {
        $content = Get-Content -LiteralPath $moduleFile.FullName -Raw
        $pattern = [regex]::Escape("window." + $name + "Module")
        if ($content -match $pattern) {
            Write-Host ("  [OK] $name (window.${name}Module detecte)")
        } else {
            Write-Host ("  [ATTENTION] $name (window.${name}Module non trouve)") -ForegroundColor Yellow
        }
    } else {
        Write-Host ("  [MANQUANT] fichier module $name.js") -ForegroundColor Red
        $hasError = $true
    }
}

Write-Host ""
Write-Host "=== Verification des appels de methodes des modules ===" -ForegroundColor Cyan
$allJs = (Get-ChildItem -Path "$root\js" -Recurse -Filter *.js)
foreach ($name in $modNames) {
    $moduleFile = Get-ChildItem -Path "$root\js\modules" -Filter "$name.js"
    if (-not $moduleFile) { continue }
    $modSrc = Get-Content -LiteralPath $moduleFile.FullName -Raw
    # Methodes definies dans l'objet module (enumerees à la marge gauche avec 4 espaces)
    $defs = [regex]::Matches($modSrc, "(?m)^    (async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(") | ForEach-Object { $_.Groups[2].Value } | Select-Object -Unique
    # Toutes les references a ce module dans les autres JS
    foreach ($f in $allJs) {
        if ($f.FullName -eq $moduleFile.FullName) { continue }
        $src = Get-Content -LiteralPath $f.FullName -Raw
        $calls = [regex]::Matches($src, [regex]::Escape($name + "Module") + "\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(") | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
        foreach ($c in $calls) {
            if ($defs -notcontains $c) {
                Write-Host ("  [ERREUR] $($f.Name): ${name}Module.$c( ) n'existe pas dans ${name}.js") -ForegroundColor Red
                $hasError = $true
            }
        }
    }
}
Write-Host "  (verification des methodes terminee)"

Write-Host ""
if ($hasError) {
    Write-Host "==> Des erreurs ont ete detectees" -ForegroundColor Red
} else {
    Write-Host "==> Analyse terminee sans erreur" -ForegroundColor Green
}

# Verifier la coherence des imports index.html
Write-Host ""
Write-Host "=== Verification des references dans index.html ===" -ForegroundColor Cyan
$indexHtml = Get-Content -LiteralPath "$root\index.html" -Raw
$cssRef = Test-Path "$root\css\styles.css"
$jsApp = Test-Path "$root\js\app.js"
Write-Host ("  css/styles.css: {0}" -f $(if ($cssRef) { "[OK]" } else { "[MANQUANT]"; $hasError = $true }))
Write-Host ("  js/app.js: {0}" -f $(if ($jsApp) { "[OK]" } else { "[MANQUANT]"; $hasError = $true }))

exit $(if ($hasError) { 1 } else { 0 })
