package com.artifex.mupdf;

public interface MuPDFReaderViewListener {
    void onMoveToChild(int i);

    void onTapMainDocArea();

    void onDocMotion();

    void onHit(Hit item);
}
