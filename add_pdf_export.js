const fs = require('fs');
const path = require('path');

const reportDir = path.join(__dirname, 'report');

// Files to update (exclude report_index.html and SamLee which already has the button)
const filesToUpdate = fs.readdirSync(reportDir)
    .filter(f => f.endsWith('.html') && f !== 'report_index.html' && f !== 'SamLee_Report_2025_Taipei.html');

console.log('Files to update:', filesToUpdate);

// CSS to inject (before </style>)
const exportBtnCSS = `
        .export-btn {
            background: linear-gradient(135deg, #ffd700, #ffaa00);
            color: #1a1a1a;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.9rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            margin-left: 15px;
            position: fixed;
            top: 20px;
            right: 30px;
            z-index: 1000;
        }
        .export-btn:hover {
            background: linear-gradient(135deg, #ffaa00, #ff8800);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
        }
        .export-btn svg { width: 16px; height: 16px; }

        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { background-color: #121212 !important; }
            .export-btn { display: none !important; }
            .card, .chart-card { 
                background: #1e1e1e !important;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
            @page { size: A3 landscape; margin: 0.5in; }
        }
`;

// Button HTML to inject (after <body> tag or in header area)
const exportBtnHTML = `
    <button class="export-btn" onclick="exportPDF()">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        匯出 PDF
    </button>
`;

// JavaScript function to inject (before </script> or before </body>)
const exportPDFScript = `
    <script>
    function exportPDF() {
        const exportBtn = document.querySelector('.export-btn');
        if(exportBtn) exportBtn.style.display = 'none';
        
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                if(exportBtn) exportBtn.style.display = 'inline-flex';
            }, 500);
        }, 100);
    }
    </script>
`;

filesToUpdate.forEach(filename => {
    const filePath = path.join(reportDir, filename);
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already has export button
    if (content.includes('exportPDF') || content.includes('export-btn')) {
        console.log(`Skipping ${filename} - already has export functionality`);
        return;
    }

    // Inject CSS before </style>
    if (content.includes('</style>')) {
        content = content.replace('</style>', exportBtnCSS + '\n    </style>');
    }

    // Inject button HTML after <body> tag
    if (content.includes('<body>')) {
        content = content.replace('<body>', '<body>\n' + exportBtnHTML);
    } else if (content.includes('<body ')) {
        // Handle <body class="..."> case
        content = content.replace(/<body[^>]*>/, match => match + '\n' + exportBtnHTML);
    }

    // Inject script before </body>
    if (content.includes('</body>')) {
        content = content.replace('</body>', exportPDFScript + '\n</body>');
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filename}`);
});

console.log('Done! All reports now have PDF export functionality.');
