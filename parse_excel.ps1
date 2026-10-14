$excelPath = "C:\Antigravity Projects Tommi\Exercise Import file.xlsx"
$jsonPath = "C:\Antigravity Projects Tommi\parsed_import.json"

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open($excelPath)
$ws = $wb.Sheets.Item(1)
$rowCount = $ws.UsedRange.Rows.Count

$rows = @()

for ($r = 2; $r -le $rowCount; $r++) {
    $date = $ws.Cells.Item($r, 1).Text.Trim()
    $exercise = $ws.Cells.Item($r, 2).Text.Trim()
    $weight = $ws.Cells.Item($r, 3).Text.Trim()
    $reps = $ws.Cells.Item($r, 4).Text.Trim()
    $warmup = $ws.Cells.Item($r, 5).Text.Trim()
    $notes = $ws.Cells.Item($r, 6).Text.Trim()

    if ($date -ne "" -and $exercise -ne "") {
        $rows += [PSCustomObject]@{
            Date = $date
            Exercise = $exercise
            Weight = [double]$weight
            Reps = [int]$reps
            Warmup = ($warmup -match "yes|1|true")
            Notes = $notes
        }
    }
}

$wb.Close($false)
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

$rows | ConvertTo-Json -Depth 4 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host "Successfully parsed $($rows.Count) rows to $jsonPath"
