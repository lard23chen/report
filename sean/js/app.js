// 初始化地圖，隱藏預設 Zoom 放置右下
const map = L.map('map', { zoomControl: false }).setView([25.0330, 121.5436], 14);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// 採用深色地圖 CartoDB Dark Matter 樣式 (或過濾 OSM)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// =========== 圖層管理 ===========
let heatLayer = null;
let trafficHexLayer = L.layerGroup().addTo(map);
let rentLayer = L.layerGroup().addTo(map);
let isochroneLayer = L.layerGroup().addTo(map);
let markerLayer = L.layerGroup().addTo(map);

// 產生隨機經緯度擴散
function genRandomPoints(center, count, radius) {
    let pts = [];
    for(let i=0; i<count; i++){
        pts.push([
            center[0] + (Math.random() - 0.5) * radius,
            center[1] + (Math.random() - 0.5) * radius,
            Math.random() * 100 // intensity
        ]);
    }
    return pts;
}

// 1. 競爭密度層 (Heatmap)
const centerCoord = [25.0330, 121.5436];
const heatPoints = genRandomPoints(centerCoord, 300, 0.05);
heatLayer = L.heatLayer(heatPoints, {radius: 20, blur: 25, gradient: {0.4: 'blue', 0.6: 'cyan', 0.7: 'lime', 0.8: 'yellow', 1.0: 'red'}}).addTo(map);

// 2. 人流動能層 (Hexagon Binning 模擬)
function renderHexagons() {
    trafficHexLayer.clearLayers();
    if(!document.getElementById('layer-traffic').checked) return;
    
    for(let i=0; i<20; i++){
        let lat = centerCoord[0] + (Math.random() - 0.5) * 0.04;
        let lng = centerCoord[1] + (Math.random() - 0.5) * 0.04;
        let p = L.circle([lat, lng], {
            color: '#9c27b0', fillColor: '#e1bee7', fillOpacity: 0.5, radius: 150
        }).bindTooltip(`<b>平均停留時間:</b> ${Math.floor(Math.random()*60)+20} min<br><b>女性佔比:</b> ${Math.floor(Math.random()*30)+40}%`);
        trafficHexLayer.addLayer(p);
    }
}

// 3. 租金水位層 (Choropleth 模擬)
function renderRentZones() {
    rentLayer.clearLayers();
    if(!document.getElementById('layer-rent').checked) return;

    let poly = L.polygon([
        [25.04, 121.53], [25.04, 121.55], [25.02, 121.55], [25.02, 121.53]
    ], {color: '#f44336', fillColor: '#ef5350', fillOpacity: 0.3, weight: 2})
    .bindPopup('<b>大安精華區</b><br><span>平均租金: 8,500/坪</span><br><span>趨勢: <span style="color:lime;">▲ 2.1%</span></span>');
    rentLayer.addLayer(poly);
}

// 監聽圖層切換
document.getElementById('layer-density').addEventListener('change', (e) => {
    if(e.target.checked) map.addLayer(heatLayer);
    else map.removeLayer(heatLayer);
});
document.getElementById('layer-traffic').addEventListener('change', renderHexagons);
document.getElementById('layer-rent').addEventListener('change', renderRentZones);


// =========== UI 互動邏輯 ===========

// 快捷導航 (Chips)
document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
        let lat = parseFloat(e.target.dataset.lat);
        let lng = parseFloat(e.target.dataset.lng);
        map.flyTo([lat, lng], 15, {duration: 1.5});
        
        // 更新地點
        centerCoord[0] = lat; centerCoord[1] = lng;
        if(heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = L.heatLayer(genRandomPoints(centerCoord, 300, 0.05), {radius: 20, blur: 25}).addTo(map);
        }
        renderHexagons();
    });
});

// 當點擊地圖時，顯示一個店面 Marker 並打開右側 Drawer
map.on('click', (e) => {
    markerLayer.clearLayers();
    const marker = L.marker(e.latlng).addTo(markerLayer);
    marker.bindPopup(`<b>目標評估點位</b><br><span>座標: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}</span>`).openPopup();
    
    openRightDrawer(`點位 ${e.latlng.lat.toFixed(3)}...`);
});

document.getElementById('close-drawer').addEventListener('click', () => {
    document.getElementById('right-drawer').classList.remove('open');
});

// 捷運等時圈 (Isochrone) 繪製
document.getElementById('btn-isochrone').addEventListener('click', () => {
    isochroneLayer.clearLayers();
    // 假設畫在目前中心
    L.circle(map.getCenter(), {radius: 400, color: '#00bcd4', fillOpacity: 0.2, weight: 2}).bindTooltip('步行 5 分鐘').addTo(isochroneLayer);
    L.circle(map.getCenter(), {radius: 800, color: '#4caf50', fillOpacity: 0.1, weight: 2, dashArray: "5, 10"}).bindTooltip('步行 10 分鐘').addTo(isochroneLayer);
    map.fitBounds(L.circle(map.getCenter(), {radius: 800}).getBounds());
});


// =========== Chart.js 雷達圖 (Radar Chart) ===========
let radarChart;
function openRightDrawer(title) {
    document.getElementById('profile-title').textContent = '商圈區域側寫';
    document.getElementById('profile-subtitle').textContent = title;
    document.getElementById('right-drawer').classList.add('open');

    // 隨機變換健康度
    document.querySelectorAll('.light').forEach(el=>el.classList.remove('active'));
    const lights = ['red', 'yellow', 'green'];
    const activeIdx = Math.floor(Math.random()*3);
    document.querySelector(`.light.${lights[activeIdx]}`).classList.add('active');

    // 更新雷達圖
    const ctx = document.getElementById('radarChart').getContext('2d');
    const dataVals = [Math.random()*100, Math.random()*100, Math.random()*100, Math.random()*100, Math.random()*100];
    
    if(radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['客群消費力', '競爭強度', '交通便利性', '租金 CP 值', '外送成長潛力'],
            datasets: [{
                label: '區域指標分數',
                data: dataVals,
                backgroundColor: 'rgba(0, 242, 254, 0.4)',
                borderColor: '#00f2fe',
                pointBackgroundColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#00f2fe',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#fff', font: {size: 11, family: 'Outfit'} },
                    ticks: { display: false, min: 0, max: 100 }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// =========== 時間軸 (Time Slider) ===========
const timeLabels = ['🌅 早餐 (06:00-10:00)', '🌞 午餐 (11:00-14:00)', '☕ 下午茶 (14:00-17:00)', '🌆 晚餐 (17:00-21:00)', '🌙 宵夜 (21:00-02:00)'];
document.getElementById('time-range').addEventListener('input', (e) => {
    document.getElementById('time-label').textContent = timeLabels[e.target.value];
    // 模擬動態更新熱點
    if(heatLayer) {
        heatLayer.setLatLngs(genRandomPoints(map.getCenter(), 300, 0.05 + Math.random()*0.02));
    }
});


// =========== PK 對比邏輯 ===========
let pkState = { a: null, b: null };
document.getElementById('add-pk-btn').addEventListener('click', () => {
    const locName = document.getElementById('profile-subtitle').textContent;
    document.getElementById('pk-sheet').classList.remove('hidden');

    if(!pkState.a) {
        pkState.a = locName;
        document.getElementById('pk-loc-a').textContent = locName;
        document.getElementById('pk-traffic-a').textContent = `${Math.floor(Math.random()*20000)+5000} 人/日`;
        document.getElementById('pk-rent-a').textContent = `${Math.floor(Math.random()*15)+10} %`;
    } else {
        pkState.b = locName;
        document.getElementById('pk-loc-b').textContent = locName;
        document.getElementById('pk-traffic-b').textContent = `${Math.floor(Math.random()*20000)+5000} 人/日`;
        document.getElementById('pk-rent-b').textContent = `${Math.floor(Math.random()*15)+10} %`;
    }
});
