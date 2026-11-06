# Jana semua ikon app daripada logo: PWA (192/512 + maskable) dan launcher Android.
# Guna: powershell -ExecutionPolicy Bypass -File make-icons.ps1 <logo-source.jpg>
param([string]$Source = 'C:\Users\JabatanAudit02\Downloads\Gemini_Generated_Image_kd7y81kd7y81kd7y.jpg')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = [System.Drawing.Image]::FromFile($Source)
$W = $src.Width; $H = $src.Height

# ---- 1. Cari bounding box kandungan (pixel yang jauh drpd latar putih) ----
$bmpIn = New-Object System.Drawing.Bitmap($src)
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$md = $bmpIn.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($md.Stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($md.Scan0, $bytes, 0, $bytes.Length)
$bmpIn.UnlockBits($md); $bmpIn.Dispose()

# warna latar = purata 4 penjuru
$sum = 0, 0, 0; $n = 0
foreach ($cx in @(2, ($W - 3))) {
  foreach ($cy in @(2, ($H - 3))) {
    $i = $cy * $md.Stride + $cx * 4
    $sum[0] += $bytes[$i]; $sum[1] += $bytes[$i + 1]; $sum[2] += $bytes[$i + 2]; $n++
  }
}
$bg = @(($sum[0] / $n), ($sum[1] / $n), ($sum[2] / $n))
"Tol Latar: RGB($([int]$bg[0]),$([int]$bg[1]),$([int]$bg[2]))"

$tol = 30
$minX = $W; $minY = $H; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $H; $y += 2) {
  for ($x = 0; $x -lt $W; $x += 2) {
    $i = $y * $md.Stride + $x * 4
    $d = [Math]::Abs($bytes[$i] - $bg[0]) + [Math]::Abs($bytes[$i + 1] - $bg[1]) + [Math]::Abs($bytes[$i + 2] - $bg[2])
    if ($d -gt $tol) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
"Kandungan: x=$minX..$maxX y=$minY..$maxY"
$pad = [Math]::Max(($maxX - $minX), ($maxY - $minY)) * 0.02 + 8
$cw = ($maxX - $minX) + 2 * $pad
$ch = ($maxY - $minY) + 2 * $pad
$side = [Math]::Max($cw, $ch)
if ($side -gt $W) { $side = $W }

# ---- 2. Kanvas segi empat sama putih, kandungan di tengah ----
$sq = New-Object System.Drawing.Bitmap([int]$side, [int]$side)
$g = [System.Drawing.Graphics]::FromImage($sq)
$g.SmoothingMode = 'HighQuality'; $g.InterpolationMode = 'HighQualityBicubic'
$g.PixelOffsetMode = 'HighQuality'
$g.Clear([System.Drawing.Color]::White)
$dx = ($side - $cw) / 2
$dy = ($side - $ch) / 2
$sr = New-Object System.Drawing.Rectangle([int]($minX - $pad), [int]($minY - $pad), [int]$cw, [int]$ch)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle([int]$dx, [int]$dy, [int]$cw, [int]$ch)), $sr, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# ---- 3. Fungsi: resize + penjuru bulat, keluar PNG ----
function Save-Rounded([System.Drawing.Bitmap]$base, [int]$size, [double]$radiusFrac, [string]$path) {
  $out = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
  $r = $size * $radiusFrac
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $gp.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
  $gp.AddArc($size - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
  $gp.AddArc($size - 2 * $r, $size - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $gp.AddArc(0, $size - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $gp.CloseFigure()
  $g.SetClip($gp)
  $g.DrawImage($base, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
  $g.Dispose()
  # pastikan latar luar clip telus
  $mask = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g2 = [System.Drawing.Graphics]::FromImage($mask)
  $g2.Clear([System.Drawing.Color]::Transparent)
  $g2.InterpolationMode = 'HighQualityBicubic'
  $g2.SetClip($gp)
  $g2.DrawImage($out, (New-Object System.Drawing.Rectangle(0, 0, $size, $size)))
  $g2.Dispose()
  $mask.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $mask.Dispose(); $gp.Dispose(); $out.Dispose()
}

function Save-Square([System.Drawing.Bitmap]$base, [int]$size, [double]$contentFrac, [string]$path) {
  $out = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = 'HighQualityBicubic'; $g.SmoothingMode = 'HighQuality'
  $s2 = $size * $contentFrac
  $g.DrawImage($base, (New-Object System.Drawing.Rectangle([int](($size - $s2) / 2), [int](($size - $s2) / 2), [int]$s2, [int]$s2)))
  $g.Dispose()
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
}

# PWA: ikon biasa (penjuru bulat mais jelmaan) + maskable (kandungan 78% dalam zon selamat)
Save-Rounded $sq 512 0.18 (Join-Path $root 'icon-512.png')
Save-Rounded $sq 192 0.18 (Join-Path $root 'icon-192.png')
Save-Square $sq 512 0.78 (Join-Path $root 'icon-maskable-512.png')

# Android launcher: semua kepadatan, penjuru bulat 0.20
$densities = @{
  'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192
}
foreach ($d in $densities.Keys) {
  $dir = Join-Path $root "android\app\src\main\res\mipmap-$d"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Save-Rounded $sq $densities[$d] 0.20 (Join-Path $dir 'ic_launcher.png')
}

$sq.Dispose(); $src.Dispose()
"Siap."
Get-ChildItem $root -Include 'icon-*.png' -Recurse -Depth 0 | Select-Object Name, Length
