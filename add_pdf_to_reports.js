
const fs = require('fs');
const path = require('path');

const filesToUpdate = [
    'generate_report_jan_2026.js',
    'generate_report_feb_2026.js',
    'generate_report_dec_2025_fixed.js',
    'generate_golden_disc_report.js',
    'generate_sam_lee_report.js'
];

const pdfScript = '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>';

const pdfButtonCode = `
<!-- Fixed PDF Button -->
<button onclick="downloadPDF()" style="
    position: fixed;
    bottom: 90px;
    right: 30px;
    background: linear-gradient(135deg, #1e88e5, #1565c0);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 4px 15px rgba(30, 136, 229, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
    z-index: 1000;
" onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 20px rgba(30, 136, 229, 0.5)';" 
   onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(30, 136, 229, 0.4)';">
    <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
    下載 PDF
</button>

<script>
    function downloadPDF() {
        // Temporarily hide buttons
        const btn1 = document.querySelector('a[href*="report_index.html"]'); // Home button
        const btn2 = document.querySelector('button[onclick="downloadPDF()"]'); // This button
        const modal = document.getElementById('analysisModal'); // Modal if open
        
        if(btn1) btn1.style.display = 'none';
        if(btn2) btn2.style.display = 'none';
        
        const element = document.body;
        const opt = {
            margin: 0.2,
            filename: document.title.replace(/[^a-zA-Z0-9\\u4e00-\\u9fa5]/g, '_') + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
             if(btn1) btn1.style.display = 'flex';
             if(btn2) btn2.style.display = 'flex';
        });
    }
</script>
`;

filesToUpdate.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // 1. Add Script to Head
        if (!content.includes('html2pdf.bundle.min.js')) {
            // Find a good spot in head, e.g. after chartjs-plugin-annotation
            if (content.includes('chartjs-plugin-annotation.min.js"></script>')) {
                content = content.replace(
                    'chartjs-plugin-annotation.min.js"></script>',
                    'chartjs-plugin-annotation.min.js"></script>\n    ' + pdfScript
                );
            } else if (content.includes('</head>')) {
                content = content.replace('</head>', '    ' + pdfScript + '\n</head>');
            }
        }

        // 2. Add Button before Body End or before Home Button
        if (!content.includes('function downloadPDF()')) {
            if (content.includes('<!-- Fixed Home Button -->')) {
                content = content.replace('<!-- Fixed Home Button -->', pdfButtonCode + '\n\n<!-- Fixed Home Button -->');
            } else if (content.includes('</body>')) {
                content = content.replace('</body>', pdfButtonCode + '\n</body>');
            }
        }

        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    } else {
        console.log(`Skipped ${file} (not found)`);
    }
});
