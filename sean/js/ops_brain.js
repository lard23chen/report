document.addEventListener('DOMContentLoaded', () => {
    // 設置 Chart.js 預設字體與顏色
    Chart.defaults.color = '#adb5bd';
    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctx = document.getElementById('costTrendChart').getContext('2d');
    
    // 建立漸層色
    const gradientThisWeek = ctx.createLinearGradient(0, 0, 0, 300);
    gradientThisWeek.addColorStop(0, 'rgba(0, 229, 255, 0.4)');
    gradientThisWeek.addColorStop(1, 'rgba(0, 229, 255, 0.01)');

    const gradientLastWeek = ctx.createLinearGradient(0, 0, 0, 300);
    gradientLastWeek.addColorStop(0, 'rgba(123, 44, 191, 0.4)');
    gradientLastWeek.addColorStop(1, 'rgba(123, 44, 191, 0.01)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'],
            datasets: [
                {
                    label: '本週成本 (NT$)',
                    data: [12000, 13500, 11000, 14200, 18500, 22000, null], // 週日尚未發生
                    borderColor: '#00e5ff',
                    backgroundColor: gradientThisWeek,
                    borderWidth: 3,
                    pointBackgroundColor: '#0f111a',
                    pointBorderColor: '#00e5ff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '上週同期成本 (NT$)',
                    data: [11500, 12800, 10500, 13000, 17500, 20500, 21000],
                    borderColor: '#7b2cbf',
                    backgroundColor: gradientLastWeek,
                    borderWidth: 2,
                    borderDash: [5, 5], // 虛線表示歷史
                    pointRadius: 0, // 隱藏點
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 17, 26, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        callback: function(value) {
                            return 'NT$ ' + (value / 1000) + 'k';
                        }
                    }
                }
            }
        }
    });

    // 模擬動態更新邏輯 (Live P&L Logic) 
    // 每數秒接收 POS 新收據推播並更新
    setInterval(() => {
        const revenueEl = document.getElementById('live-revenue');
        if(!revenueEl) return;
        
        const currentRevText = revenueEl.innerText.replace(/[^0-9]/g, '');
        let newRev = parseInt(currentRevText) + Math.floor(Math.random() * 350) + 150;
        
        revenueEl.innerHTML = `NT$ ${newRev.toLocaleString()}`;
        revenueEl.style.textShadow = '0 0 15px #00e5ff';
        setTimeout(() => { revenueEl.style.textShadow = 'none'; }, 400);

    }, 3200);
});
