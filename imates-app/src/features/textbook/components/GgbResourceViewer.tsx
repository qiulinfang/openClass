import * as FileSystem from 'expo-file-system/legacy';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  TextbookService,
  type ResourceFile,
} from '../services/textbook-service';

interface GgbResourceViewerProps {
  resource: ResourceFile;
  reloadKey: number;
  onReady: () => void;
  onError: (message: string) => void;
}

type GgbMessage = {
  source?: string;
  channel?: string;
  type?: 'ready' | 'error';
  message?: string;
};

const GGB_DEPLOY_URL = 'https://www.geogebra.org/apps/deployggb.js';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
};

const readNativeResourceAsBase64 = async (
  resource: ResourceFile
): Promise<string> => {
  const candidates = Array.from(
    new Set([resource.fileUrl, resource.remoteUrl].filter(Boolean) as string[])
  );
  let lastError: unknown;
  for (const localUri of candidates.filter((uri) => uri.startsWith('file://'))) {
    try {
      return await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      lastError = error;
    }
  }

  const cacheRoot = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheRoot) throw new Error('设备缓存目录不可用');
  const headers = await TextbookService.getYanbanAuthHeaders();

  for (const uri of candidates) {
    if (!/^https?:\/\//i.test(uri)) continue;
    const temporaryUri = `${cacheRoot}ggb-${resource.id.replace(/[^\w-]/g, '_')}-${Date.now()}.ggb`;
    try {
      const result = await FileSystem.downloadAsync(uri, temporaryUri, {
        headers,
      });
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`课件请求失败（HTTP ${result.status}）`);
      }
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      return base64;
    } catch (error) {
      lastError = error;
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(
        () => undefined
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('GeoGebra 课件地址不可访问');
};

const readWebResourceAsBase64 = async (
  resource: ResourceFile
): Promise<string> => {
  const candidates = Array.from(
    new Set([resource.fileUrl, resource.remoteUrl].filter(Boolean) as string[])
  );
  let authHeaders: Record<string, string> | null = null;
  let lastError: unknown;

  for (const uri of candidates) {
    try {
      let requestUri = uri;
      try {
        const parsed = new URL(uri, globalThis.location?.origin);
        if (
          parsed.hostname === 'www.imates.com.cn' &&
          (parsed.pathname.startsWith('/yb-release/') ||
            parsed.pathname.startsWith('/yb-test/'))
        ) {
          requestUri = `${parsed.pathname}${parsed.search}`;
        }
      } catch {
        // 保留原始地址，由 fetch 返回具体错误。
      }
      const usesLocalPayload =
        uri.startsWith('blob:') || uri.startsWith('data:');
      if (!usesLocalPayload && !authHeaders) {
        authHeaders = await TextbookService.getYanbanAuthHeaders();
      }
      const response = await fetch(requestUri, {
        headers: usesLocalPayload ? undefined : authHeaders || undefined,
      });
      if (!response.ok) {
        throw new Error(`课件请求失败（HTTP ${response.status}）`);
      }
      return arrayBufferToBase64(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('GeoGebra 课件地址不可访问');
};

const loadResourceAsBase64 = (resource: ResourceFile) =>
  Platform.OS === 'web'
    ? readWebResourceAsBase64(resource)
    : readNativeResourceAsBase64(resource);

const buildGgbHtml = (base64: string, channel: string): string => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
    <base href="https://www.geogebra.org/" />
    <style>
      * { box-sizing: border-box; }
      html, body, #ggb-stage { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #fff; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overscroll-behavior: none; }
      #ggb-stage { position: relative; touch-action: none; }
      #ggb-stage .GeoGebraFrame { border: 0 !important; box-shadow: none !important; }
      #mobile-toolbar, #tool-sheet, #sheet-backdrop, #reset-confirm, #screen-switch { display: none; }
      #gesture-tip {
        position: fixed; left: 50%; bottom: max(82px, calc(70px + env(safe-area-inset-bottom))); z-index: 2147483647;
        transform: translateX(-50%); padding: 8px 13px; border-radius: 18px;
        color: #fff; background: rgba(32, 36, 61, .84); font-size: 12px; font-weight: 700;
        letter-spacing: .1px; white-space: nowrap; pointer-events: none;
        animation: tip-out .35s ease 4s forwards;
      }
      @keyframes tip-out { to { opacity: 0; transform: translate(-50%, 8px); } }
      @media (prefers-reduced-motion: reduce) { #gesture-tip { display: none; } }
      body.compact.dual-view-resource #screen-switch {
        position: fixed; top: 10px; left: 50%; z-index: 100005;
        transform: translateX(-50%); display: grid; grid-template-columns: repeat(2, 1fr);
        width: min(252px, calc(100% - 80px)); min-height: 46px; padding: 3px;
        border: 1px solid rgba(218, 216, 232, .96); border-radius: 24px;
        background: rgba(255, 255, 255, .94); box-shadow: 0 7px 22px rgba(32, 36, 61, .14);
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      }
      .screen-button {
        min-width: 0; min-height: 38px; padding: 0 8px; border: 0; border-radius: 19px;
        color: #6b7086; background: transparent;
        font: 750 11px/16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      }
      .screen-button:active { background: #f0eeff; }
      .screen-button.active { color: #fff; background: #6256d9; }
      .screen-button:focus-visible { outline: 2px solid #6256d9; outline-offset: 1px; }
      body.compact #ggb-stage { height: calc(100% - 70px - env(safe-area-inset-bottom)); }
      body.compact.dual-view-resource #ggb-stage {
        height: calc(100% - 132px - env(safe-area-inset-bottom)) !important;
        margin-top: 62px;
      }
      body.compact #mobile-toolbar {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 100000;
        min-height: calc(70px + env(safe-area-inset-bottom));
        display: flex; align-items: flex-start; gap: 3px;
        padding: 7px 7px calc(7px + env(safe-area-inset-bottom));
        border-top: 1px solid #e4e5f0; background: rgba(255, 255, 255, .98);
        box-shadow: 0 -8px 24px rgba(32, 36, 61, .08);
      }
      body.compact.ggb-keyboard-open #mobile-toolbar,
      body.compact.ggb-keyboard-open #tool-sheet,
      body.compact.ggb-keyboard-open #sheet-backdrop,
      body.compact.ggb-keyboard-open #reset-confirm,
      body.compact.ggb-keyboard-open #gesture-tip { display: none !important; }
      .tool-button {
        min-width: 0; min-height: 56px; flex: 1; padding: 5px 2px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        border: 0; border-radius: 14px; color: #626881; background: transparent;
        font: inherit; -webkit-tap-highlight-color: transparent; touch-action: manipulation;
      }
      .tool-button:active { background: #f0eeff; transform: scale(.96); }
      .tool-button.active { color: #5548cf; background: #f0eeff; }
      .tool-icon { height: 25px; font-size: 22px; line-height: 25px; font-weight: 800; }
      .tool-label { font-size: 10px; line-height: 13px; font-weight: 750; white-space: nowrap; }
      .tool-button:focus-visible, .sheet-close:focus-visible, .sheet-action:focus-visible {
        outline: 2px solid #6256d9; outline-offset: -2px;
      }
      body.compact #sheet-backdrop.open {
        position: fixed; inset: 0 0 calc(70px + env(safe-area-inset-bottom)); z-index: 100010;
        display: block; border: 0; background: rgba(22, 24, 40, .24);
      }
      body.compact #tool-sheet.open {
        position: fixed; left: 10px; right: 10px; bottom: calc(76px + env(safe-area-inset-bottom)); z-index: 100020;
        display: block; max-height: calc(100% - 92px - env(safe-area-inset-bottom)); overflow-y: auto;
        padding: 14px; border: 1px solid #e4e5f0; border-radius: 22px;
        background: #fff; box-shadow: 0 18px 48px rgba(32, 36, 61, .22);
      }
      .sheet-heading { min-height: 42px; display: flex; align-items: center; justify-content: space-between; }
      .sheet-title { color: #20243d; font-size: 15px; font-weight: 850; }
      .sheet-close {
        width: 42px; height: 42px; border: 0; border-radius: 21px;
        padding: 0; color: #626881; background: #f2f3f8; font-size: 24px; line-height: 42px;
      }
      .sheet-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 8px; }
      .sheet-grid .tool-button { min-height: 62px; border: 1px solid #e8e9f2; background: #fafafe; }
      .sheet-grid .tool-button.active { border-color: #bbb4ff; color: #5548cf; background: #f0eeff; }
      .sheet-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
      .sheet-action {
        min-height: 46px; border: 0; border-radius: 14px; color: #4f556d; background: #f2f3f8;
        font: 750 12px/16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        touch-action: manipulation;
      }
      .sheet-action.danger { color: #b53e49; background: #fff0f1; }
      body.compact #reset-confirm.open {
        position: fixed; left: 12px; right: 12px; bottom: calc(78px + env(safe-area-inset-bottom)); z-index: 100030;
        display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px;
        min-height: 64px; padding: 9px 10px 9px 14px; border: 1px solid #f1c7cb; border-radius: 18px;
        color: #20243d; background: #fff; box-shadow: 0 14px 40px rgba(32, 36, 61, .22);
        font-size: 12px; font-weight: 750;
      }
      .confirm-button {
        min-width: 54px; min-height: 44px; padding: 0 12px; border: 0; border-radius: 13px;
        color: #626881; background: #f2f3f8; font: inherit; touch-action: manipulation;
      }
      .confirm-button.danger { color: #fff; background: #c84651; }
    </style>
    <script>
      var CHANNEL = ${JSON.stringify(channel)};
      var APPLET_READY = false;
      var GGB_API = null;
      var GGB_WRAPPER = null;
      function notify(type, message) {
        if (type === 'ready') APPLET_READY = true;
        var payload = JSON.stringify({ source: 'imates-ggb', channel: CHANNEL, type: type, message: message || '' });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
        else if (window.parent !== window) window.parent.postMessage(JSON.parse(payload), '*');
      }
      window.addEventListener('error', function (event) {
        if (!APPLET_READY) notify('error', event.message || 'GeoGebra 引擎加载失败');
      });
    </script>
    <script src="${GGB_DEPLOY_URL}" onerror="notify('error', 'GeoGebra 引擎下载失败，请检查网络')"></script>
  </head>
  <body>
    <main id="ggb-stage" class="ggb-stage" aria-label="GeoGebra 互动课件"></main>
    <div id="gesture-tip">单指操作 · 双指缩放画布</div>
    <nav id="screen-switch" aria-label="课件内容切换">
      <button class="screen-button active" type="button" data-layout="D" onclick="setMobileLayout('D')">课件内容</button>
      <button class="screen-button" type="button" data-layout="G" onclick="setMobileLayout('G')">函数图像</button>
    </nav>
    <button id="sheet-backdrop" type="button" aria-label="关闭更多工具" onclick="toggleToolSheet(false)"></button>
    <section id="tool-sheet" aria-label="更多作图工具">
      <div class="sheet-heading">
        <span class="sheet-title">更多工具</span>
        <button class="sheet-close" type="button" aria-label="关闭更多工具" onclick="toggleToolSheet(false)">×</button>
      </div>
      <div class="sheet-grid">
        <button class="tool-button" type="button" data-mode="2" onclick="setToolMode(2)"><span class="tool-icon">╱</span><span class="tool-label">直线</span></button>
        <button class="tool-button" type="button" data-mode="16" onclick="setToolMode(16)"><span class="tool-icon">△</span><span class="tool-label">多边形</span></button>
        <button class="tool-button" type="button" data-mode="5" onclick="setToolMode(5)"><span class="tool-icon">×</span><span class="tool-label">交点</span></button>
        <button class="tool-button" type="button" data-mode="19" onclick="setToolMode(19)"><span class="tool-icon">◇</span><span class="tool-label">中点</span></button>
        <button class="tool-button" type="button" data-mode="3" onclick="setToolMode(3)"><span class="tool-icon">∥</span><span class="tool-label">平行线</span></button>
        <button class="tool-button" type="button" data-mode="4" onclick="setToolMode(4)"><span class="tool-icon">⊥</span><span class="tool-label">垂线</span></button>
        <button class="tool-button" type="button" data-mode="36" onclick="setToolMode(36)"><span class="tool-icon">∠</span><span class="tool-label">角度</span></button>
        <button class="tool-button" type="button" data-mode="6" onclick="setToolMode(6)"><span class="tool-icon">⌫</span><span class="tool-label">删除</span></button>
      </div>
      <div class="sheet-actions">
        <button class="sheet-action" type="button" onclick="redoConstruction()">重做一步</button>
        <button class="sheet-action danger" type="button" onclick="askForReset()">恢复初始状态</button>
      </div>
    </section>
    <div id="reset-confirm" role="dialog" aria-label="确认恢复课件">
      <span>恢复课件初始状态？</span>
      <button class="confirm-button" type="button" onclick="closeResetConfirm()">取消</button>
      <button class="confirm-button danger" type="button" onclick="resetConstruction()">恢复</button>
    </div>
    <nav id="mobile-toolbar" aria-label="常用作图工具">
      <button class="tool-button active" type="button" data-mode="0" onclick="setToolMode(0)"><span class="tool-icon">✥</span><span class="tool-label">移动</span></button>
      <button class="tool-button" type="button" data-mode="1" onclick="setToolMode(1)"><span class="tool-icon">●</span><span class="tool-label">点</span></button>
      <button class="tool-button" type="button" data-mode="15" onclick="setToolMode(15)"><span class="tool-icon">／</span><span class="tool-label">线段</span></button>
      <button class="tool-button" type="button" data-mode="10" onclick="setToolMode(10)"><span class="tool-icon">○</span><span class="tool-label">圆</span></button>
      <button class="tool-button" type="button" onclick="undoConstruction()"><span class="tool-icon">↶</span><span class="tool-label">撤销</span></button>
      <button id="more-tools-button" class="tool-button" type="button" aria-expanded="false" onclick="toggleToolSheet()"><span class="tool-icon">•••</span><span class="tool-label">更多</span></button>
    </nav>
    <script>
      (function () {
        var compact = Math.min(window.innerWidth, window.innerHeight) < 700;
        document.body.classList.toggle('compact', compact);
        var stage = document.getElementById('ggb-stage');
        var params = {
          id: 'ggbApplet',
          width: Math.max(320, Math.floor(stage.clientWidth)),
          height: Math.max(280, Math.floor(stage.clientHeight)),
          enableResize: true,
          allowUpscale: true,
          showToolBar: !compact,
          showMenuBar: !compact,
          showAlgebraInput: !compact,
          showToolBarHelp: false,
          showResetIcon: !compact,
          showZoomButtons: !compact,
          enableUndoRedo: !compact,
          enableLabelDrags: false,
          enableShiftDragZoom: true,
          enableRightClick: false,
          appName: 'classic',
          language: 'zh',
          capturingThreshold: compact ? 5 : 3,
          useBrowserForJS: false,
          ggbBase64: ${JSON.stringify(base64)},
          appletOnLoad: function (api) {
            GGB_API = api;
            watchKeyboardVisibility();
            initializeMobileViews(api, compact);
            if (compact && typeof api.registerClientListener === 'function') {
              api.registerClientListener(function (event) {
                try {
                  var payload = typeof event === 'string' ? JSON.parse(event) : event;
                  if (payload && payload.type === 'setMode') updateActiveMode(Number(payload.argument));
                } catch (_) {}
              });
            }
            notify('ready');
          }
        };
        try {
          if (typeof window.GGBApplet !== 'function') {
            throw new Error('GeoGebra 引擎未正确加载');
          }
          // Compact mode otherwise selects GeoGebra's webSimple engine, which only
          // creates one graphics view even when the resource contains two.
          var applet = new window.GGBApplet(params, '5.0', 'ggb-stage', compact);
          GGB_WRAPPER = applet;
          applet.inject('ggb-stage');
        } catch (error) {
          notify('error', error && error.message ? error.message : 'GeoGebra 课件打开失败');
        }
      })();

      function perspectiveHasVisibleView(xml, viewId) {
        var viewTags = String(xml || '').match(/<view\\b[^>]*>/g) || [];
        return viewTags.some(function (tag) {
          var hasId = tag.indexOf('id="' + viewId + '"') >= 0 || tag.indexOf("id='" + viewId + "'") >= 0;
          var isVisible = tag.indexOf('visible="true"') >= 0 || tag.indexOf("visible='true'") >= 0;
          return hasId && isVisible;
        });
      }
      function initializeMobileViews(api, compact) {
        if (!compact || typeof api.getPerspectiveXML !== 'function') return;
        try {
          var perspectiveXml = api.getPerspectiveXML();
          var hasLeftView = perspectiveHasVisibleView(perspectiveXml, 16);
          var hasRightView = perspectiveHasVisibleView(perspectiveXml, 1);
          if (!hasLeftView || !hasRightView) return;
          document.body.classList.add('dual-view-resource');
          resizeAppletToStage(api);
          // 等 GeoGebra 完成原始透视图恢复后再应用移动端布局，避免初始化流程覆盖。
          window.setTimeout(function () {
            applyMobileLayout(api, 'D');
            window.setTimeout(function () { fitAbsoluteControls(api); }, 80);
          }, 120);
        } catch (_) {}
      }
      function resizeAppletToStage(api) {
        var stage = document.getElementById('ggb-stage');
        if (!stage || !api || typeof api.setSize !== 'function') return;
        api.setSize(Math.max(320, Math.floor(stage.clientWidth)), Math.max(280, Math.floor(stage.clientHeight)));
      }
      function watchKeyboardVisibility() {
        if (window.GGB_KEYBOARD_OBSERVER || !document.body) return;
        var pendingFrame = 0;
        var updateKeyboardState = function () {
          pendingFrame = 0;
          var keyboard = document.querySelector('.KeyBoard');
          var isOpen = false;
          if (keyboard) {
            var rect = keyboard.getBoundingClientRect();
            var style = window.getComputedStyle(keyboard);
            isOpen = style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 40 && rect.top < window.innerHeight;
          }
          document.body.classList.toggle('ggb-keyboard-open', isOpen);
          if (isOpen) toggleToolSheet(false);
        };
        var scheduleUpdate = function () {
          if (pendingFrame) return;
          pendingFrame = window.requestAnimationFrame(updateKeyboardState);
        };
        window.GGB_KEYBOARD_OBSERVER = new MutationObserver(scheduleUpdate);
        window.GGB_KEYBOARD_OBSERVER.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style']
        });
        scheduleUpdate();
      }
      function getGgbApi() {
        if (GGB_API) return GGB_API;
        if (GGB_WRAPPER && typeof GGB_WRAPPER.getAppletObject === 'function') {
          GGB_API = GGB_WRAPPER.getAppletObject();
        }
        return GGB_API;
      }
      function applyMobileLayout(api, layout) {
        if (!api || typeof api.setPerspective !== 'function') return;
        // 手机用内容标签切换完整视图，避免把桌面双栏压缩后裁掉公式和控件。
        api.setPerspective(layout);
        if (typeof api.showToolBar === 'function') api.showToolBar(false);
        if (typeof api.showMenuBar === 'function') api.showMenuBar(false);
        if (typeof api.showAlgebraInput === 'function') api.showAlgebraInput(false);
        document.querySelectorAll('[data-layout]').forEach(function (button) {
          button.classList.toggle('active', button.getAttribute('data-layout') === layout);
        });
      }
      function fitAbsoluteControls(api) {
        if (!api || typeof api.getAllObjectNames !== 'function' || typeof api.getXML !== 'function' || typeof api.setCoords !== 'function') return;
        try {
          var stage = document.getElementById('ggb-stage');
          var stageWidth = stage ? stage.clientWidth : window.innerWidth;
          var stageHeight = stage ? stage.clientHeight : window.innerHeight;
          var controls = [];
          Array.prototype.forEach.call(api.getAllObjectNames() || [], function (name) {
            var xml = String(api.getXML(name) || '');
            var isScreenControl = /<checkbox\\b/.test(xml);
            var position = xml.match(/<labelOffset\\b[^>]*x=["'](-?\\d+(?:\\.\\d+)?)["'][^>]*y=["'](-?\\d+(?:\\.\\d+)?)["']/);
            if (isScreenControl && position) {
              controls.push({ name: name, x: Number(position[1]), y: Number(position[2]) });
            }
          });
          if (!controls.length) return;
          var maxX = Math.max.apply(null, controls.map(function (item) { return item.x; }));
          var maxY = Math.max.apply(null, controls.map(function (item) { return item.y; }));
          // 为复选框文字保留右侧、底部空间，坐标只缩小不放大。
          var scaleX = maxX > 0 ? Math.min(1, Math.max(180, stageWidth - 145) / maxX) : 1;
          var scaleY = maxY > 0 ? Math.min(1, Math.max(320, stageHeight - 45) / maxY) : 1;
          controls.forEach(function (item) {
            api.setCoords(item.name, Math.round(item.x * scaleX), Math.round(item.y * scaleY));
          });
        } catch (_) {}
      }
      function setMobileLayout(layout) {
        applyMobileLayout(getGgbApi(), layout);
      }
      function updateActiveMode(mode) {
        document.querySelectorAll('[data-mode]').forEach(function (button) {
          button.classList.toggle('active', Number(button.getAttribute('data-mode')) === mode);
        });
      }
      function setToolMode(mode) {
        var api = getGgbApi();
        if (!api || typeof api.setMode !== 'function') return;
        api.setMode(mode);
        updateActiveMode(mode);
        toggleToolSheet(false);
      }
      function undoConstruction() {
        var api = getGgbApi();
        if (api && typeof api.undo === 'function') api.undo();
      }
      function redoConstruction() {
        var api = getGgbApi();
        if (api && typeof api.redo === 'function') api.redo();
        toggleToolSheet(false);
      }
      function toggleToolSheet(forceOpen) {
        var sheet = document.getElementById('tool-sheet');
        var backdrop = document.getElementById('sheet-backdrop');
        var moreButton = document.getElementById('more-tools-button');
        var open = typeof forceOpen === 'boolean' ? forceOpen : !sheet.classList.contains('open');
        sheet.classList.toggle('open', open);
        backdrop.classList.toggle('open', open);
        moreButton.classList.toggle('active', open);
        moreButton.setAttribute('aria-expanded', String(open));
      }
      function askForReset() {
        toggleToolSheet(false);
        document.getElementById('reset-confirm').classList.add('open');
      }
      function closeResetConfirm() {
        document.getElementById('reset-confirm').classList.remove('open');
      }
      function resetConstruction() {
        closeResetConfirm();
        var api = getGgbApi();
        if (api && typeof api.reset === 'function') {
          api.reset();
          api.setMode(0);
          updateActiveMode(0);
        }
      }
    </script>
  </body>
</html>`;

function GgbResourceViewerComponent({
  resource,
  reloadKey,
  onReady,
  onError,
}: GgbResourceViewerProps) {
  const [html, setHtml] = useState('');
  const [nativeDocumentUri, setNativeDocumentUri] = useState('');
  const channel = useMemo(
    () => `${resource.id}-${reloadKey}-${Date.now()}`,
    [reloadKey, resource.id]
  );

  useEffect(() => {
    let disposed = false;
    let generatedDocumentUri = '';
    setHtml('');
    setNativeDocumentUri('');
    void loadResourceAsBase64(resource)
      .then(async (base64) => {
        const documentHtml = buildGgbHtml(base64, channel);
        if (Platform.OS === 'web') {
          if (!disposed) setHtml(documentHtml);
          return;
        }

        const cacheRoot =
          FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!cacheRoot) throw new Error('设备缓存目录不可用');
        generatedDocumentUri = `${cacheRoot}ggb-viewer-${resource.id.replace(/[^\w-]/g, '_')}-${Date.now()}.html`;
        await FileSystem.writeAsStringAsync(
          generatedDocumentUri,
          documentHtml,
          { encoding: FileSystem.EncodingType.UTF8 }
        );
        if (disposed) {
          await FileSystem.deleteAsync(generatedDocumentUri, {
            idempotent: true,
          });
        } else {
          setNativeDocumentUri(generatedDocumentUri);
        }
      })
      .catch((error) => {
        if (!disposed) {
          onError(
            error instanceof Error
              ? error.message
              : 'GeoGebra 课件读取失败，请稍后重试'
          );
        }
      });
    return () => {
      disposed = true;
      if (generatedDocumentUri) {
        void FileSystem.deleteAsync(generatedDocumentUri, {
          idempotent: true,
        }).catch(() => undefined);
      }
    };
  }, [channel, onError, resource]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleMessage = (event: MessageEvent<GgbMessage>) => {
      const message = event.data;
      if (message?.source !== 'imates-ggb' || message.channel !== channel) return;
      if (message.type === 'ready') onReady();
      if (message.type === 'error') {
        onError(message.message || 'GeoGebra 课件打开失败');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [channel, onError, onReady]);

  const handleNativeMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as GgbMessage;
      if (message.source !== 'imates-ggb' || message.channel !== channel) return;
      if (message.type === 'ready') onReady();
      if (message.type === 'error') {
        onError(message.message || 'GeoGebra 课件打开失败');
      }
    } catch {
      // 忽略 GeoGebra 内部的其他消息。
    }
  };

  if (Platform.OS === 'web') {
    if (!html) return null;
    return (
      <iframe
        key={channel}
        srcDoc={html}
        title={resource.fileName}
        style={webGgbFrameStyle}
        allow="fullscreen"
      />
    );
  }

  if (!nativeDocumentUri) return null;

  return (
    <WebView
      key={channel}
      source={{ uri: nativeDocumentUri }}
      style={styles.webView}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      allowsInlineMediaPlayback
      mixedContentMode="compatibility"
      overScrollMode="never"
      bounces={false}
      onMessage={handleNativeMessage}
      onError={({ nativeEvent }) =>
        onError(nativeEvent.description || 'GeoGebra 课件打开失败')
      }
      onHttpError={({ nativeEvent }) =>
        onError(`GeoGebra 引擎请求失败（HTTP ${nativeEvent.statusCode}）`)
      }
    />
  );
}

const webGgbFrameStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  background: '#FFFFFF',
};

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

export const GgbResourceViewer = memo(GgbResourceViewerComponent);
