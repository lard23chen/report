const fs = require('fs');

const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>我的所有旅遊行程 - 2026/04 泰國</title>
    <link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Zen Maru Gothic', sans-serif; background: #f0f4f8; padding: 40px; color: #333; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; color: #2c3e50; margin-bottom: 40px; }
        .trip-card { background: white; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 40px; overflow: hidden; }
        .trip-header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
        .trip-header h2 { margin: 0; font-size: 1.5rem; }
        .trip-date { opacity: .9; font-size: .9rem; }
        .timeline { padding: 30px; }
        .event { display: flex; margin-bottom: 20px; align-items: flex-start; }
        .event-date { width: 120px; font-weight: 700; color: #7f8c8d; font-size: .9rem; padding-top: 3px; }
        .event-icon { width: 40px; text-align: center; font-size: 1.2rem; margin-right: 15px; }
        .event-content { flex: 1; border-left: 2px solid #ecf0f1; padding-left: 20px; padding-bottom: 10px; }
        .event:last-child .event-content { border-left: none; }
        .event-title { font-weight: 700; color: #34495e; }
        .event-desc { color: #7f8c8d; font-size: .9rem; margin-top: 4px; }
        .price { color: #e67e22; font-weight: 700; font-size: .8rem; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>✈️ 我的所有旅遊行程</h1>
        
        <div class="trip-card">
            <div class="trip-header">
                <h2>BKK (2026/04 ที่ กทม)</h2>
                <div class="trip-date">2026/4/10 - 2026/4/19</div>
            </div>
            <div class="timeline">
                
                <div class="event">
                    <div class="event-date">4/10 22:40</div>
                    <div class="event-icon">✈️</div>
                    <div class="event-content">
                        <div class="event-title">GO CI837</div>
                        <div class="event-desc">
                            <b>BKK</b> (TPE 飛往 BKK)<br>
                            機型: Airbus A321neo<br>
                            抵達時間: 1:25 (+1)<br>
                            乘客: ALEX, MARK
                        </div>
                        <div class="price">NT$ 17,084 (8,542 x 2)</div>
                    </div>
                </div>

                <div class="event">
                    <div class="event-date">4/10</div>
                    <div class="event-icon">🏨</div>
                    <div class="event-content">
                        <div class="event-title">入住飯店</div>
                        <div class="event-desc">
                            Holiday Inn Express Bangkok Siam<br>
                            <small>2026/4/10 - 2026/4/12</small><br>
                            體系: IHG | 支付: 大戶(4708) | 備註: 69815421
                        </div>
                        <div class="price">Point 36,000</div>
                    </div>
                </div>

                <div class="event">
                    <div class="event-date">4/12</div>
                    <div class="event-icon">🏨</div>
                    <div class="event-content">
                        <div class="event-title">入住飯店</div>
                        <div class="event-desc">
                            The standard bangkok mahanakhon<br>
                            <small>2026/4/12 - 2026/4/17</small><br>
                            體系: 私享 | 支付: 華航(3500) | 免費取消: 2026/04/09 15:00 前<br>
                            備註: 私享禮遇85折優惠、贈送雙重禮遇等
                        </div>
                        <div class="price">THB 30,904</div>
                    </div>
                </div>

                <div class="event">
                    <div class="event-date">4/17</div>
                    <div class="event-icon">🏨</div>
                    <div class="event-content">
                        <div class="event-title">入住飯店</div>
                        <div class="event-desc">
                            The standard bangkok mahanakhon<br>
                            <small>2026/4/17 - 2026/4/19</small><br>
                            體系: 私享 | 支付: 華航(3500) | 免費取消: 2026/04/14 15:00 前<br>
                            備註: 私享禮遇85折優惠、贈送雙重禮遇等
                        </div>
                        <div class="price">THB 11,805</div>
                    </div>
                </div>

                <div class="event">
                    <div class="event-date">4/19 13:20</div>
                    <div class="event-icon">✈️</div>
                    <div class="event-content">
                        <div class="event-title">BACK CI832</div>
                        <div class="event-desc">
                            <b>TPE</b> (BKK 飛往 TPE)<br>
                            機型: Airbus A350-900<br>
                            抵達時間: 18:00<br>
                            乘客: ALEX, MARK
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>
</body>
</html>`;

fs.writeFileSync('d:/2025/AI/MongoDB/travel/travel_index.html', html, 'utf8');
console.log('Successfully generated travel_index.html with the 20260409-20250419 data.');
