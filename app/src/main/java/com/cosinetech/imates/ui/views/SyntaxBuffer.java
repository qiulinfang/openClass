package com.cosinetech.imates.ui.views;

import android.util.Log;

public class SyntaxBuffer {
    private static final String TAG = "SyntaxBuffer";
    private final StringBuilder buffer = new StringBuilder();
    private int latexBlockDepth;
    private boolean inLatexInline;
    private boolean escaping;

    void feed(char c) {
        buffer.append(c);
        updateState(c);
    }

    // 状态分析方法（支持转义字符）
    private void updateState(char c) {
        if(!escaping && c != '\\') {
            buffer.append(c);
        }
        // 处理转义字符
        if (escaping) {
            escaping = false;

            if(c == '(' || c == ')' || c == '[' || c == ']')  {
                if(c == '(' || c == ')') {
                    buffer.append("$$");
                } else {
                    buffer.append("$$\n");
                }
            } else {
                buffer.append('\\');
                buffer.append(c);
            }
        }

        if (c == '\\') {
            escaping = true;
            return;
        }

        // $$公式检测
        if (buffer.length() >= 2) {
            int pos = buffer.length() - 1;
            char prev = buffer.charAt(pos - 1);
            if (prev == '$' && c == '$' && !isEscaped(pos - 1)) {
                latexBlockDepth += (latexBlockDepth % 2 == 0) ? 1 : -1;
                return;
            }
        }

// 行内公式检测（排除块公式情况）
//        if (c == '$' && latexBlockDepth % 2 == 0) {
//            if (buffer.length() == 1 ||
//                    buffer.charAt(buffer.length()-2) != '$' ||
//                    isEscaped(buffer.length()-2)) {
//                inLatexInline = !inLatexInline;
//            }
//        }
    }

    private boolean isEscaped(int pos) {
        if (pos <= 0) return false;
        int escapeCount = 0;
        while (pos > 0 && buffer.charAt(pos-1) == '\\') {
            escapeCount++;
            pos--;
        }
        return escapeCount % 2 != 0;
    }

    String flushSafeContent() {
        if (hasPendingLatex()) {
            return "";
        }
        return flushContent();
    }

    String flushAll() {
        return flushContent();
    }

    private String flushContent() {
        String content = buffer.toString();
        buffer.setLength(0);
        reset();
        return content;
    }

    boolean hasPendingLatex() {
        return latexBlockDepth % 2 != 0 || inLatexInline || escaping;
    }

    void reset() {
        latexBlockDepth = 0;
        inLatexInline = false;
        escaping = false;
    }
}
