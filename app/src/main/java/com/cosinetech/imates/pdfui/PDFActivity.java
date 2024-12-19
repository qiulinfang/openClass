package com.cosinetech.imates.pdfui;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.PopupMenu;

import com.cosinetech.imates.R;
import com.cosinetech.imates.colorpicker.ColorListener;
import com.cosinetech.imates.colorpicker.ColorPickerDialog;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.notes.NoteManager;
import com.cosinetech.imates.notes.NotePopupWindow;
import com.cosinetech.imates.pdfui.tree.TreeNodeData;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.widgets.DrawingChangeListener;
import com.cosinetech.imates.widgets.PaintView;
import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.listener.OnLoadCompleteListener;
import com.github.barteksc.pdfviewer.listener.OnPageChangeListener;
import com.github.barteksc.pdfviewer.listener.OnPageErrorListener;
import com.github.barteksc.pdfviewer.scroll.DefaultScrollHandle;
import com.github.barteksc.pdfviewer.util.FitPolicy;
import com.litao.slider.NiftySlider;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;
import com.shockwave.pdfium.PdfDocument;

import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.Serializable;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PDFActivity extends AppCompatActivity implements
        OnPageChangeListener,
        OnLoadCompleteListener,
        OnPageErrorListener {

    /// edit tools
    private ImageView btnBrushSize;
    private ImageView btnPalatte;
    private ImageView btnUseBrush;
    private ImageView btnUseEraser;
    private ImageView btnUndo;
    private ImageView btnRedo;
    private ImageView btnSelectArea;
    private ImageView btnOk;
    private ImageView btnCancel;

    private TextView textColorIndicator;
    private PaintView paintView;
    private View paintToolView;
    private int selectionColorId = R.color.assist_blue;
    private Chapter.Schema mSchema;
    //PDF控件
    PDFView pdfView;
    //按钮控件：返回、目录、缩略图
    FitPolicy pdfFitPolicy = FitPolicy.BOTH;
    boolean pdfSwipeHorizontal = false;

    //页码
    Integer pageNumber = 0;
    //PDF目录集合
    List<TreeNodeData> catelogues;

    //pdf文件名（限：assets里的文件）
    String assetsFileName;
    //pdf文件uri
    Uri uri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        //UIUtils.initWindowStyle(getWindow(), getSupportActionBar());//设置沉浸式
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_pdf);
        mSchema = getIntent().getParcelableExtra("Schema");

        paintView = findViewById(R.id.paint_view);

        btnBrushSize = findViewById(R.id.imgBrushSize);
        btnPalatte = findViewById(R.id.imgPalette);
        btnUseBrush = findViewById(R.id.imgBrush);
        btnUseEraser = findViewById(R.id.imgErase);
        btnUndo = findViewById(R.id.imgUndo);
        btnRedo = findViewById(R.id.imgRedo);
        btnSelectArea = findViewById(R.id.imgSelectArea);
        btnOk = findViewById(R.id.imgOK);
        btnCancel = findViewById(R.id.imgCancel);

        textColorIndicator = findViewById(R.id.colorIndicator);
        paintToolView = findViewById(R.id.img_edit_layout);
        paintToolView.setVisibility(View.GONE);

        //默认选择画笔
        btnUseBrush.setBackgroundColor(getColor(selectionColorId));

        paintView.addDrawingChangeListener(new DrawingChangeListener() {
            @Override
            public void onTouchStart(float x, float y) {

            }

            @Override
            public void onDrawingChange(float x, float y) {

            }

            @Override
            public void onSelectionEnd(float x, float y) {
                // 加载自定义布局
                View popupView = LayoutInflater.from(PDFActivity.this).inflate(R.layout.pdf_scribble_menu, null);

                // 创建 PopupWindow
                PopupWindow popupWindow = new PopupWindow(popupView,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        true);

                // 设置点击事件
                popupView.findViewById(R.id.menu_chat).setOnClickListener(view -> {
                    //Toast.makeText(this, "复制", Toast.LENGTH_SHORT).show();
                    popupWindow.dismiss();
                });

                popupView.findViewById(R.id.menu_note).setOnClickListener(view -> {
                    Bitmap bmp = paintView.getSelectedBitmap();
                    byte [] data = ImageUtils.compressBitmapToJpg(bmp);
                    URI fileName = makeNoteFullFilePath();
                    writeJpgToExternalStorage(data, fileName);
                    NoteManager manager = new NoteManager(getBaseContext());
                    StringBuilder htmlContentBuilder = new StringBuilder();
                    htmlContentBuilder.append("<img src=\"").append(fileName.toString()).append("\"/>");
                    manager.addNote(htmlContentBuilder.toString(), "");
                    popupWindow.dismiss();
                });

                // 显示 PopupWindow 在指定位置 (例如屏幕中央)
                popupWindow.showAtLocation(paintView, Gravity.NO_GRAVITY, (int)x, (int)y); // x=300, y=500
            }
        });

        com.litao.slider.NiftySlider slider = findViewById(R.id.niftySlider);
        btnBrushSize.setOnClickListener(v -> {
            if(slider.getVisibility() == View.VISIBLE) {
                btnBrushSize.setBackgroundColor(getColor(R.color.semi_black_transparent));
                slider.setVisibility(View.GONE);
            } else {
                slider.setVisibility(View.VISIBLE);
                btnBrushSize.setBackgroundColor(getColor(selectionColorId));
            }
        });

        slider.setOnIntValueChangeListener(new NiftySlider.OnIntValueChangeListener() {
            @Override
            public void onValueChange(@NonNull NiftySlider niftySlider, int i, boolean b) {
                paintView.setBrushSize(i);
            }
        });

        btnPalatte.setOnClickListener(v->{
            new ColorPickerDialog.Builder(this)
                    .setTitle("选择颜色")
                    .setPositiveButton("确定", (ColorListener) (colorInfo, fromUser) -> {
                        textColorIndicator.setTextColor(colorInfo.getColor());
                        paintView.setBrushColor(colorInfo.getColor());
                    })
                    .show();
        });

        btnUseBrush.setOnClickListener(
            v -> {
                resetPaintToolSelect();
                paintView.disableEraser();
                paintView.disableSelection();
                btnUseBrush.setBackgroundColor(getColor(selectionColorId));
            }
        );

        btnUseEraser.setOnClickListener(
               v-> {
                   resetPaintToolSelect();
                   paintView.enableEraser();
                   paintView.disableSelection();
                   btnUseEraser.setBackgroundColor(getColor(selectionColorId));
               }
        );

        btnSelectArea.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                resetPaintToolSelect();
                paintView.enableSelection();
                paintView.disableEraser();
                btnSelectArea.setBackgroundColor(getColor(selectionColorId));
            }
        });

        btnUndo.setOnClickListener(
                v -> paintView.undoDrawing()
        );

        btnRedo.setOnClickListener(
                v -> paintView.redoDrawing()
        );

        btnOk.setOnClickListener(v -> {

        });

        btnCancel.setOnClickListener( v -> {
            paintToolView.setVisibility(View.GONE);
            EasyFloat.show();
        });

        EasyFloat.with(this).setLayout(R.layout.floating_pdf_tools)
                .setSidePattern(SidePattern.AUTO_SIDE)
                .registerCallbacks(new OnFloatCallbacks() {
                    @Override
                    public void createdResult(boolean isCreated, @Nullable String msg, @Nullable View view) {
                        if (isCreated && view != null) {
                            // 获取浮动窗口中的按钮
                            Button btnClose = view.findViewById(R.id.btn_back);
                            btnClose.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    // 点击按钮时退出当前 Activity
                                    PDFActivity.this.finish();
                                }
                            });

                            Button btnContent = view.findViewById(R.id.btn_contents);
                            btnContent.setOnClickListener(v -> {
                                //跳转目录页面
                                Intent intent = new Intent(PDFActivity.this, PDFCatelogueActivity.class);
                                intent.putExtra("catelogues", (Serializable) catelogues);
                                PDFActivity.this.startActivityForResult(intent, 200);
                            });

                            Button btnThumbnail = view.findViewById(R.id.btn_thumbnail);
                            btnThumbnail.setOnClickListener( v->{
                                //跳转缩略图页面
                                Intent intent = new Intent(PDFActivity.this, PDFPreviewActivity.class);
                                intent.putExtra("AssetsPdf", assetsFileName);
                                intent.setData(uri);
                                PDFActivity.this.startActivityForResult(intent, 201);
                            });

                            CheckBox checkBoxColl = view.findViewById(R.id.btn_collapse);
                            checkBoxColl.setOnCheckedChangeListener((buttonView, isChecked) -> {
                                if(isChecked) {
                                    view.findViewById(R.id.tools_layout).setVisibility(View.GONE);
                                } else {
                                    view.findViewById(R.id.tools_layout).setVisibility(View.VISIBLE);
                                }
                            });

                            Button btnScratch = view.findViewById(R.id.btn_scratch);
                            btnScratch.setOnClickListener(v->{
                                Bitmap bmp = WindowUtils.getScreenshot2Bitmap(PDFActivity.this, pdfView);
                                EasyFloat.hide();
                                paintView.setBitmap(bmp);
                                //paintView.setBackgroundColor(Color.TRANSPARENT);
                                paintToolView.setVisibility(View.VISIBLE);
                            });

                            // tool bar
                            Button btnFitWidth = view.findViewById(R.id.btn_fit_width);
                            btnFitWidth.setOnClickListener(v->{
                                pdfFitPolicy = FitPolicy.WIDTH;
                                pdfSwipeHorizontal = false;
                                loadPdf();
                            });
                            Button btnFitHeight = view.findViewById(R.id.btn_fit_height);
                            btnFitHeight.setOnClickListener(v->{
                                pdfFitPolicy = FitPolicy.BOTH;
                                pdfSwipeHorizontal = false;
                                loadPdf();
                            });
                            Button btnScrollMode = view.findViewById(R.id.btn_hscroll);
                            btnScrollMode.setOnClickListener(v->{
                                pdfFitPolicy = FitPolicy.HEIGHT;
                                pdfSwipeHorizontal = true;
                                loadPdf();
                            });

                            Button btnNote = view.findViewById(R.id.btn_note);
                            btnNote.setOnClickListener(v -> {
                                NotePopupWindow win = new NotePopupWindow(view.getContext());
                                win.showAsDropDown(view);
                            });

                            Button btnToTextBook = view.findViewById(R.id.btn_to_textbook);
                            btnToTextBook.setOnClickListener(v->{
                                if(mSchema != null && !mSchema.getTextBook().isEmpty()) {
                                    Intent intent = getIntent();
                                    intent.putExtra("AssetsPdf", mSchema.getTextBook());
                                    pdfFitPolicy = FitPolicy.BOTH;
                                    pdfSwipeHorizontal = false;
                                    loadPdf();
                                }
                            });

                            Button btnToPpt = view.findViewById(R.id.btn_to_ppt);
                            btnToPpt.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    if(mSchema != null && !mSchema.getLecture().isEmpty()) {
                                        Intent intent = getIntent();
                                        intent.putExtra("AssetsPdf", mSchema.getLecture());
                                        pdfFitPolicy = FitPolicy.WIDTH;
                                        pdfSwipeHorizontal = false;
                                        loadPdf();
                                    }
                                }
                            });

                            Button btnToGuide= view.findViewById(R.id.btn_to_guide);
                            btnToGuide.setOnClickListener(new View.OnClickListener() {
                                @Override
                                public void onClick(View v) {
                                    if(mSchema != null && !mSchema.getLearnGuide().isEmpty()) {
                                        Intent intent = getIntent();
                                        intent.putExtra("AssetsPdf", mSchema.getLearnGuide());
                                        pdfFitPolicy = FitPolicy.BOTH;
                                        pdfSwipeHorizontal = false;
                                        loadPdf();
                                    }
                                }
                            });
                        }
                    }

                    @Override
                    public void show(@NotNull View view) { }

                    @Override
                    public void hide(@NotNull View view) { }

                    @Override
                    public void dismiss() { }

                    @Override
                    public void touchEvent(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void drag(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void dragEnd(@NotNull View view) { }
                })
                .show();

        initView();//初始化view
        loadPdf();//加载PDF文件
    }

    private URI makeNoteFullFilePath() {
        // 获取应用的私有外部存储目录
        File externalFilesDir = getExternalFilesDir(null);
        if (externalFilesDir == null) {
            Toast.makeText(this, "无法访问外部存储目录", Toast.LENGTH_SHORT).show();
            return null; // 返回 null 表示失败
        }

        // 创建一个子目录（可选）
        File customDirectory = new File(externalFilesDir, "MyNotes");
        if (!customDirectory.exists()) {
            customDirectory.mkdirs(); // 如果目录不存在，创建它
        }

        // 生成 GUID 作为文件名
        String guid = UUID.randomUUID().toString();
        String fileName = guid + ".jpg";

        // 创建文件对象
        File file = new File(customDirectory, fileName);

        // 将文件路径转换为 URI
        return file.toURI();
    }

    private void writeJpgToExternalStorage(byte [] data , URI filePath) {
        File file = new File(filePath);

        try {
            // 创建文件并写入内容
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(data);
            fos.close();
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "写入文件失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void resetPaintToolSelect() {
        btnUseBrush.setBackgroundColor(getColor(R.color.semi_black_transparent));
        btnUseEraser.setBackgroundColor(getColor(R.color.semi_black_transparent));
        btnSelectArea.setBackgroundColor(getColor(R.color.semi_black_transparent));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    /**
     * 初始化view
     */
    private void initView() {
        pdfView = findViewById(R.id.pdfView);
    }

    /**
     * 加载PDF文件
     */
    private void loadPdf() {
        if(pdfView != null) {
            pdfView.recycle();
        }
        Intent intent = getIntent();
        if (intent != null) {
            assetsFileName = intent.getStringExtra("AssetsPdf");
            if (assetsFileName != null) {
                displayFromAssets(assetsFileName);
            } else {
                uri = intent.getData();
                if (uri != null) {
                    displayFromUri(uri);
                }
            }
        }
    }

    /**
     * 基于assets显示 PDF 文件
     *
     * @param fileName 文件名称
     */
    private void displayFromAssets(String fileName) {
        pdfView.fromAsset(fileName)
                .defaultPage(pageNumber)
                .onPageChange(this)
                .enableAnnotationRendering(true)
                .onLoad(this)
                .scrollHandle(new DefaultScrollHandle(this))
                .spacing(20) // 单位 dp
                //.autoSpacing(true)
                .onPageError(this)
                .pageFitPolicy(pdfFitPolicy)
                .swipeHorizontal(pdfSwipeHorizontal)
                .load();
    }

    /**
     * 基于uri显示 PDF 文件
     *
     * @param uri 文件路径
     */
    private void displayFromUri(Uri uri) {
        pdfView.fromUri(uri)
                .defaultPage(pageNumber)
                .onPageChange(this)
                .enableAnnotationRendering(true)
                .onLoad(this)
                .scrollHandle(new DefaultScrollHandle(this))
                .spacing(20) // 单位 dp
                //.autoSpacing(true)
                .pageFitPolicy(pdfFitPolicy)
                .swipeHorizontal(pdfSwipeHorizontal)
                .onPageError(this)
                .load();
    }

    /**
     * 当成功加载PDF：
     * 1、可获取PDF的目录信息
     *
     * @param nbPages the number of pages in this PDF file
     */
    @Override
    public void loadComplete(int nbPages) {
        //获得文档书签信息
        List<PdfDocument.Bookmark> bookmarks = pdfView.getTableOfContents();
        if (catelogues != null) {
            catelogues.clear();
        } else {
            catelogues = new ArrayList<>();
        }
        //将bookmark转为目录数据集合
        bookmarkToCatelogues(catelogues, bookmarks, 1);
    }

    /**
     * 将bookmark转为目录数据集合（递归）
     *
     * @param catelogues 目录数据集合
     * @param bookmarks  书签数据
     * @param level      目录树级别（用于控制树节点位置偏移）
     */
    private void bookmarkToCatelogues(List<TreeNodeData> catelogues, List<PdfDocument.Bookmark> bookmarks, int level) {
        for (PdfDocument.Bookmark bookmark : bookmarks) {
            TreeNodeData nodeData = new TreeNodeData();
            nodeData.setName(bookmark.getTitle());
            nodeData.setPageNum((int) bookmark.getPageIdx());
            nodeData.setTreeLevel(level);
            nodeData.setExpanded(false);
            catelogues.add(nodeData);
            if (bookmark.getChildren() != null && bookmark.getChildren().size() > 0) {
                List<TreeNodeData> treeNodeDatas = new ArrayList<>();
                nodeData.setSubset(treeNodeDatas);
                bookmarkToCatelogues(treeNodeDatas, bookmark.getChildren(), level + 1);
            }
        }
    }

    @Override
    public void onPageChanged(int page, int pageCount) {
        pageNumber = page;
    }

    @Override
    public void onPageError(int page, Throwable t) {
    }

    /**
     * 从缩略图、目录页面带回页码，跳转到指定PDF页面
     *
     * @param requestCode
     * @param resultCode
     * @param data
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode == RESULT_OK) {
            int pageNum = data.getIntExtra("pageNum", 0);
            if (pageNum > 0) {
                pdfView.jumpTo(pageNum);
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        //是否内存
        if (pdfView != null) {
            pdfView.recycle();
        }
    }
}
