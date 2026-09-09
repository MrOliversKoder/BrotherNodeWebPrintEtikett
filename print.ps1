param(
    [Parameter(Mandatory = $true)]
    [string]$JobFile
)

$ErrorActionPreference = 'Stop'

function Write-JsonResult {
    param($obj)
    # -Compress so Node gets a single clean line on stdout
    [Console]::Out.Write(($obj | ConvertTo-Json -Depth 6 -Compress))
}

$doc = $null

try {
    if (-not (Test-Path -LiteralPath $JobFile)) {
        throw "Fant ikke jobbfil: $JobFile"
    }

    $job = Get-Content -LiteralPath $JobFile -Raw | ConvertFrom-Json

    $printerName  = $job.printerName
    $templatePath = $job.templatePath
    $objectName   = $job.objectName
    $labels       = @($job.labels)
    $copies       = [int]$job.copies
    if ($copies -lt 1) { $copies = 1 }

    if (-not $templatePath) { throw "templatePath mangler i config.json" }
    if (-not (Test-Path -LiteralPath $templatePath)) { throw "Fant ikke mal (templatePath): $templatePath" }
    if (-not $objectName) { throw "objectName mangler i config.json" }
    if ($labels.Count -eq 0) { throw "Ingen etiketter å skrive ut" }

    # b-PAC SDK is 32-bit only - this must be run from 32-bit PowerShell.
    $doc = New-Object -ComObject bpac.Document

    if (-not $doc.Open($templatePath)) {
        throw "Kunne ikke åpne mal: $templatePath"
    }

    if ($printerName) {
        # (printerName, IsDefaultPrinter) - false = force use of the named printer
        $doc.SetPrinter($printerName, $false) | Out-Null
    }

    $results = New-Object System.Collections.Generic.List[object]

    foreach ($text in $labels) {
        $obj = $doc.GetObject($objectName)
        if ($null -eq $obj) {
            throw "Fant ikke tekstobjekt '$objectName' i malen"
        }
        $obj.Text = [string]$text

        $doc.StartPrint('', 0) | Out-Null
        $doc.PrintOut($copies, 0) | Out-Null
        $doc.EndPrint() | Out-Null

        $results.Add(@{ text = $text; copies = $copies; success = $true })
    }

    $doc.Close() | Out-Null

    Write-JsonResult @{ success = $true; printer = $printerName; results = $results }
    exit 0
}
catch {
    Write-JsonResult @{ success = $false; error = $_.Exception.Message }
    exit 1
}
finally {
    if ($null -ne $doc) {
        try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null } catch {}
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
