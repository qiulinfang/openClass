package com.cosinetech.imates.views;

public interface DrawingChangeListener {
    void onTouchStart(float x, float y);
    void onDrawingChange(float x, float y);

    void onSelectionEnd(float x, float y);
}
