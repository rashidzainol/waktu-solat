# Jana js/jakim-data.js — data rasmi e-Solat JAKIM (setahun, semua zon)
# Sumber: https://www.e-solat.gov.my  (API takwimsolat, period=year)
$ErrorActionPreference = 'Stop'

$YEAR = 2026
$zones = [ordered]@{
  'WLY01' = 'Kuala Lumpur, Putrajaya'
  'WLY02' = 'Labuan'
  'JHR01' = 'Pulau Aur dan Pulau Pemanggil'
  'JHR02' = 'Johor Bahru, Kota Tinggi, Mersing, Kulai'
  'JHR03' = 'Kluang, Pontian'
  'JHR04' = 'Batu Pahat, Muar, Segamat, Gemas Johor, Tangkak'
  'KDH01' = 'Kota Setar, Kubang Pasu, Pokok Sena'
  'KDH02' = 'Kuala Muda, Yan, Pendang'
  'KDH03' = 'Padang Terap, Sik'
  'KDH04' = 'Baling'
  'KDH05' = 'Bandar Baharu, Kulim'
  'KDH06' = 'Langkawi'
  'KDH07' = 'Puncak Gunung Jerai'
  'KTN01' = 'Bachok, Kota Bharu, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai'
  'KTN02' = 'Gua Musang (Galas, Bertam), Jeli, Lojing'
  'MLK01' = 'Seluruh Negeri Melaka'
  'NGS01' = 'Tampin, Jempol'
  'NGS02' = 'Jelebu, Kuala Pilah, Rembau'
  'NGS03' = 'Port Dickson, Seremban'
  'PHG01' = 'Pulau Tioman'
  'PHG02' = 'Kuantan, Pekan, Muadzam Shah'
  'PHG03' = 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka'
  'PHG04' = 'Bentong, Lipis, Raub'
  'PHG05' = 'Genting Sempah, Janda Baik, Bukit Tinggi'
  'PHG06' = 'Cameron Highlands, Genting Highlands, Bukit Fraser'
  'PHG07' = 'Rompin (Rompin, Endau, Pontian)'
  'PLS01' = 'Kangar, Padang Besar, Arau'
  'PNG01' = 'Seluruh Negeri Pulau Pinang'
  'PRK01' = 'Tapah, Slim River, Tanjung Malim'
  'PRK02' = 'Kuala Kangsar, Sg. Siput, Ipoh, Batu Gajah, Kampar'
  'PRK03' = 'Lenggong, Pengkalan Hulu, Grik'
  'PRK04' = 'Temengor, Belum'
  'PRK05' = 'Kg Gajah, Teluk Intan, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pangkor'
  'PRK06' = 'Selama, Taiping, Bagan Serai, Parit Buntar'
  'PRK07' = 'Bukit Larut'
  'SBH01' = 'Sandakan (Timur), Bukit Garam, Semawang, Temanggong, Tambisan, Sukau'
  'SBH02' = 'Beluran, Telupid, Pinangah, Terusan, Kuamut, Sandakan (Barat)'
  'SBH03' = 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku, Tawau (Timur)'
  'SBH04' = 'Bandar Tawau, Balong, Merotai, Kalabakan, Tawau (Barat)'
  'SBH05' = 'Kudat, Kota Marudu, Pitas, Pulau Banggi'
  'SBH06' = 'Gunung Kinabalu'
  'SBH07' = 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan'
  'SBH08' = 'Pensiangan, Keningau, Tambunan, Nabawan'
  'SBH09' = 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston'
  'SGR01' = 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam'
  'SGR02' = 'Kuala Selangor, Sabak Bernam'
  'SGR03' = 'Klang, Kuala Langat'
  'SWK01' = 'Limbang, Lawas, Sundar, Trusan'
  'SWK02' = 'Miri, Niah, Bekenu, Sibuti, Marudi'
  'SWK03' = 'Pandan, Belaga, Suai, Tatau, Sebauh, Bintulu'
  'SWK04' = 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit'
  'SWK05' = 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai'
  'SWK06' = 'Lubok Antu, Sri Aman, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok'
  'SWK07' = 'Serian, Simunjan, Samarahan, Sebuyau, Meludam'
  'SWK08' = 'Kuching, Bau, Lundu, Sematan'
  'SWK09' = 'Zon Khas (Kampung Patarikan)'
  'TRG01' = 'Kuala Terengganu, Marang, Kuala Nerus'
  'TRG02' = 'Besut, Setiu'
  'TRG03' = 'Hulu Terengganu'
  'TRG04' = 'Dungun, Kemaman'
}

# Bilangan hari tahun (2026 bukan lompat = 365)
$daysInYear = [int]([datetime]::new($YEAR,12,31).DayOfYear)

$out = New-Object System.Text.StringBuilder
[void]$out.AppendLine("/* JAKIM e-Solat $YEAR - data rasmi waktu solat, dibenam untuk kegunaan luar talian.")
[void]$out.AppendLine("   Sumber: https://www.e-solat.gov.my (API takwimsolat, period=year).")
[void]$out.AppendLine("   Urutan waktu bagi setiap hari: imsak, subuh, syuruk, duha, zohor, asar, maghrib, isyak.")
[void]$out.AppendLine("   Index 0 = 1 Januari $YEAR. Format masa: 'HHMM'. */")
[void]$out.AppendLine("window.JAKIM_DATA = {")
[void]$out.AppendLine("  year: $YEAR,")
[void]$out.AppendLine("  zones: {")

$i = 0
foreach ($code in $zones.Keys) {
  $i++
  $url = "https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=year&zone=$code"
  Write-Host "[$i/$($zones.Count)] $code ..." -NoNewline
  try {
    $resp = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 90
    $j = $resp.Content | ConvertFrom-Json
    $pt = $j.prayerTime
    if ($pt.Count -ne $daysInYear) { throw "hanya $($pt.Count) hari" }
    $first = [datetime]::ParseExact($pt[0].date, 'dd-MMM-yyyy', [cultureinfo]::InvariantCulture)
    if ($first.Month -ne 1 -or $first.Day -ne 1) { throw "hari pertama bukan 1 Jan ($($pt[0].date))" }

    $lines = New-Object System.Text.StringBuilder
    $chunk = New-Object System.Collections.Generic.List[string]
    $n = 0
    foreach ($d in $pt) {
      $s = '{0}{1}{2}{3}{4}{5}{6}{7}' -f `
        ($d.imsak.Substring(0,5) -replace ':',''), ($d.fajr.Substring(0,5) -replace ':',''),
        ($d.syuruk.Substring(0,5) -replace ':',''), ($d.dhuha.Substring(0,5) -replace ':',''),
        ($d.dhuhr.Substring(0,5) -replace ':',''), ($d.asr.Substring(0,5) -replace ':',''),
        ($d.maghrib.Substring(0,5) -replace ':',''), ($d.isha.Substring(0,5) -replace ':','')
      $chunk.Add($s)
      $n++
      if ($chunk.Count -eq 25) {
        [void]$lines.AppendLine('    ' + (($chunk | ForEach-Object { '"' + $_ + '"' }) -join ',') + ',')
        $chunk.Clear()
      }
    }
    if ($chunk.Count -gt 0) {
      [void]$lines.AppendLine('    ' + (($chunk | ForEach-Object { '"' + $_ + '"' }) -join ',') + ',')
    }
    $body = $lines.ToString().TrimEnd("`r", "`n").TrimEnd(',')
    $sep = if ($i -lt $zones.Count) { ',' } else { '' }
    [void]$out.AppendLine("    ${code}: [$body]$sep")
    Write-Host " OK ($($pt.Count) hari)"
  } catch {
    Write-Host " GAGAL: $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
  Start-Sleep -Milliseconds 400
}

[void]$out.AppendLine("  }")
[void]$out.AppendLine("};")

New-Item -ItemType Directory -Force -Path js | Out-Null
[System.IO.File]::WriteAllText("$PWD\js\jakim-data.js", $out.ToString(), [System.Text.UTF8Encoding]::new($false))
$size = (Get-Item js\jakim-data.js).Length
Write-Host ""
Write-Host ("Selesai: js/jakim-data.js ({0:N0} bytes, {1} zon x {2} hari)" -f $size, $zones.Count, $daysInYear)
