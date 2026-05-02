require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Image Generation 2.0
 * 支援 DALL-E 3 / DALL-E 2 串接
 */

// ================= 設定區 =================
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.IMAGE_MODEL || 'dall-e-3';
const DEFAULT_SIZE = process.env.IMAGE_SIZE || '1024x1024';
const OUTPUT_DIR = path.join(__dirname, 'generated_images');
// ==========================================

if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_api_key_here') {
  console.error('❌ 錯誤: 請先在 .env 檔案中設定正確的 OPENAI_API_KEY');
  process.exit(1);
}

// 確保輸出目錄存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

async function generateImage(options) {
  const { prompt, model, size, n } = options;
  
  console.log(`\n🚀 [Images 2.0] 開始生成圖片...`);
  console.log(`📝 提示詞: "${prompt}"`);
  console.log(`🤖 模型: ${model} | 尺寸: ${size}`);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        n: n || 1,
        size: size,
        response_format: 'url'
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`OpenAI API 錯誤: ${data.error.message}`);
    }

    const results = data.data;
    console.log(`✅ 成功生成 ${results.length} 張圖片！`);

    for (let i = 0; i < results.length; i++) {
      const imageUrl = results[i].url;
      const revisedPrompt = results[i].revised_prompt;
      
      if (revisedPrompt) {
        console.log(`\n✨ OpenAI 優化後的提示詞 (${i + 1}):`);
        console.log(`   ${revisedPrompt}`);
      }

      // 下載圖片
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`圖片下載失敗: ${imgRes.statusText}`);
      
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `gen_${timestamp}_${i + 1}.png`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      
      fs.writeFileSync(filePath, buffer);
      console.log(`💾 圖片 ${i + 1} 已儲存至: ${filePath}`);
    }

  } catch (error) {
    console.error(`\n❌ [Images 2.0] 發生錯誤:`, error.message);
  }
}

// 命令列參數解析
// 用法: node generate_image.js "Prompt" [model] [size]
const args = process.argv.slice(2);
const prompt = args[0] || 'A futuristic cyberpunk city in Taiwan, neon lights, highly detailed';
const model = args[1] || DEFAULT_MODEL;
const size = args[2] || DEFAULT_SIZE;

generateImage({ prompt, model, size, n: 1 });
