package com.cosinetech.imates.pdfui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.R;
import com.cosinetech.imates.pdfui.tree.TreeNodeData;
import com.cosinetech.imates.util.WindowUtils;
import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.listener.OnLoadCompleteListener;
import com.github.barteksc.pdfviewer.listener.OnPageChangeListener;
import com.github.barteksc.pdfviewer.listener.OnPageErrorListener;
import com.github.barteksc.pdfviewer.scroll.DefaultScrollHandle;
import com.github.barteksc.pdfviewer.util.FitPolicy;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.FloatCallbacks;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;
import com.shockwave.pdfium.PdfDocument;

import org.jetbrains.annotations.NotNull;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import kotlin.Unit;
import kotlin.jvm.functions.Function1;

public class PDFActivity extends AppCompatActivity implements
        OnPageChangeListener,
        OnLoadCompleteListener,
        OnPageErrorListener {
    //PDF控件
    PDFView pdfView;
    //按钮控件：返回、目录、缩略图
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

        EasyFloat.with(this).setLayout(R.layout.floating_pdf_tools)
                .setSidePattern(SidePattern.DEFAULT)
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
                .spacing(10) // 单位 dp
                .onPageError(this)
                .pageFitPolicy(FitPolicy.BOTH)
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
                .spacing(10) // 单位 dp
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
