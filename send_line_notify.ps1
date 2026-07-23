# send_line_notify.ps1
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File send_line_notify.ps1 -Template daily
#        powershell -NoProfile -ExecutionPolicy Bypass -File send_line_notify.ps1 -Template travel -Status FAIL -Detail "git push 失敗"
# Templates: daily | ga | travel
param(
    [string]$Template = "daily",
    [string]$Status = "OK",
    [string]$Detail = ""
)

$url   = "https://publiclinemessageapi.azurewebsites.net/api/LineBot/SendMessage"
$token = "C899832bec63146ee4801ae43b3a3cc23"
$now   = Get-Date -Format "yyyy/MM/dd HH:mm"

$messages = @{
    daily     = "`n`n[Qware] A 系統日報 + 高雄啤酒節報表更新完成`n執行時間：$now`n已推送至 GitHub Pages"
    ga        = "`n`n[Qware] GA 流量報表更新完成`n執行時間：$now`n已推送至 GitHub Pages"
    travel    = "`n`n[Qware] 旅遊記帳 + 購物清單報表更新完成`n執行時間：$now`n已推送至 GitHub Pages"
    dmp_top10 = "`n`n[Qware] DMP 歷史 Top10 流量報表更新完成`n執行時間：$now`n已推送至 GitHub Pages"
}

$failLabels = @{
    daily     = "A 系統日報 + 高雄啤酒節報表"
    ga        = "GA 流量報表"
    travel    = "旅遊記帳 + 購物清單報表"
    weekly    = "A 系統週報"
    dmp_top10 = "DMP 歷史 Top10 流量報表"
}

if ($Status -eq "FAIL") {
    $label = $failLabels[$Template]
    if (-not $label) { $label = "排程任務" }
    $msg = "`n`n[Qware] ⚠ $label 更新失敗`n執行時間：$now"
    if ($Detail) { $msg += "`n原因：$Detail" }
    $msg += "`n請檢查對應 log 檔"
} else {
    $msg = $messages[$Template]
    if (-not $msg) {
        $msg = "`n`n[Qware] 排程任務完成`n執行時間：$now"
    }
}

try {
    Invoke-RestMethod `
        -Uri         $url `
        -Method      Post `
        -Headers     @{ Authorization = "Bearer $token" } `
        -Body        @{ message = $msg } `
        -ContentType "application/x-www-form-urlencoded" | Out-Null
    Write-Host "[LINE] OK: $Template"
} catch {
    Write-Host "[LINE] FAILED: $_"
}
