// 初始化地圖 (以台北市大安區為中心點)
const map = L.map('map').setView([25.0330, 121.5436], 14);

// 載入 OpenStreetMap 圖塊
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 建立一些假資料點 (潛在店址)
const locations = [
    { coords: [25.0330, 121.5436], title: '復興南路一段店面', score: 85, rent: 12 },
    { coords: [25.0410, 121.5480], title: '忠孝東路四段店面', score: 72, rent: 25 },
    { coords: [25.0250, 121.5300], title: '和平東路二段店面', score: 91, rent: 8 }
];

let markers = [];

// 在地圖上繪製點位
function renderMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    locations.forEach(loc => {
        const marker = L.marker(loc.coords).addTo(map)
            .bindPopup(`
                <b style="color: #333;">${loc.title}</b><br>
                <span style="color: #555;">預估租金: ${loc.rent} 萬/月</span><br>
                <strong style="color: #4caf50;">AI 推薦分數: ${loc.score}</strong>
            `);
        markers.push(marker);
    });
}
renderMarkers();

// 預算拉桿連動
const budgetInput = document.getElementById('budget');
const budgetValue = document.getElementById('budget-value');
budgetInput.addEventListener('input', (e) => {
    budgetValue.textContent = `${e.target.value} 萬`;
});

// 圖表初始化
const ctxPop = document.getElementById('populationChart').getContext('2d');
const popChart = new Chart(ctxPop, {
    type: 'bar',
    data: {
        labels: ['20-29歲', '30-39歲', '40-49歲', '50歲以上'],
        datasets: [{
            label: '區域人口輪廓 (%)',
            data: [25, 35, 20, 20],
            backgroundColor: '#4caf50',
            borderRadius: 4
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { labels: { color: '#f0f0f0' } }
        },
        scales: {
            y: { ticks: { color: '#aaaaaa' }, grid: { color: '#333' } },
            x: { ticks: { color: '#aaaaaa' }, grid: { color: '#333' } }
        }
    }
});

const ctxComp = document.getElementById('competitorChart').getContext('2d');
const compChart = new Chart(ctxComp, {
    type: 'doughnut',
    data: {
        labels: ['連鎖品牌', '獨立店家', '替代性餐飲'],
        datasets: [{
            data: [40, 45, 15],
            backgroundColor: ['#ff9800', '#2196f3', '#e91e63'],
            borderWidth: 0
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#f0f0f0' } },
            title: { display: true, text: '區內競爭者類型分佈', color: '#f0f0f0' }
        }
    }
});

// 分析按鈕點擊事件，串接真實與模擬開放資料後端
document.getElementById('analyze-btn').addEventListener('click', async () => {
    const btn = document.getElementById('analyze-btn');
    btn.textContent = 'API 運算中...';
    btn.style.opacity = '0.7';

    // 擷取目前表單資料
    const reqData = {
        city: document.getElementById('city').value,
        district: document.getElementById('district').value,
        restaurant_type: document.getElementById('restaurant-type').value,
        budget: parseInt(document.getElementById('budget').value)
    };

    try {
        const response = await fetch('http://127.0.0.1:8000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqData)
        });

        if (!response.ok) throw new Error('API 無法取得回應');
        
        const data = await response.json();

        // 更新綜合評分
        document.getElementById('score-card').style.display = 'block';
        document.getElementById('final-score').textContent = data.final_score;

        // 更新開放資料相關設施
        document.getElementById('mrt-count').textContent = data.analytics.facilities.mrt_stations;
        document.getElementById('office-count').textContent = data.analytics.facilities.office_buildings;
        document.getElementById('school-count').textContent = data.analytics.facilities.schools;
        
        // 更新人口輪廓與競爭者圖表
        popChart.data.datasets[0].data = data.analytics.population_distribution;
        popChart.update();

        compChart.data.datasets[0].data = data.analytics.competitor_ratio;
        compChart.update();

        // 更新地圖中心與推薦點位（整合實價登錄模擬推估）
        map.setView(data.map_center, 15);
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        data.recommended_locations.forEach(loc => {
            const marker = L.marker(loc.coords).addTo(map)
                .bindPopup(`
                    <b style="color: #333;">${loc.title}</b><br>
                    <span style="color: #555;">開放資料預估租金: ${loc.rent} 萬/月</span><br>
                    <strong style="color: #4caf50;">選址演算法分數: ${loc.score}</strong>
                `);
            markers.push(marker);
        });
    } catch (err) {
        console.error(err);
        alert('請先啟動後端伺服器 (uvicorn main:app) 才可取得真實運算資料。');
    } finally {
        btn.textContent = '開始綜合分析';
        btn.style.opacity = '1';
    }
});
