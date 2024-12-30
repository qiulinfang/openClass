package com.cosinetech.imates.views;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;
import androidx.annotation.Nullable;
import java.util.ArrayList;

public class PaintView extends View {
    public static final int DEFAULT_BRUSH_SIZE = 20;
    public static final int DEFAULT_BRUSH_COLOR = Color.BLACK;
    public static final int DEFAULT_BG_COLOR = Color.WHITE;
    private static final float DEFAULT_TOUCH_TOLERANCE = 4;
    private float mX, mY;
    private boolean mIsTouching = false;

    // 区域选取功能相关
    private boolean mInSelectMode = false;
    private Paint dashedPaint;
    private Path dashedPath;
    private PointF startPoint;
    private PointF endPoint;
    private Path mPath;
    private Paint mPaint;
    private Paint mCursorPaint;
    private ArrayList<DrawingPath> paths = new ArrayList<>();
    private ArrayList<DrawingPath> undoPaths = new ArrayList<>();
    private int brushColor;
    private int backgroundColor;
    private int brushSize;
    private float touchTolerance;
    private Bitmap mBitmap;
    private Canvas mCanvas;
    private Paint mBitmapPaint = new Paint(Paint.DITHER_FLAG);
    private DrawingChangeListener drawingChangeListener;

    public PaintView(Context context) {
        this(context, null);
        init();
    }

    public PaintView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public void init()  {
        mPaint = new Paint();
        mPaint.setAntiAlias(true);
        mPaint.setDither(true);
        mPaint.setColor(DEFAULT_BRUSH_COLOR);
        mPaint.setStyle(Paint.Style.STROKE);
        mPaint.setStrokeJoin(Paint.Join.ROUND);
        mPaint.setStrokeCap(Paint.Cap.ROUND);
        mPaint.setXfermode(null);
        mPaint.setAlpha(0xff);

        mCursorPaint = new Paint();
        mCursorPaint.setAntiAlias(true);
        mCursorPaint.setDither(true);
        mCursorPaint.setColor(DEFAULT_BRUSH_COLOR);
        mCursorPaint.setStyle(Paint.Style.STROKE);
        mCursorPaint.setStrokeJoin(Paint.Join.ROUND);
        mCursorPaint.setStrokeCap(Paint.Cap.ROUND);
        mCursorPaint.setXfermode(null);
        mCursorPaint.setAlpha(0xff);

        brushColor = DEFAULT_BRUSH_COLOR;
        backgroundColor = DEFAULT_BG_COLOR;
        brushSize = DEFAULT_BRUSH_SIZE;
        touchTolerance = DEFAULT_TOUCH_TOLERANCE;
        setLayerType(LAYER_TYPE_SOFTWARE, null);

        dashedPaint = new Paint();
        dashedPaint.setStyle(Paint.Style.STROKE);
        dashedPaint.setStrokeWidth(4);
        dashedPaint.setColor(0xFF0000FF); // Blue color
        dashedPaint.setPathEffect(new DashPathEffect(new float[]{10, 10}, 0));

        dashedPath = new Path();
        startPoint = new PointF();
        endPoint = new PointF();
    }
    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        if (mBitmap == null) {
            mBitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            mCanvas = new Canvas(mBitmap);
        }
        startPoint.x = 0;
        startPoint.y = 0;

        endPoint.x = w;
        endPoint.y = h;
    }

    public void setBitmap(Bitmap bitmap) {
        paths.clear();
        undoPaths.clear();
        mBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, true);
        mCanvas = new Canvas(mBitmap);
        invalidate();
    }

    public void setBrushColor(int color){
        brushColor = color;
    }

    public int getBrushColor() {
        return brushColor;
    }

    public void setBrushSize(int size){
        brushSize = size;
    }

    public int getBrushSize() {
        return brushSize;
    }

    public void setBackgroundColor(int color){
        backgroundColor = color;
    }

    public int getBackgroundColor() {
        return backgroundColor;
    }

    public void setTouchTolerance(float tolerance) {
        touchTolerance = tolerance;
    }

    public float getTouchTolerance() {
        return touchTolerance;
    }

    public void clearCanvas(){
        paths.clear();
        mCanvas.drawColor(backgroundColor);
        invalidate();
    }

    public  Bitmap getSelectedBitmap() {
        // 获取矩形区域
        RectF rect = new RectF(
                Math.min(startPoint.x, endPoint.x),
                Math.min(startPoint.y, endPoint.y),
                Math.max(startPoint.x, endPoint.x),
                Math.max(startPoint.y, endPoint.y)
        );

        // 裁剪出矩形区域的 Bitmap
        return Bitmap.createBitmap(mBitmap,
                (int) rect.left,
                (int) rect.top,
                (int) rect.width(),
                (int) rect.height());
    }
    public Bitmap getCanvasBitmap(){
        return mBitmap;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawBitmap(mBitmap, 0, 0, mBitmapPaint);

        for (DrawingPath drawingPath : paths) {
            mPaint.setColor(drawingPath.color);
            mPaint.setStrokeWidth(drawingPath.strokeWidth);
            if (drawingPath.isEraser) {
                mPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
            } else {
                mPaint.setXfermode(null);
            }
            canvas.drawPath(drawingPath.path, mPaint);
        }

        if(mIsTouching) {
            mCursorPaint.setColor(mPaint.getColor());
            canvas.drawCircle(mX, mY, mPaint.getStrokeWidth(), mCursorPaint);
        }

        if(mInSelectMode) {
            if(isSelectAreaValid()) {
                if (startPoint.x != 0 || startPoint.y != 0 || endPoint.x != 0 || endPoint.y != 0) {
                    dashedPath.reset();
                    dashedPath.moveTo(startPoint.x, startPoint.y);
                    dashedPath.lineTo(endPoint.x, startPoint.y);
                    dashedPath.lineTo(endPoint.x, endPoint.y);
                    dashedPath.lineTo(startPoint.x, endPoint.y);
                    dashedPath.close();
                    canvas.drawPath(dashedPath, dashedPaint);
                }
            }
        }
    }

    private void savePathToBitmap(DrawingPath drawingPath) {
        if (drawingPath.isEraser) {
            // Use clear mode for eraser paths
            mPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        } else {
            // Use normal brush mode
            mPaint.setXfermode(null);
        }
        mPaint.setColor(drawingPath.color);
        mPaint.setStrokeWidth(drawingPath.strokeWidth);
        mCanvas.drawPath(drawingPath.path, mPaint);
        mPaint.setXfermode(null); // Restore the normal Xfermode
    }

    public void startTouch(float x, float y){
        if(mInSelectMode) {
            startPoint.set(x, y);
            endPoint.set(x, y);
        } else {
            mPath = new Path();
            boolean isEraser = mPaint.getXfermode() != null;
            DrawingPath drawingPath = new DrawingPath(brushColor, brushSize, mPath, isEraser);
            paths.add(drawingPath);
            mPath.reset();
            mPath.moveTo(x, y);
            mX = x;
            mY = y;
        }
        mIsTouching = true;
        invalidate();
    }

    private void touchMove(float x, float y){
        if(mInSelectMode) {
            endPoint.set(x, y);
        } else {
            float dx = Math.abs(x - mX);
            float dy = Math.abs(y - mY);

            if (dx >= touchTolerance || dy >= touchTolerance) {
                if (mPaint.getXfermode() != null) {
                    mPath.quadTo(mX, mY, (x + mX) / 2, (y + mY) / 2);  // 如果是橡皮擦，绘制透明路径
                } else {
                    mPath.lineTo(x, y);  // 正常绘制路径
                }
                mX = x;
                mY = y;
            }
        }
    }

    private boolean isSelectAreaValid() {
        if(Math.abs(endPoint.x - startPoint.x) >= 10 && Math.abs(endPoint.y - startPoint.y) >= 10) {
            return true;
        } else {
            return false;
        }
    }

    private void touchUp(float x, float y){
        mIsTouching = false;
        if(mInSelectMode ) {
            endPoint.set(x, y);
            if(isSelectAreaValid()) {
                if (drawingChangeListener != null) {
                    drawingChangeListener.onSelectionEnd(x, y);
                }
            }
        } else {
            mPath.lineTo(mX, mY);
            savePathToBitmap(paths.get(paths.size() - 1));
        }
        invalidate();
    }

    public void drawToCanvas(float x, float y){
        mPath.lineTo(x,y);
        invalidate();
    }

    public void undoDrawing(){
        if(paths.size() > 0){
            undoPaths.add(paths.remove(paths.size()-1));
            redrawToBitmap();
            invalidate();
        }
    }

    public void redoDrawing(){
        if(undoPaths.size() > 0){
            paths.add(undoPaths.remove(undoPaths.size()-1));
            redrawToBitmap();
            invalidate();
        }
    }

    public void enableSelection() {
        mInSelectMode = true;
    }

    public void disableSelection() {
        mInSelectMode = false;
        startPoint.x = 0;
        startPoint.y = 0;

        endPoint.x = getWidth();
        endPoint.y = getHeight();
    }

    private void redrawToBitmap() {
        if (mBitmap != null) {
            // 清空画布，但保留现有的 Bitmap 内容
            mBitmap.eraseColor(Color.TRANSPARENT);
        } else {
            mCanvas.drawColor(backgroundColor); // 没有自定义背景图时使用纯色背景
        }

        for (DrawingPath path : paths) {
            savePathToBitmap(path);
        }
    }

    int layerid = -1;
    public void enableEraser(){
        mPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
    }


    public void disableEraser(){
        mPaint.setXfermode(null);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        float x = event.getX();
        float y = event.getY();
        switch (event.getAction()){
            case MotionEvent.ACTION_DOWN:
                startTouch(x,y);
                if(drawingChangeListener != null){
                    drawingChangeListener.onTouchStart(x,y);
                }
                invalidate();
                break;
            case MotionEvent.ACTION_MOVE:
                touchMove(x,y);
                if(drawingChangeListener != null){
                    drawingChangeListener.onDrawingChange(x,y);
                }
                invalidate();
                break;
            case MotionEvent.ACTION_UP:
                touchUp(x, y);
                if(drawingChangeListener != null){
                    drawingChangeListener.onDrawingChange(x,y);
                }
                invalidate();
                break;
        }
        return true;
    }

    public void addDrawingChangeListener(DrawingChangeListener listener){
        drawingChangeListener = listener;
    }
}
