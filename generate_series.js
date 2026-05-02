require('dotenv').config();
const { execSync } = require('child_process');

const prompts = [
  "A romantic realistic photo of two Asian men in Tokyo. Alex (front) has short dark hair and a warm smile, wearing a light casual jacket. Sean (behind) has a buzzed haircut, hugging Alex from behind. They stand under blooming cherry blossoms with the Tokyo Tower glowing in the background at twilight. Deep look of love and commitment, 'secretly committed for life' theme.",
  "Cinematic close-up of two Asian men, Alex and Sean, at a balcony overlooking the Tokyo Tower and cherry blossoms. Alex is in front, Sean is behind with his chin on Alex's shoulder. Sean has a buzzed head, Alex has neat dark hair. They are holding hands secretly. High-end photography, romantic atmosphere, sunset lighting.",
  "Full body shot of two Asian men walking through a park in Tokyo with cherry blossoms in full bloom and Tokyo Tower in the distance. Alex is slightly ahead, looking back at Sean who is right behind him. Sean has a buzzed haircut. They share a private, meaningful glance of lifelong devotion. Realistic, 8k, vibrant colors."
];

async function runSeries() {
  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n--- 正在生成系列照片 ${i + 1}/3 ---`);
    try {
      // 呼叫原本的 generate_image.js
      const cmd = `node generate_image.js "${prompts[i]}"`;
      console.log(`執行指令: ${cmd}`);
      const output = execSync(cmd, { encoding: 'utf-8' });
      console.log(output);
    } catch (err) {
      console.error(`第 ${i + 1} 張生成失敗:`, err.message);
    }
  }
}

runSeries();
