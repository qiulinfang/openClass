package com.artifex.mupdfdemo;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Bitmap.Config;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Point;
import android.graphics.PointF;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Handler;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.ProgressBar;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;

// Make our ImageViews opaque to optimize redraw
class OpaqueImageView extends ImageView {

    public OpaqueImageView(Context context) {
        super(context);
    }

    @Override
    public boolean isOpaque() {
        return true;
    }
}

interface TextProcessor {
    void onStartLine();

    void onWord(TextWord word);

    void onEndLine();
}

class TextSelector {
    final private TextWord[][] mText;
    final private RectF mSelectBox;

    public TextSelector(TextWord[][] text, RectF selectBox) {
        mText = text;
        mSelectBox = selectBox;
    }

    public void select(TextProcessor tp) {
        if (mText == null || mSelectBox == null)
            return;

        ArrayList<TextWord[]> lines = new ArrayList<TextWord[]>();
        for (TextWord[] line : mText)
            if (line[0].bottom > mSelectBox.top && line[0].top < mSelectBox.bottom)
                lines.add(line);

        Iterator<TextWord[]> it = lines.iterator();
        while (it.hasNext()) {
            TextWord[] line = it.next();
            boolean firstLine = line[0].top < mSelectBox.top;
            boolean lastLine = line[0].bottom > mSelectBox.bottom;
            float start = Float.NEGATIVE_INFINITY;
            float end = Float.POSITIVE_INFINITY;

            if (firstLine && lastLine) {
                start = Math.min(mSelectBox.left, mSelectBox.right);
                end = Math.max(mSelectBox.left, mSelectBox.right);
            } else if (firstLine) {
                start = mSelectBox.left;
            } else if (lastLine) {
                end = mSelectBox.right;
            }

            tp.onStartLine();

            for (TextWord word : line)
                if (word.right > start && word.left < end)
                    tp.onWord(word);

            tp.onEndLine();
        }
    }
}

public abstract class PageView extends ViewGroup {
    private static final float ITEM_SELECT_BOX_WIDTH = 4.0f;// 选中时边框的宽

    private static final int HIGHLIGHT_COLOR = 0x80ff5722;// 选中文字时的颜色
    private int LINK_COLOR = 0x80ff5722;// 超链接颜色
    //    private static final int BOX_COLOR = 0xFF4444FF;
    private static final int BOX_COLOR = 0xFF696969;// 选中时边框的颜色
    //    private static final int INK_COLOR = 0xFF000000;// 绘制时画笔颜色
    private int INK_COLOR = 0xFF000000;// 绘制时画笔颜色
    //    private static final float INK_THICKNESS = 10.0f;// 绘制时画笔宽
    private float INK_THICKNESS = 10.0f;// 绘制时画笔宽
    private float current_scale;

    // Eraser related variables
    private boolean mEraserMode = false;
    private float ERASER_THICKNESS = 20.0f; // Eraser thickness (wider than pen)
    private ArrayList<PointF> mEraserPath; // Current eraser path
    private ArrayList<ArrayList<PointF>> mEraserPaths; // All eraser paths

    // 添加变量来跟踪当前正在编辑的 annotation
    private int mEditingAnnotationIndex = -1;
    private PointF[][] mEditingAnnotationInkList = null;
    private boolean mAnnotationModified = false;

    private static final int BACKGROUND_COLOR = 0xFFFFFFFF;
    private static final int PROGRESS_DIALOG_DELAY = 200;
    protected final Context mContext;
    protected int mPageNumber;
    private Point mParentSize;
    protected Point mSize;   // Size of page at minimum zoom
    protected float mSourceScale;
    protected Annotation mAnnotations[];
    private ImageView mEntire; // Image rendered at minimum zoom
    private Bitmap mEntireBm;
    private Matrix mEntireMat;
    private AsyncTask<Void, Void, TextWord[][]> mGetText;
    private AsyncTask<Void, Void, LinkInfo[]> mGetLinkInfo;
    private CancellableAsyncTask<Void, Void> mDrawEntire;

    private Point mPatchViewSize; // View size on the basis of which the patch was created
    private Rect mPatchArea;
    private ImageView mPatch;
    private Bitmap mPatchBm;
    private CancellableAsyncTask<Void, Void> mDrawPatch;
    private RectF mSearchBoxes[];
    protected LinkInfo mLinks[];
    private RectF mSelectBox;
    private TextWord mText[][];
    private RectF mItemSelectBox;
    protected ArrayList<ArrayList<PointF>> mDrawing;
    protected View mSearchView;
    private boolean mIsBlank;
    private boolean mHighlightLinks;

    private ProgressBar mBusyIndicator;
    private final Handler mHandler = new Handler();

    public PageView(Context c, Point parentSize, Bitmap sharedHqBm) {
        super(c);
        mContext = c;
        mParentSize = parentSize;
        setBackgroundColor(BACKGROUND_COLOR);
        mEntireBm = Bitmap.createBitmap(parentSize.x, parentSize.y, Config.ARGB_8888);
        mPatchBm = sharedHqBm;
        mEntireMat = new Matrix();
    }

    protected abstract CancellableTaskDefinition<Void, Void> getDrawPageTask(Bitmap bm, int sizeX, int sizeY, int patchX, int patchY, int patchWidth, int patchHeight);

    protected abstract CancellableTaskDefinition<Void, Void> getUpdatePageTask(Bitmap bm, int sizeX, int sizeY, int patchX, int patchY, int patchWidth, int patchHeight);

    protected abstract LinkInfo[] getLinkInfo();

    protected abstract TextWord[][] getText();

    protected abstract void addMarkup(PointF[] quadPoints, Annotation.Type type);

    private void reinit() {
        // Cancel pending render task
        if (mDrawEntire != null) {
            mDrawEntire.cancelAndWait();
            mDrawEntire = null;
        }

        if (mDrawPatch != null) {
            mDrawPatch.cancelAndWait();
            mDrawPatch = null;
        }

        if (mGetLinkInfo != null) {
            mGetLinkInfo.cancel(true);
            mGetLinkInfo = null;
        }

        if (mGetText != null) {
            mGetText.cancel(true);
            mGetText = null;
        }

        mIsBlank = true;
        mPageNumber = 0;

        if (mSize == null)
            mSize = mParentSize;

        if (mEntire != null) {
            mEntire.setImageBitmap(null);
            mEntire.invalidate();
        }

        if (mPatch != null) {
            mPatch.setImageBitmap(null);
            mPatch.invalidate();
        }

        mPatchViewSize = null;
        mPatchArea = null;

        mSearchBoxes = null;
        mLinks = null;
        mSelectBox = null;
        mText = null;
        mItemSelectBox = null;
    }

    public void releaseResources() {
        reinit();

        if (mBusyIndicator != null) {
            removeView(mBusyIndicator);
            mBusyIndicator = null;
        }
    }

    public void releaseBitmaps() {
        reinit();

        //  recycle bitmaps before releasing them.

        if (mEntireBm != null)
            mEntireBm.recycle();
        mEntireBm = null;

        if (mPatchBm != null)
            mPatchBm.recycle();
        mPatchBm = null;
    }

    public void blank(int page) {
        reinit();
        mPageNumber = page;

        if (mBusyIndicator == null) {
            mBusyIndicator = new ProgressBar(mContext);
            mBusyIndicator.setIndeterminate(true);
            mBusyIndicator.setBackgroundResource(R.drawable.busy);
            addView(mBusyIndicator);
        }

        setBackgroundColor(BACKGROUND_COLOR);
    }

    public void setPage(int page, PointF size) {
        // Cancel pending render task
        if (mDrawEntire != null) {
            mDrawEntire.cancelAndWait();
            mDrawEntire = null;
        }

        mIsBlank = false;
        // Highlights may be missing because mIsBlank was true on last draw
        if (mSearchView != null)
            mSearchView.invalidate();

        mPageNumber = page;
        if (mEntire == null) {
            mEntire = new OpaqueImageView(mContext);
            mEntire.setScaleType(ImageView.ScaleType.MATRIX);
            addView(mEntire);
        }

        // Calculate scaled size that fits within the screen limits
        // This is the size at minimum zoom
        mSourceScale = Math.min(mParentSize.x / size.x, mParentSize.y / size.y);
        Point newSize = new Point((int) (size.x * mSourceScale), (int) (size.y * mSourceScale));
        mSize = newSize;

        mEntire.setImageBitmap(null);
        mEntire.invalidate();

        // Get the link info in the background
        mGetLinkInfo = new AsyncTask<Void, Void, LinkInfo[]>() {
            protected LinkInfo[] doInBackground(Void... v) {
                return getLinkInfo();
            }

            protected void onPostExecute(LinkInfo[] v) {
                mLinks = v;
                if (mSearchView != null)
                    mSearchView.invalidate();
            }
        };

        mGetLinkInfo.execute();

        // Render the page in the background
        mDrawEntire = new CancellableAsyncTask<Void, Void>(getDrawPageTask(mEntireBm, mSize.x, mSize.y, 0, 0, mSize.x, mSize.y)) {

            @Override
            public void onPreExecute() {
                setBackgroundColor(BACKGROUND_COLOR);
                mEntire.setImageBitmap(null);
                mEntire.invalidate();

                if (mBusyIndicator == null) {
                    mBusyIndicator = new ProgressBar(mContext);
                    mBusyIndicator.setIndeterminate(true);
                    mBusyIndicator.setBackgroundResource(R.drawable.busy);
                    addView(mBusyIndicator);
                    mBusyIndicator.setVisibility(INVISIBLE);
                    mHandler.postDelayed(new Runnable() {
                        public void run() {
                            if (mBusyIndicator != null)
                                mBusyIndicator.setVisibility(VISIBLE);
                        }
                    }, PROGRESS_DIALOG_DELAY);
                }
            }

            @Override
            public void onPostExecute(Void result) {
                removeView(mBusyIndicator);
                mBusyIndicator = null;
                mEntire.setImageBitmap(mEntireBm);
                mEntire.invalidate();
                setBackgroundColor(Color.TRANSPARENT);

            }
        };

        mDrawEntire.execute();

        if (mSearchView == null) {
            mSearchView = new View(mContext) {
                @Override
                protected void onDraw(final Canvas canvas) {
                    super.onDraw(canvas);
                    // Work out current total scale factor
                    // from source to view
                    final float scale = mSourceScale * (float) getWidth() / (float) mSize.x;
                    current_scale = scale;

                    final Paint paint = new Paint();

                    if (!mIsBlank && mSearchBoxes != null) {
                        // 搜索颜色
                        // paint.setColor(mContext.getResources().getColor(R.color.search_bg));
                        paint.setColor(HIGHLIGHT_COLOR);
                        for (RectF rect : mSearchBoxes)
                            canvas.drawRect(rect.left * scale, rect.top * scale,
                                    rect.right * scale, rect.bottom * scale,
                                    paint);
                    }

                    if (!mIsBlank && mLinks != null && mHighlightLinks) {
                        // 超链接颜色
                        // paint.setColor(mContext.getResources().getColor(R.color.link_bg));
                        paint.setColor(LINK_COLOR);
                        for (LinkInfo link : mLinks)
                            canvas.drawRect(link.rect.left * scale, link.rect.top * scale,
                                    link.rect.right * scale, link.rect.bottom * scale,
                                    paint);
                    }

                    if (mSelectBox != null && mText != null) {
                        // 选中文字 复制，高亮，下划线，删除线选中时的颜色
                        paint.setColor(HIGHLIGHT_COLOR);
                        processSelectedText(new TextProcessor() {
                            RectF rect;

                            public void onStartLine() {
                                rect = new RectF();
                            }

                            public void onWord(TextWord word) {
                                rect.union(word);
                            }

                            public void onEndLine() {
                                if (!rect.isEmpty())
                                    canvas.drawRect(rect.left * scale, rect.top * scale, rect.right * scale, rect.bottom * scale, paint);
                            }
                        });
                    }

                    // 选中时的外边框
                    if (mItemSelectBox != null) {
                        paint.setStyle(Paint.Style.STROKE);
                        // 边框宽
                        paint.setStrokeWidth(ITEM_SELECT_BOX_WIDTH);
                        // 边框颜色
                        // paint.setColor(mContext.getResources().getColor(R.color.link_bg));
                        paint.setColor(BOX_COLOR);
                        canvas.drawRect(mItemSelectBox.left * scale, mItemSelectBox.top * scale, mItemSelectBox.right * scale, mItemSelectBox.bottom * scale, paint);
                    }

                    if (mDrawing != null) {
                        Path path = new Path();
                        PointF p;

                        paint.setAntiAlias(true);
                        paint.setDither(true);
                        paint.setStrokeJoin(Paint.Join.ROUND);
                        paint.setStrokeCap(Paint.Cap.ROUND);

                        paint.setStyle(Paint.Style.FILL);
                        // 绘制时画笔宽
                        paint.setStrokeWidth(INK_THICKNESS * scale);
                        // 绘制时画笔颜色
                        paint.setColor(INK_COLOR);

                        Iterator<ArrayList<PointF>> it = mDrawing.iterator();
                        while (it.hasNext()) {
                            ArrayList<PointF> arc = it.next();
                            if (arc.size() >= 2) {
                                Iterator<PointF> iit = arc.iterator();
                                p = iit.next();
                                float mX = p.x * scale;
                                float mY = p.y * scale;
                                path.moveTo(mX, mY);
                                while (iit.hasNext()) {
                                    p = iit.next();
                                    float x = p.x * scale;
                                    float y = p.y * scale;
                                    path.quadTo(mX, mY, (x + mX) / 2, (y + mY) / 2);
                                    mX = x;
                                    mY = y;
                                }
                                path.lineTo(mX, mY);
                            } else {
                                p = arc.get(0);
                                canvas.drawCircle(p.x * scale, p.y * scale, INK_THICKNESS * scale / 2, paint);
                            }
                        }

                        paint.setStyle(Paint.Style.STROKE);
                        canvas.drawPath(path, paint);
                    }
                    
                    // Draw eraser path (for visual feedback)
                    /*
                    if (mEraserMode && mEraserPath != null && mEraserPath.size() > 0) {
                        Path eraserPath = new Path();
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeWidth(ERASER_THICKNESS * scale);
                        paint.setColor(Color.RED); // Red color to indicate eraser
                        paint.setAlpha(100); // Semi-transparent
                        
                        if (mEraserPath.size() >= 2) {
                            Iterator<PointF> iit = mEraserPath.iterator();
                            PointF p = iit.next();
                            float mX = p.x * scale;
                            float mY = p.y * scale;
                            eraserPath.moveTo(mX, mY);
                            while (iit.hasNext()) {
                                p = iit.next();
                                float x = p.x * scale;
                                float y = p.y * scale;
                                eraserPath.quadTo(mX, mY, (x + mX) / 2, (y + mY) / 2);
                                mX = x;
                                mY = y;
                            }
                            eraserPath.lineTo(mX, mY);
                            canvas.drawPath(eraserPath, paint);
                        }
                    }
                    */
                    
                    // 绘制正在编辑的 annotation
                    if (mEraserMode && mEditingAnnotationIndex >= 0 && mEditingAnnotationInkList != null) {
                        Path path = new Path();
                        PointF p;

                        paint.setAntiAlias(true);
                        paint.setDither(true);
                        paint.setStrokeJoin(Paint.Join.ROUND);
                        paint.setStrokeCap(Paint.Cap.ROUND);

                        paint.setStyle(Paint.Style.FILL);
                        paint.setStrokeWidth(INK_THICKNESS * scale);
                        paint.setColor(INK_COLOR);

                        for (PointF[] arc : mEditingAnnotationInkList) {
                            if (arc.length >= 2) {
                                p = arc[0];
                                float mX = p.x * scale;
                                float mY = p.y * scale;
                                path.moveTo(mX, mY);
                                
                                for (int i = 1; i < arc.length; i++) {
                                    p = arc[i];
                                    float x = p.x * scale;
                                    float y = p.y * scale;
                                    path.quadTo(mX, mY, (x + mX) / 2, (y + mY) / 2);
                                    mX = x;
                                    mY = y;
                                }
                                
                                path.lineTo(mX, mY);
                            } else if (arc.length == 1) {
                                p = arc[0];
                                canvas.drawCircle(p.x * scale, p.y * scale, INK_THICKNESS * scale / 2, paint);
                            }
                        }

                        paint.setStyle(Paint.Style.STROKE);
                        canvas.drawPath(path, paint);
                    }
                }
            };

            addView(mSearchView);
        }
        requestLayout();
    }

    public void setSearchBoxes(RectF searchBoxes[]) {
        mSearchBoxes = searchBoxes;
        if (mSearchView != null)
            mSearchView.invalidate();
    }

    /**
     * 设置是否高亮显示超链接
     *
     * @param f boolean
     */
    public void setLinkHighlighting(boolean f) {
        mHighlightLinks = f;
        if (mSearchView != null)
            mSearchView.invalidate();
    }

    /**
     * 置超链接颜色
     *
     * @param color 颜色值
     */
    public void setLinkHighlightColor(int color) {
        LINK_COLOR = color;
        if (mHighlightLinks) {
            if (mSearchView != null) {
                mSearchView.invalidate();
            }
        }
    }

    public void deselectText() {
        mSelectBox = null;
        mSearchView.invalidate();
    }

    public void selectText(float x0, float y0, float x1, float y1) {
        float scale = mSourceScale * (float) getWidth() / (float) mSize.x;
        float docRelX0 = (x0 - getLeft()) / scale;
        float docRelY0 = (y0 - getTop()) / scale;
        float docRelX1 = (x1 - getLeft()) / scale;
        float docRelY1 = (y1 - getTop()) / scale;
        // Order on Y but maintain the point grouping
        if (docRelY0 <= docRelY1)
            mSelectBox = new RectF(docRelX0, docRelY0, docRelX1, docRelY1);
        else
            mSelectBox = new RectF(docRelX1, docRelY1, docRelX0, docRelY0);

        mSearchView.invalidate();

        if (mGetText == null) {
            mGetText = new AsyncTask<Void, Void, TextWord[][]>() {
                @Override
                protected TextWord[][] doInBackground(Void... params) {
                    return getText();
                }

                @Override
                protected void onPostExecute(TextWord[][] result) {
                    mText = result;
                    mSearchView.invalidate();
                }
            };

            mGetText.execute();
        }
    }

    /**
     * Set eraser mode on or off
     * 
     * @param enabled true to enable eraser mode, false for normal drawing mode
     */
    public void setEraserMode(boolean enabled) {
        mEraserMode = enabled;
        if (enabled && mEraserPaths == null) {
            mEraserPaths = new ArrayList<>();
        }
    }
    
    /**
     * Check if eraser mode is enabled
     * 
     * @return true if eraser mode is enabled
     */
    public boolean isEraserMode() {
        return mEraserMode;
    }
    
    /**
     * Set the eraser thickness
     * 
     * @param thickness the thickness of the eraser
     */
    public void setEraserThickness(float thickness) {
        ERASER_THICKNESS = thickness;
    }

    public void startDraw(float x, float y) {
        float scale = mSourceScale * (float) getWidth() / (float) mSize.x;
        float docRelX = (x - getLeft()) / scale;
        float docRelY = (y - getTop()) / scale;
        
        if (mEraserMode) {
            // Start eraser path
            if (mEraserPath == null) {
                mEraserPath = new ArrayList<>();
            } else {
                mEraserPath.clear();
            }
            mEraserPath.add(new PointF(docRelX, docRelY));
            if (mEraserPaths == null) {
                mEraserPaths = new ArrayList<>();
            }
            mEraserPaths.add(mEraserPath);
        } else {
            // Normal drawing
            if (mDrawing == null)
                mDrawing = new ArrayList<>();

            ArrayList<PointF> arc = new ArrayList<>();
            arc.add(new PointF(docRelX, docRelY));
            mDrawing.add(arc);
        }
        
        mSearchView.invalidate();
    }

    /**
     * 应用橡皮擦到已保存的 annotations
     * 
     * @param x x坐标
     * @param y y坐标
     * @return 是否有 annotation 被修改
     */
    private boolean applyEraserToAnnotations(float x, float y) {
        if (!mEraserMode) return false;
        
        float eraserRadius = ERASER_THICKNESS / 2;
        boolean modified = false;
        
        // 如果当前没有正在编辑的 annotation，尝试查找一个
        if (mEditingAnnotationIndex == -1) {
            int hitAnnot = -1; //((MuPDFPageView)this).getCore().hitAnnotation(mPageNumber, x, y);
            if (mAnnotations != null) {
                for (int i = 0; i < mAnnotations.length; i++) {
                    if (mAnnotations[i].contains(x, y)) {
                        if (Objects.requireNonNull(mAnnotations[i].type) == Annotation.Type.INK) {
                            hitAnnot = i;
                        }
                    }
                }
            }
            if (hitAnnot >= 0) {
                mEditingAnnotationIndex = hitAnnot;
                mEditingAnnotationInkList = ((MuPDFPageView)this).getCore().getAnnotationInkList(mPageNumber, hitAnnot);
                mAnnotationModified = false;
            }
        }
        
        // 如果有正在编辑的 annotation，应用橡皮擦
        if (mEditingAnnotationIndex >= 0 && mEditingAnnotationInkList != null) {
            // 转换为 ArrayList 以便于修改
            ArrayList<ArrayList<PointF>> inkList = new ArrayList<>();
            for (PointF[] path : mEditingAnnotationInkList) {
                ArrayList<PointF> pathList = new ArrayList<>();
                for (PointF point : path) {
                    pathList.add(point);
                }
                inkList.add(pathList);
            }
            
            // 应用橡皮擦逻辑，类似于 applyEraser 方法
            boolean pathModified = false;
            Iterator<ArrayList<PointF>> pathIterator = inkList.iterator();
            while (pathIterator.hasNext()) {
                ArrayList<PointF> path = pathIterator.next();
                ArrayList<PointF> newPath = new ArrayList<>();
                boolean addedToNewPath = false;
                
                Iterator<PointF> pointIterator = path.iterator();
                while (pointIterator.hasNext()) {
                    PointF point = pointIterator.next();
                    
                    // 计算点到橡皮擦的距离
                    float distance = (float) Math.sqrt(
                        Math.pow(point.x - x, 2) + 
                        Math.pow(point.y - y, 2)
                    );
                    
                    // 如果点在橡皮擦范围内，移除它
                    if (distance <= eraserRadius) {
                        pointIterator.remove();
                        pathModified = true;
                        modified = true;
                        
                        // 如果已经添加了点到新路径，需要开始一个新的路径段
                        if (addedToNewPath && !newPath.isEmpty()) {
                            if (newPath.size() > 1) {
                                inkList.add(newPath);
                            }
                            newPath = new ArrayList<>();
                            addedToNewPath = false;
                        }
                    } else {
                        // 保留这个点
                        if (pathModified) {
                            newPath.add(point);
                            addedToNewPath = true;
                        }
                    }
                }
                
                // 如果修改了路径并有新的路径段，添加它
                if (pathModified && !newPath.isEmpty() && newPath.size() > 1) {
                    inkList.add(newPath);
                }
                
                // 如果路径为空或只有一个点，移除它
                if (path.size() <= 1) {
                    pathIterator.remove();
                }
            }
            
            // 如果有修改，更新 annotation
            if (modified) {
                mAnnotationModified = true;
                
                // 转换回 PointF[][]
                mEditingAnnotationInkList = new PointF[inkList.size()][];
                for (int i = 0; i < inkList.size(); i++) {
                    ArrayList<PointF> path = inkList.get(i);
                    mEditingAnnotationInkList[i] = path.toArray(new PointF[path.size()]);
                }
                
                // 立即更新视图以提供实时反馈
                mSearchView.invalidate();
            }
        }
        
        return modified;
    }

    /**
     * 保存对 annotation 的修改
     */
    private void saveAnnotationChanges() {
        if (mEditingAnnotationIndex >= 0 && mAnnotationModified && mEditingAnnotationInkList != null) {
            // 获取当前 annotation 的颜色和粗细
            float[] color = getColor(); // 假设使用当前颜色
            float thickness = getInkThickness(); // 假设使用当前粗细
            
            // 更新 annotation
            boolean success = ((MuPDFPageView)this).getCore().updateInkAnnotation(
                mPageNumber, mEditingAnnotationIndex, mEditingAnnotationInkList, color, thickness);
            
            if (success) {
                // 重新加载 annotations 并更新视图
                ((MuPDFPageView)this).loadAnnotations();
                update();
            }
            
            // 重置编辑状态
            mEditingAnnotationIndex = -1;
            mEditingAnnotationInkList = null;
            mAnnotationModified = false;
        }
    }

    public void continueDraw(float x, float y) {
        float scale = mSourceScale * (float) getWidth() / (float) mSize.x;
        float docRelX = (x - getLeft()) / scale;
        float docRelY = (y - getTop()) / scale;

        if (mEraserMode) {
            // 继续橡皮擦路径
            if (mEraserPath != null) {
                mEraserPath.add(new PointF(docRelX, docRelY));
            
                // 应用橡皮擦到当前绘制的内容
                boolean currentDrawingModified = false;
                if (mDrawing != null && !mDrawing.isEmpty()) {
                    applyEraser(docRelX, docRelY);
                    currentDrawingModified = true;
                }
                
                // 应用橡皮擦到已保存的 annotations
                boolean annotationsModified = applyEraserToAnnotations(docRelX, docRelY);
                
                // 如果有任何修改，刷新视图
                if (currentDrawingModified || annotationsModified) {
                    mSearchView.invalidate();
                }
            }
        } else {
            // 正常绘制
            if (mDrawing != null && mDrawing.size() > 0) {
                ArrayList<PointF> arc = mDrawing.get(mDrawing.size() - 1);
                arc.add(new PointF(docRelX, docRelY));
                mSearchView.invalidate();
            }
        }
    }
    
    /**
     * Apply eraser at the given point to existing drawings
     * 
     * @param x x-coordinate in document space
     * @param y y-coordinate in document space
     */
    private void applyEraser(float x, float y) {
        if (mDrawing == null || mDrawing.isEmpty()) {
            return;
        }
        
        float eraserRadius = ERASER_THICKNESS / 2;
        
        // Iterate through all drawing paths
        Iterator<ArrayList<PointF>> pathIterator = mDrawing.iterator();
        while (pathIterator.hasNext()) {
            ArrayList<PointF> path = pathIterator.next();
            
            // Create a new path that will contain the non-erased points
            ArrayList<PointF> newPath = new ArrayList<>();
            boolean pathModified = false;
            boolean addedToNewPath = false;
            
            // Check each point in the path
            Iterator<PointF> pointIterator = path.iterator();
            while (pointIterator.hasNext()) {
                PointF point = pointIterator.next();
                
                // Calculate distance from eraser to this point
                float distance = (float) Math.sqrt(
                    Math.pow(point.x - x, 2) + 
                    Math.pow(point.y - y, 2)
                );
                
                // If point is within eraser radius, remove it
                if (distance <= eraserRadius) {
                    pointIterator.remove();
                    pathModified = true;
                    
                    // If we've already added points to the new path, we need to start a new path segment
                    if (addedToNewPath && !newPath.isEmpty()) {
                        // Add the current path to the drawing and start a new one
                        if (newPath.size() > 1) {
                            mDrawing.add(newPath);
                        }
                        newPath = new ArrayList<>();
                        addedToNewPath = false;
                    }
                } else {
                    // Keep this point
                    if (pathModified) {
                        // We're building a new path after erasing some points
                        newPath.add(point);
                        addedToNewPath = true;
                    }
                }
            }
            
            // If we modified the path and have a new path segment, add it
            if (pathModified && !newPath.isEmpty() && newPath.size() > 1) {
                mDrawing.add(newPath);
            }
            
            // Remove the original path if it's now empty or has only one point
            if (path.size() <= 1) {
                pathIterator.remove();
            }
        }
    }

    public void cancelDraw() {
        // 保存对 annotation 的修改
        saveAnnotationChanges();
        
        if (mEraserMode) {
            mEraserPath = null;
        } else {
            mDrawing = null;
        }
        mSearchView.invalidate();
    }

    protected PointF[][] getDraw() {
        if (mDrawing == null)
            return null;

        PointF[][] path = new PointF[mDrawing.size()][];

        for (int i = 0; i < mDrawing.size(); i++) {
            ArrayList<PointF> arc = mDrawing.get(i);
            path[i] = arc.toArray(new PointF[arc.size()]);
        }

        return path;
    }

    /**
     * 设置画笔颜色
     *
     * @param color 颜色值
     */
    public void setInkColor(int color) {
        INK_COLOR = color;
    }

    /**
     * 设置画笔粗细
     *
     * @param inkThickness 粗细值
     */
    public void setPaintStrokeWidth(float inkThickness) {
        INK_THICKNESS = inkThickness;
    }

    protected float getInkThickness() {
        if (current_scale == 0) {
            return 9.07563f / 2;
        } else {
//            return (INK_THICKNESS * current_scale) / 2;
            return INK_THICKNESS / 2;
        }
    }

    public float getCurrentScale() {
        if (current_scale == 0) {
            return 9.07563f;
        }
        return current_scale;
    }

    protected float[] getColor() {

        return changeColor(INK_COLOR);
    }




    /**
     * 将十进制颜色值转换成RGB格式
     *
     * @param color
     * @return
     */
    private float[] changeColor(int color) {

        int red = (color & 0xff0000) >> 16;
        int green = (color & 0x00ff00) >> 8;
        int blue = (color & 0x0000ff);

        float colors[] = new float[3];
        colors[0] = red / 255f;
        colors[1] = green / 255f;
        colors[2] = blue / 255f;

        return colors;
    }

    protected void processSelectedText(TextProcessor tp) {
        (new TextSelector(mText, mSelectBox)).select(tp);
    }

    public void setItemSelectBox(RectF rect) {
        mItemSelectBox = rect;
        if (mSearchView != null)
            mSearchView.invalidate();
    }

    @Override
    protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
        int x, y;
        switch (MeasureSpec.getMode(widthMeasureSpec)) {
            case MeasureSpec.UNSPECIFIED:
                x = mSize.x;
                break;
            default:
                x = MeasureSpec.getSize(widthMeasureSpec);
        }
        switch (MeasureSpec.getMode(heightMeasureSpec)) {
            case MeasureSpec.UNSPECIFIED:
                y = mSize.y;
                break;
            default:
                y = MeasureSpec.getSize(heightMeasureSpec);
        }

        setMeasuredDimension(x, y);

        if (mBusyIndicator != null) {
            int limit = Math.min(mParentSize.x, mParentSize.y) / 2;
            mBusyIndicator.measure(MeasureSpec.AT_MOST | limit, MeasureSpec.AT_MOST | limit);
        }
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        int w = right - left;
        int h = bottom - top;

        if (mEntire != null) {
            if (mEntire.getWidth() != w || mEntire.getHeight() != h) {
                mEntireMat.setScale(w / (float) mSize.x, h / (float) mSize.y);
                mEntire.setImageMatrix(mEntireMat);
                mEntire.invalidate();
            }
            mEntire.layout(0, 0, w, h);
        }

        if (mSearchView != null) {
            mSearchView.layout(0, 0, w, h);
        }

        if (mPatchViewSize != null) {
            if (mPatchViewSize.x != w || mPatchViewSize.y != h) {
                // Zoomed since patch was created
                mPatchViewSize = null;
                mPatchArea = null;
                if (mPatch != null) {
                    mPatch.setImageBitmap(null);
                    mPatch.invalidate();
                }
            } else {
                mPatch.layout(mPatchArea.left, mPatchArea.top, mPatchArea.right, mPatchArea.bottom);
            }
        }

        if (mBusyIndicator != null) {
            int bw = mBusyIndicator.getMeasuredWidth();
            int bh = mBusyIndicator.getMeasuredHeight();

            mBusyIndicator.layout((w - bw) / 2, (h - bh) / 2, (w + bw) / 2, (h + bh) / 2);
        }
    }

    public void updateHq(boolean update) {
        Rect viewArea = new Rect(getLeft(), getTop(), getRight(), getBottom());
        if (viewArea.width() == mSize.x || viewArea.height() == mSize.y) {
            // If the viewArea's size matches the unzoomed size, there is no need for an hq patch
            if (mPatch != null) {
                mPatch.setImageBitmap(null);
                mPatch.invalidate();
            }
        } else {
            final Point patchViewSize = new Point(viewArea.width(), viewArea.height());
            final Rect patchArea = new Rect(0, 0, mParentSize.x, mParentSize.y);

            // Intersect and test that there is an intersection
            if (!patchArea.intersect(viewArea))
                return;

            // Offset patch area to be relative to the view top left
            patchArea.offset(-viewArea.left, -viewArea.top);

            boolean area_unchanged = patchArea.equals(mPatchArea) && patchViewSize.equals(mPatchViewSize);

            // If being asked for the same area as last time and not because of an update then nothing to do
            if (area_unchanged && !update)
                return;

            boolean completeRedraw = !(area_unchanged && update);

            // Stop the drawing of previous patch if still going
            if (mDrawPatch != null) {
                mDrawPatch.cancelAndWait();
                mDrawPatch = null;
            }

            // Create and add the image view if not already done
            if (mPatch == null) {
                mPatch = new OpaqueImageView(mContext);
                mPatch.setScaleType(ImageView.ScaleType.MATRIX);
                addView(mPatch);
                mSearchView.bringToFront();
            }

            CancellableTaskDefinition<Void, Void> task;

            if (completeRedraw)
                task = getDrawPageTask(mPatchBm, patchViewSize.x, patchViewSize.y,
                        patchArea.left, patchArea.top,
                        patchArea.width(), patchArea.height());
            else
                task = getUpdatePageTask(mPatchBm, patchViewSize.x, patchViewSize.y,
                        patchArea.left, patchArea.top,
                        patchArea.width(), patchArea.height());

            mDrawPatch = new CancellableAsyncTask<Void, Void>(task) {

                public void onPostExecute(Void result) {
                    mPatchViewSize = patchViewSize;
                    mPatchArea = patchArea;
                    mPatch.setImageBitmap(mPatchBm);
                    mPatch.invalidate();
                    //requestLayout();
                    // Calling requestLayout here doesn't lead to a later call to layout. No idea
                    // why, but apparently others have run into the problem.
                    mPatch.layout(mPatchArea.left, mPatchArea.top, mPatchArea.right, mPatchArea.bottom);
                }
            };

            mDrawPatch.execute();
        }
    }

    public void update() {
        // Cancel pending render task
        if (mDrawEntire != null) {
            mDrawEntire.cancelAndWait();
            mDrawEntire = null;
        }

        if (mDrawPatch != null) {
            mDrawPatch.cancelAndWait();
            mDrawPatch = null;
        }


        // Render the page in the background
        mDrawEntire = new CancellableAsyncTask<Void, Void>(getUpdatePageTask(mEntireBm, mSize.x, mSize.y, 0, 0, mSize.x, mSize.y)) {

            public void onPostExecute(Void result) {
                mEntire.setImageBitmap(mEntireBm);
                mEntire.invalidate();
            }
        };

        mDrawEntire.execute();

        updateHq(true);
    }

    public void removeHq() {
        // Stop the drawing of the patch if still going
        if (mDrawPatch != null) {
            mDrawPatch.cancelAndWait();
            mDrawPatch = null;
        }

        // And get rid of it
        mPatchViewSize = null;
        mPatchArea = null;
        if (mPatch != null) {
            mPatch.setImageBitmap(null);
            mPatch.invalidate();
        }
    }

    public int getPage() {
        return mPageNumber;
    }

    @Override
    public boolean isOpaque() {
        return true;
    }
}
