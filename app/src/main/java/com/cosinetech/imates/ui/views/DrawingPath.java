package com.cosinetech.imates.ui.views;

import android.graphics.Path;

public class DrawingPath {

    public int color;
    public int strokeWidth;
    public Path path;
    public boolean isEraser;

    public DrawingPath(int color, int strokeWidth, Path path, boolean isEraser) {
        this.color = color;
        this.strokeWidth = strokeWidth;
        this.path = path;
        this.isEraser = isEraser;
    }
}