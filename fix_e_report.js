const fs = require('fs');
let content = fs.readFileSync('E_report_index.html', 'utf8');

const replacement = `        <!-- Tabs Navigation -->
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('tab1')">本月/上月報表</button>
            <button class="tab-btn" onclick="switchTab('tab2')">報表比較分析</button>
            <button class="tab-btn" onclick="switchTab('tab3')">歷史報表分析</button>
            <button class="tab-btn" onclick="switchTab('tab4')">各節目報表分析</button>
        </div>

        <!-- Tab 1: Last Month -->
        <div id="tab1" class="tab-content active">
            <div class="grid" id="tab1-grid">
                <div class="card">
                    <div class="card-icon icon-revenue">
                        📊
                    </div>
                    <div class="card-content">
                        <h3>2026年01月 分析報表 (E系統)</h3>
                        <p>完整的一月份營收數據分析，包含支付方式佔比與重要銷售指標。</p>
                    </div>
                    <div class="card-meta">
                        <span class="badge">Monthly</span>
                        <a href="E_Qware_Revenue_Report_2026年01月_分析報表.html" class="btn-link">
                            查看報表
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tab 2: Comparison -->
        <div id="tab2" class="tab-content">
            <div class="grid" id="tab2-grid">
                <!-- Content will be injected by script -->
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">
                    暫無比較報表 (Updating...)
                </div>
            </div>
        </div>

        <!-- Tab 3: Historical -->
        <div id="tab3" class="tab-content">
            <div class="grid" id="tab3-grid">
                <!-- Content will be injected by script -->
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">
                    暫無歷史報表 (Updating...)
                </div>
            </div>
        </div>

        <!-- Tab 4: Individual Events -->
        <div id="tab4" class="tab-content">
            <div class="grid" id="tab4-grid">
                <!-- Content will be injected by script -->
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem;">
                    暫無專案報表 (Updating...)
                </div>
            </div>
        </div>

    </div>

    <footer>
        &copy; 2026 Qware Analytics (E-System). All rights reserved. Built with ❤️ for Data Insights.
    </footer>

    <script>
        function switchTab(tabId) {
            // Remove active class from all buttons and contents
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active class to clicked button
            const clickedBtn = Array.from(document.querySelectorAll('.tab-btn')).find(btn => btn.getAttribute('onclick').includes(tabId));
            if (clickedBtn) {
                clickedBtn.classList.add('active');
            }

            // Add active class to target content
            document.getElementById(tabId).classList.add('active');
        }
    </script>
    <script src="auth.js"></script>
</body>
</html>`;

content = content.replace(/<!-- Tabs Navigation -->[\s\S]*<\/html>/, replacement);
fs.writeFileSync('E_report_index.html', content, 'utf8');
console.log('Fixed E_report_index.html');
