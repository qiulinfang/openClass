// packages/shared-logic/src/utils/format.js
export function formatDate(date) {
    return new Date(date).toLocaleDateString('zh-CN');
  }