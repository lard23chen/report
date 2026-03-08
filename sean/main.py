import random
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="智慧選址系統 API", description="整合外部開放資料與選址演算")

# 允許前端跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    city: str
    district: str
    restaurant_type: str
    budget: int

# 模擬真實經緯度中心
REGION_COORDS = {
    "taipei": {"daan": [25.0263, 121.5434], "xinyi": [25.0330, 121.5644], "zhongshan": [25.0645, 121.5284]},
    "new_taipei": {"banqiao": [25.0123, 121.4657]},
    "taichung": {"xitun": [24.1623, 120.6385]},
    "kaohsiung": {"zuoying": [22.6804, 120.3015]}
}

def fetch_opendata_facilities(lat, lng):
    """
    這邊預留串接政府開放資料的 API，例如：
    1. 內政部實價登錄 API
    2. PTX (TDX) 運輸資料 API (捷運站、公車站)
    此處以模擬政府 API 回傳格式為例。
    """
    # 實際應用可發 requests 到 data.gov.tw 等
    # res = requests.get("https://.../api")
    return {
        "mrt_stations": random.randint(0, 5),
        "office_buildings": random.randint(3, 20),
        "schools": random.randint(1, 8)
    }

@app.get("/")
def read_root():
    return {"message": "智慧選址系統 API 正在運行中，請透過前端的 index.html 進行操作。"}

@app.get("/api/analyze")
def analyze_site_get():
    return {"error": "請使用 POST 請求並提供 JSON 格式的選址條件來進行分析。"}

@app.post("/api/analyze")
def analyze_site(req: AnalyzeRequest):
    # 決定中心坐標
    base_coord = REGION_COORDS.get(req.city, {}).get(req.district, [25.0330, 121.5436])
    
    # 向開放資料 API 獲取周邊設施數量
    facilities = fetch_opendata_facilities(base_coord[0], base_coord[1])
    
    # 假定選出 3 個可能物件 (結合實價登錄租金模擬)
    locations = []
    for i in range(3):
        offset_lat = base_coord[0] + (random.random() - 0.5) * 0.01
        offset_lng = base_coord[1] + (random.random() - 0.5) * 0.01
        
        # 實價登錄模擬：依據行政區、坪數得出概略租金
        est_rent = random.randint(max(5, req.budget - 5), req.budget + 10)
        
        locations.append({
            "title": f"精選店面 {i+1}",
            "coords": [offset_lat, offset_lng],
            "rent": est_rent,
            "score": random.randint(70, 95)
        })

    # 模擬政府人口普查數據 API 結構
    population_data = [
        random.randint(15, 30), # 20-29
        random.randint(20, 40), # 30-39
        random.randint(15, 25), # 40-49
        random.randint(10, 20)  # 50+
    ]

    return {
        "status": "success",
        "map_center": base_coord,
        "recommended_locations": locations,
        "analytics": {
            "population_distribution": population_data,
            "competitor_ratio": [random.randint(20, 50), random.randint(30, 50), random.randint(10, 20)],
            "facilities": facilities
        },
        "final_score": sum(loc["score"] for loc in locations) // 3
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
