$tasks = schtasks /query /fo CSV /v | ConvertFrom-Csv
$target = $tasks | Where-Object { $_.'Task To Run' -match 'daily_update.bat' }
if ($target) {
    $target | Select-Object 'TaskName', 'Status', 'Last Run Time', 'Last Result' | Format-List
} else {
    echo "No task found running daily_update.bat"
}
