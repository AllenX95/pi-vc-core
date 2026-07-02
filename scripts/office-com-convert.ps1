param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)

$inputFull = [System.IO.Path]::GetFullPath($InputPath)
$outputFull = [System.IO.Path]::GetFullPath($OutputPath)
$extension = [System.IO.Path]::GetExtension($inputFull).ToLowerInvariant()

try {
  if ($extension -eq ".doc") {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $document = $word.Documents.Open($inputFull)
    $document.SaveAs2($outputFull, 12)
    $document.Close($false)
    $word.Quit()
  } elseif ($extension -eq ".ppt") {
    $powerPoint = New-Object -ComObject PowerPoint.Application
    $presentation = $powerPoint.Presentations.Open($inputFull, $true, $false, $false)
    $presentation.SaveAs($outputFull, 24)
    $presentation.Close()
    $powerPoint.Quit()
  } else {
    throw "Unsupported legacy Office extension: $extension"
  }

  @{ ok = $true; outputPath = $outputFull } | ConvertTo-Json -Compress
} catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 1
}
