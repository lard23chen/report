
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ================= CONFIGURATION =================
// 請填入您的寄件者資訊 (Sender Information)
const SENDER_EMAIL = 'lard23@gmail.com'; // 例如: example@gmail.com
const SENDER_PASSWORD = 'tgdp bonz gptq cppp'; // Google App Password (非登入密碼)
const RECIPIENT_EMAIL = 'lard23@gmail.com';
// =================================================

async function sendReport() {
    // 1. Find the latest report file
    const files = fs.readdirSync(__dirname);
    const reportFiles = files.filter(f => f.startsWith('Qware_Revenue_Report_') && f.endsWith('.html'));

    if (reportFiles.length === 0) {
        console.error("No report file found to send.");
        return;
    }

    // Sort by modification time, newest first
    reportFiles.sort((a, b) => {
        return fs.statSync(path.join(__dirname, b)).mtime.getTime() -
            fs.statSync(path.join(__dirname, a)).mtime.getTime();
    });

    const latestReport = reportFiles[0];
    const reportPath = path.join(__dirname, latestReport);
    console.log(`Preparing to send report: ${latestReport}`);

    // 2. Create Transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: SENDER_EMAIL,
            pass: SENDER_PASSWORD
        }
    });

    // 3. Email Options
    const mailOptions = {
        from: SENDER_EMAIL,
        to: RECIPIENT_EMAIL,
        subject: `[自動發送] ibon售票系統分析報表 - ${latestReport}`,
        text: `您好,\n\n附件是最新產出的分析報表 (${latestReport})。\n\nData Source: QwareAi / Qware_Ticket_Data\n\nBest regards,\nAutomated System`,
        attachments: [
            {
                filename: latestReport,
                path: reportPath
            }
        ]
    };

    // 4. Send Email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully: ' + info.response);
    } catch (error) {
        console.error('Error sending email:', error);
        console.log('\n[提示] 請確認已在 send_email.js 設定正確的 SENDER_EMAIL 與 SENDER_PASSWORD (Google App Password)。');
    }
}

sendReport();
