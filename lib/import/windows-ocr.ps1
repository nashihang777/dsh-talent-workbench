<#
  Local OCR helper for the talent workbench.

  Uses the Windows.Media.Ocr engine that ships with Windows 10/11. It runs
  under Windows PowerShell 5.1 (WinRT projection is unavailable in pwsh 7)
  and writes UTF-8 text without a BOM to -OutPath. Nothing leaves the machine.

  Exit codes: 0 ok, 2 engine unavailable, 3 recognition failed, 4 bad input.
#>
param(
  [Parameter(Mandatory = $true)][string]$ImagePath,
  [Parameter(Mandatory = $true)][string]$OutPath,
  [string]$Language = 'zh-Hans-CN'
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
  $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
  $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
  $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
  $null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
} catch {
  Write-Error "WinRT projection unavailable: $($_.Exception.Message)"
  exit 2
}

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

if ($null -eq $asTaskGeneric) {
  Write-Error 'AsTask helper not found'
  exit 2
}

function Await($operation, $resultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
  $netTask = $asTask.Invoke($null, @($operation))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$engine = $null
try {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Language))
} catch { $engine = $null }
if ($null -eq $engine) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) {
  foreach ($lang in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    if ($null -ne $engine) { break }
  }
}
if ($null -eq $engine) {
  Write-Error 'No OCR recognizer language is installed'
  exit 2
}

if (-not (Test-Path -LiteralPath $ImagePath)) {
  Write-Error "Image not found: $ImagePath"
  exit 4
}

try {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path -LiteralPath $ImagePath).Path)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

  $max = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
  if ($bitmap.PixelWidth -gt $max -or $bitmap.PixelHeight -gt $max) {
    $scale = [Math]::Min($max / $bitmap.PixelWidth, $max / $bitmap.PixelHeight)
    $transform = [Windows.Graphics.Imaging.BitmapTransform]::new()
    $transform.ScaledWidth = [uint32][Math]::Floor($bitmap.PixelWidth * $scale)
    $transform.ScaledHeight = [uint32][Math]::Floor($bitmap.PixelHeight * $scale)
    $transform.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
    $stream.Seek(0) | Out-Null
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $transform, [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  }

  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($line in $result.Lines) { $lines += $line.Text }
  $text = ($lines -join "`n")
  [System.IO.File]::WriteAllText($OutPath, $text, [System.Text.UTF8Encoding]::new($false))
  # Report which recognizer actually ran, so the caller can warn on a missing
  # Chinese language pack instead of silently returning Latin-script noise.
  $tag = ''
  try { $tag = $engine.RecognizerLanguage.LanguageTag } catch { $tag = '' }
  if ($tag -ne '') { [System.IO.File]::WriteAllText($OutPath + '.lang', $tag, [System.Text.UTF8Encoding]::new($false)) }
  exit 0
} catch {
  Write-Error "OCR failed: $($_.Exception.Message)"
  exit 3
}
