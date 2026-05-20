import os
import json
import logging
import time
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from functools import lru_cache

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 使用全局 Session 提高网络请求性能
http_session = requests.Session()
adapter = requests.adapters.HTTPAdapter(pool_connections=100, pool_maxsize=100)
http_session.mount('http://', adapter)
http_session.mount('https://', adapter)

# 预编译正则表达式，避免每次请求重复编译
GGB_KEYS = [
    'showToolBar', 'showMenuBar', 'allowStyleBar',
    'showFullscreenButton', 'enableLabelDrags', 'enableRightClick',
    'errorDialogsActive', 'enableUndoRedo', 'enableSnapshots'
]
GGB_KEY_REGS = [
    (re.compile(f'(["\']?{key}["\']?\\s*:\\s*)true', re.IGNORECASE), r'\1false')
    for key in GGB_KEYS
]
WIDTH_REG = re.compile(r'"width": window\.innerWidth')
HEIGHT_REG = re.compile(r'"height": window\.innerHeight')

@lru_cache(maxsize=500)
def enhance_html_logic(html_content):
    """
    HTML 增强逻辑：自适应宽高、UI 隐藏、视角锁定、事件桥接
    使用缓存和预编译正则提高性能
    """
    if not html_content:
        return html_content
    
    # 修复编码问题
    if isinstance(html_content, bytes):
        try:
            html_content = html_content.decode('utf-8')
        except UnicodeDecodeError:
            html_content = html_content.decode('iso-8859-1')

    enhanced_html = html_content

    # 1. GeoGebra Classic UI 隐藏配置
    for reg, repl in GGB_KEY_REGS:
        enhanced_html = reg.sub(repl, enhanced_html)

    # 3. 自适应适配逻辑
    enhanced_html = WIDTH_REG.sub(r'"width": document.getElementById("ggb-container").parentElement.clientWidth', enhanced_html)
    enhanced_html = HEIGHT_REG.sub(r'"height": document.getElementById("ggb-container").parentElement.clientHeight', enhanced_html)

    # 注入 GGB 增强脚本 (Adaptive + Bridge)
    enhancement_script = """
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: white !important; }
        #ggb-container { width: 100vw; height: 100vh; min-height: 400px; background-color: white; }
    </style>
    <script>
    (function() {
        window.GGB_INJECTED = true;

        // 1. 自适应适配逻辑 (ResizeObserver)
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const { width, height } = entry.contentRect;
                    const ggbApplet = window.ggbApplet || document.querySelector('#ggb-container')?.ggbApplet;
                    if (ggbApplet && ggbApplet.setSize) {
                        ggbApplet.setSize(width, height);
                    }
                }
            });
            const ggbContainer = document.getElementById('ggb-container');
            if (ggbContainer) {
                resizeObserver.observe(ggbContainer.parentElement);
            }
        }

        // 2. GGB 事件监听器桥接脚本 (GGB_LISTENER_BRIDGE)
        (function() {
            var BRIDGE_SOURCE = 'GGB_LISTENER_BRIDGE';
            var MAX_EVENTS = 200;
            var buffer = [];
            var pendingTimer = null;

            function safeGetApi() {
                try {
                    var api = window.ggbApplet || (window.parent && window.parent.ggbApplet);
                    if (api) return api;
                    var container = document.getElementById('ggb-container');
                    return (container && container.ggbApplet) || null;
                } catch (e) { return null; }
            }

            function safeGetObjectType(api, name) {
                try { return api && typeof api.getObjectType === 'function' ? api.getObjectType(name) : null; } catch (e) { return null; }
            }

            function safeGetValueString(api, name) {
                try { return api && typeof api.getValueString === 'function' ? api.getValueString(name) : null; } catch (e) { return null; }
            }

            function safeGetState() {
                try {
                    var api = safeGetApi();
                    if (!api) return { error: 'No API available' };
                    var xml = (typeof api.getXML === 'function') ? api.getXML() : null;
                    return { xml: xml };
                } catch (e) { return { error: (e && e.message) ? e.message : String(e) }; }
            }

            function buildDiff(list) {
                var diff = { add: [], remove: [], update: [] };
                var updateMap = Object.create(null);
                for (var i = 0; i < list.length; i++) {
                    var ev = list[i];
                    if (!ev || !diff[ev.type]) continue;
                    if (ev.type === 'update' && ev.data && ev.data.name) {
                        updateMap[ev.data.name] = ev;
                        continue;
                    }
                    diff[ev.type].push(ev);
                }
                for (var k in updateMap) { diff.update.push(updateMap[k]); }
                return diff;
            }

            function flush() {
                pendingTimer = null;
                var last = buffer.length ? buffer[buffer.length - 1] : null;
                var list = buffer.slice(0);
                buffer.length = 0;
                var payload = {
                    source: BRIDGE_SOURCE,
                    update: last,
                    currentState: safeGetState(),
                    diff: buildDiff(list),
                    ts: Date.now()
                };
                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage(payload, '*');
                    }
                } catch (e) {}
            }

            function pushEvent(type, data) {
                var ev = { type: type, ts: Date.now(), data: data || null };
                buffer.push(ev);
                if (buffer.length > MAX_EVENTS) buffer.shift();
                if (pendingTimer) return;
                pendingTimer = setTimeout(flush, 150);
            }

            window.__ggb_on_add = function(objName) {
                var api = safeGetApi();
                pushEvent('add', { name: objName, objectType: safeGetObjectType(api, objName), valueString: safeGetValueString(api, objName) });
            };
            window.__ggb_on_remove = function(objName) {
                var api = safeGetApi();
                pushEvent('remove', { name: objName, objectType: safeGetObjectType(api, objName), valueString: safeGetValueString(api, objName) });
            };
            window.__ggb_on_update = function(objName) {
                var api = safeGetApi();
                pushEvent('update', { name: objName, objectType: safeGetObjectType(api, objName), valueString: safeGetValueString(api, objName) });
            };

            function tryRegister() {
                var api = safeGetApi();
                if (!api) return false;
                try {
                    var registeredCount = 0;
                    if (typeof api.registerAddListener === 'function') { api.registerAddListener('__ggb_on_add'); registeredCount++; }
                    if (typeof api.registerRemoveListener === 'function') { api.registerRemoveListener('__ggb_on_remove'); registeredCount++; }
                    if (typeof api.registerUpdateListener === 'function') { api.registerUpdateListener('__ggb_on_update'); registeredCount++; }
                    if (registeredCount > 0) { pushEvent('update', { name: '__init__' }); return true; }
                    return false;
                } catch (e) { return false; }
            }

            var tries = 0;
            var timer = setInterval(function() {
                tries++;
                if (tryRegister() || tries > 80) { clearInterval(timer); }
            }, 250);
        })();
    })();
    </script>
    """
    
    if '</body>' in enhanced_html:
        enhanced_html = enhanced_html.replace('</body>', f'{enhancement_script}</body>')
    else:
        enhanced_html += enhancement_script
        
    return enhanced_html

@app.route('/requests/fetch', methods=['GET'])
def fetch_proxy():
    url = request.args.get('url')
    if not url:
        return jsonify({"error": "Missing url"}), 400

    logger.info(f"Received proxy request for URL: {url}")

    try:
        # 获取原始 HTML
        response = http_session.get(url, timeout=10)
        response.raise_for_status()
        raw_html = response.text
        
        # 增强 HTML
        enhanced_html = enhance_html_logic(raw_html)
        
        return jsonify({
            "success": True,
            "data": {
                "url": url,
                "html": enhanced_html,
                "raw_html": raw_html,
                "screenshot": None # 不再提供后端截图
            }
        })

    except Exception as e:
        logger.exception(f"Proxy fetch failed for {url}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(port=5000, debug=False, threaded=True)
