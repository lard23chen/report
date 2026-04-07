(function() {
    var hud = document.createElement('div');
    hud.id = 'claude-hud-panel';
    hud.style.cssText = 'position:fixed; top:20px; right:20px; width:220px; background:rgba(15,23,42,0.85); color:#fff; border-radius:12px; font-family:monospace; font-size:11px; z-index:9999; backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.1); box-shadow:0 10px 30px rgba(0,0,0,0.3); overflow:hidden; transition:all 0.3s;';
    
    var header = document.createElement('div');
    header.style.cssText = 'padding:10px; background:rgba(255,255,255,0.05); cursor:move; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1);';
    header.innerHTML = '<span>CLAUDE HUD v1.0</span><button id="hud-toggle" style="background:none; border:none; color:#fff; cursor:pointer;">[-]</button>';
    
    var body = document.createElement('div');
    body.id = 'hud-body';
    body.style.cssText = 'padding:12px; line-height:1.6;';
    body.innerHTML = 
        '<div>STATUS: <span id="hud-status" style="color:#fbbf24;">INITIALIZING</span></div>' +
        '<div>SYNC: <span id="hud-sync">NEVER</span></div>' +
        '<div>DB: <span id="hud-db">DISCONNECTED</span></div>' +
        '<hr style="margin:8px 0; border:none; border-top:1px solid rgba(255,255,255,0.1);">' +
        '<div id="hud-logs" style="max-height:100px; overflow-y:auto; color:#94a3b8; font-size:10px;"></div>';
    
    hud.appendChild(header);
    hud.appendChild(body);
    document.body.appendChild(hud);

    // Toggle minimize
    var isMin = false;
    document.getElementById('hud-toggle').addEventListener('click', function() {
        isMin = !isMin;
        body.style.display = isMin ? 'none' : 'block';
        hud.style.width = isMin ? '140px' : '220px';
        this.textContent = isMin ? '[+]' : '[-]';
    });

    // Global HUD Controller
    window.ClaudeHUD = {
        updateStatus: function(s, color) {
            var el = document.getElementById('hud-status');
            el.textContent = s.toUpperCase();
            if(color) el.style.color = color;
        },
        updateSync: function(t) {
            document.getElementById('hud-sync').textContent = t;
        },
        updateDB: function(connected) {
            var el = document.getElementById('hud-db');
            el.textContent = connected ? 'CONNECTED' : 'OFFLINE';
            el.style.color = connected ? '#4ade80' : '#f87171';
        },
        log: function(msg) {
            var logs = document.getElementById('hud-logs');
            var div = document.createElement('div');
            div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
            logs.insertBefore(div, logs.firstChild);
        }
    };
})();