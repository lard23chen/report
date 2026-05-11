
const fs = require('fs');
const path = require('path');
const os = require('os');

const chatDir = path.join(os.homedir(), '.gemini', 'tmp', 'mongodb', 'chats');
const outputFile = 'D:\\2025\\AI\\MongoDB\\my_prompts_history.txt';

try {
    const files = fs.readdirSync(chatDir).filter(f => f.includes('.json'));
    let entries = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(chatDir, file), 'utf8');
        const lines = content.split('\n');
        
        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const json = JSON.parse(line);
                if (json.type === 'user' && json.content) {
                    let text = '';
                    if (Array.isArray(json.content)) {
                        text = json.content.map(c => c.text).filter(t => t).join(' ');
                    } else if (json.content.text) {
                        text = json.content.text;
                    }
                    
                    if (text) {
                        entries.push({
                            timestamp: json.timestamp ? new Date(json.timestamp) : new Date(0),
                            text: text
                        });
                    }
                }
            } catch (e) {}
        });
    });

    // 依據真正的時間戳記排序
    entries.sort((a, b) => a.timestamp - b.timestamp);

    const output = entries.map(e => {
        const timeStr = e.timestamp.getTime() > 0 
            ? `[${e.timestamp.toLocaleString('zh-TW', { hour12: false })}] ` 
            : '[Unknown Time] ';
        return `${timeStr}${e.text}`;
    }).join('\n');

    fs.writeFileSync(outputFile, output, 'utf8');
    console.log(`Successfully exported ${entries.length} prompts to ${outputFile}`);
} catch (err) {
    console.error('Error:', err.message);
}
