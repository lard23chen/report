
(function () {
    // Basic Password Protection for GitHub Pages
    // Note: This is client-side only and not truly secure. Anyone with dev tools can bypass it.

    // Check if running on GitHub Pages
    if (window.location.hostname.includes('github.io')) {
        const STORAGE_KEY = 'report_access_granted';
        const SESSION_DURATION = 3600000; // 1 hour in ms

        function checkAuth() {
            const authData = JSON.parse(localStorage.getItem(STORAGE_KEY));
            const now = new Date().getTime();

            if (authData && now < authData.expiry) {
                return true; // Valid session
            }
            return false;
        }

        function showLogin() {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'login-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: #0f172a; z-index: 99999; display: flex;
                justify-content: center; align-items: center; flex-direction: column;
                color: white; font-family: sans-serif;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                background: #1e293b; padding: 2rem; border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center;
                border: 1px solid rgba(255,255,255,0.1);
            `;

            content.innerHTML = `
                <h2 style="margin-bottom: 1rem; color: #fff;">🔒 存取受限 (Access Restricted)</h2>
                <p style="margin-bottom: 1.5rem; color: #94a3b8;">請輸入存取密碼以查看報表。</p>
                <input type="password" id="password-input" placeholder="Enter Password" 
                    style="padding: 10px; border-radius: 6px; border: 1px solid #475569; 
                    background: #334155; color: white; width: 100%; margin-bottom: 1rem; font-size: 1rem;">
                <button id="login-btn" style="
                    background: #3b82f6; color: white; border: none; padding: 10px 20px;
                    border-radius: 6px; cursor: pointer; font-size: 1rem; width: 100%;
                    font-weight: 600; transition: background 0.2s;">
                    驗證 (Verify)
                </button>
                <p id="error-msg" style="color: #ef4444; margin-top: 10px; display: none; font-size: 0.9rem;">密碼錯誤!</p>
            `;

            overlay.appendChild(content);
            document.body.appendChild(overlay);

            // Hide main content
            const mainContent = document.querySelector('.container') || document.body.children[0];
            if (mainContent) mainContent.style.filter = 'blur(10px)';

            const input = document.getElementById('password-input');
            const btn = document.getElementById('login-btn');
            const errorMsg = document.getElementById('error-msg');

            // Hardcoded valid password (simple hash check would be better but keeping it simple)
            // Default Password: 'qware'
            const VALID_PASS = ['07328402'];

            function attemptLogin() {
                const val = input.value.trim();
                if (VALID_PASS.includes(val)) {
                    // Success
                    const expiry = new Date().getTime() + SESSION_DURATION;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify({ expiry: expiry }));
                    overlay.remove();
                    if (mainContent) mainContent.style.filter = 'none';
                } else {
                    // Fail
                    errorMsg.style.display = 'block';
                    input.value = '';
                    input.focus();
                }
            }

            btn.addEventListener('click', attemptLogin);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') attemptLogin();
            });
        }

        // Run on load
        if (!checkAuth()) {
            // Prevent seeing content before overlay loads
            const style = document.createElement('style');
            style.innerHTML = 'body { display: none; }';
            document.head.appendChild(style);

            window.addEventListener('DOMContentLoaded', () => {
                style.remove();
                showLogin();
            });
        }
    }
})();
