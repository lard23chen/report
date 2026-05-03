import os
import requests
from openai import OpenAI
from dotenv import load_dotenv

# 讀取 .env 檔案
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("找不到 OPENAI_API_KEY，請確認 .env 檔案的設定。")
    exit(1)

client = OpenAI(api_key=api_key)

# 撰寫生成影像的 Prompt (提示詞)
# 由於 DALL-E 不支援直接上傳照片換臉，我們用文字描述原圖中兩位男士的特徵，並加上東京鐵塔的背景
prompt = (
    "A sweet and romantic night scene photo of a gay couple standing closely together in front of the illuminated Tokyo Tower in Japan. "
    "One man has a slightly round face, a buzz cut with short hair, and is wearing a light gray t-shirt. "
    "The other man has very short, neat black hair, clean-shaven, and a sharp jawline. "
    "They are looking at the camera, smiling happily, taking a selfie. "
    "The atmosphere is warm, romantic, and cinematic, with soft lighting and beautiful bokeh from the city lights."
)

try:
    print("正在請求 DALL-E 3 生成影像，這可能需要幾十秒鐘...")
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    
    image_url = response.data[0].url
    print("\n✅ 影像生成成功！")
    print(f"影像網址: {image_url}")
    
    # 下載圖片
    print("正在下載圖片...")
    img_data = requests.get(image_url).content
    output_filename = "tokyo_tower_couple.png"
    with open(output_filename, 'wb') as handler:
        handler.write(img_data)
        
    print(f"圖片已成功儲存為: {output_filename}")

except Exception as e:
    print(f"❌ 影像生成失敗: {e}")
