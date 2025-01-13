package com.cosinetech.imates.pdfui;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.VideoPlayActivity;
import com.cosinetech.imates.views.ScratchToolsView;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.notes.NotePopupWindow;
import com.cosinetech.imates.pdfui.tree.TreeNodeData;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.VideoPlayView;
import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.listener.OnLoadCompleteListener;
import com.github.barteksc.pdfviewer.listener.OnPageChangeListener;
import com.github.barteksc.pdfviewer.listener.OnPageErrorListener;
import com.github.barteksc.pdfviewer.scroll.DefaultScrollHandle;
import com.github.barteksc.pdfviewer.util.FitPolicy;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.anim.DefaultAnimator;
import com.lzf.easyfloat.enums.ShowPattern;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;
import com.shockwave.pdfium.PdfDocument;
import org.jetbrains.annotations.NotNull;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class PDFActivity extends AppCompatActivity implements
        OnPageChangeListener,
        OnLoadCompleteListener,
        OnPageErrorListener {

    private ScratchToolsView scratchToolsView;

    private Chapter.Schema mSchema;
    private Chapter.Section mSection;
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

    // 视频播放相关
    private static final String mFloatingVideoTag = "FLOATING_VIDEO_PLAYER";
    private static final String mFloatingPdfToolsTag = "FLOATING_PDF_TOOLS";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_pdf);

        mSchema = getIntent().getParcelableExtra("Schema");
        mSection = getIntent().getParcelableExtra("Section");
        scratchToolsView = findViewById(R.id.scratch_tool);
        scratchToolsView.setAskAiContextPrompt(mSection.getTitle());
        scratchToolsView.setOnScratchToolsListener(new ScratchToolsView.OnScratchToolsListener() {
            @Override
            public void onEnterScratchMode() {
            }

            @Override
            public void onExitScratchMode() {
            }

            @Override
            public Bitmap onGetScratchCanvasBitmap() {
                Bitmap bmp = WindowUtils.getScreenshot2Bitmap(PDFActivity.this, pdfView);
                return  bmp;
            }
        });


        initView();//初始化view
        loadPdf();//加载PDF文件

        showFloatingReaderTools();

        pdfView.setOnClickListener(v -> {
            closeFloatPDFTools();
            showFloatingReaderTools();
        });
    }

    private void showFloatingReaderTools() {
        EasyFloat.with(this).setLayout(R.layout.floating_reader_tools)
                .setShowPattern(ShowPattern.CURRENT_ACTIVITY)
                .setSidePattern(SidePattern.AUTO_SIDE)
                .setMatchParent(true, false)
                .setAnimator(new DefaultAnimator())
                .setTag(mFloatingPdfToolsTag)
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

                            Button btnWatchVideo = view.findViewById(R.id.btn_watch_video);
                            btnWatchVideo.setOnClickListener(v-> {
                                String path = getExternalFilesDir(null) + "/videos/1.mp4";
                                startVideoPlayActivityForResult(0, path, mSection.getTitle());
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
                    public void show(@NotNull View view) {
                        Log.d("aaaaaaaaaaaa", "show");
                    }

                    @Override
                    public void hide(@NotNull View view) {
                        Log.d("aaaaaaaaaaaa", "hide");
                    }

                    @Override
                    public void dismiss() {
                        Log.d("aaaaaaaaaaaa", "dismiss");
                    }

                    @Override
                    public void touchEvent(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void drag(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void dragEnd(@NotNull View view) { }
                })
                .show();
    }

    private void closeFloatPDFTools() {
        EasyFloat.dismiss(mFloatingPdfToolsTag);
    }

    private void startVideoPlayActivityForResult(int startPos, String videoPath, String sectionTitle) {
        Intent intent = new Intent(this, VideoPlayActivity.class);
        intent.putExtra(VideoPlayActivity.KEY_VIDEO_START_PLAY_POS_MS, startPos);
        intent.putExtra(VideoPlayActivity.KEY_VIDEO_PATH, videoPath);
        intent.putExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION, sectionTitle);
        startActivityForResult(intent, VideoPlayActivity.CODE_RESULT_VIDEO_PLAY_EXIT);
    }

    private void showFloatingVideoPlay(int startPos, String videoPath, String sectionTitle) {
        EasyFloat.with(this).setLayout(R.layout.floating_video_play)
                .setShowPattern(ShowPattern.FOREGROUND)
                .setSidePattern(SidePattern.DEFAULT)
                .setMatchParent(false, false)
                .setAnimator(new DefaultAnimator())
                .setTag(mFloatingVideoTag)
                .registerCallbacks(new OnFloatCallbacks() {
                    @Override
                    public void createdResult(boolean isCreated, @Nullable String msg, @Nullable View view) {
                        if (isCreated && view != null) {
                            VideoPlayView videoPlayView = view.findViewById(R.id.video_play_view);
                            videoPlayView.setVideoInfo(videoPath, sectionTitle, startPos);

                            Button btnExit = view.findViewById(R.id.btn_exit_video);
                            btnExit.setOnClickListener(v-> {
                                videoPlayView.stopPlay();
                                dismiss();
                            });

                            Button btnFullScreen = view.findViewById(R.id.btn_full_screen);
                            btnFullScreen.setOnClickListener(v-> {
                                int pos = videoPlayView.getCurrentPlayPosition();
                                videoPlayView.stopPlay();
                                startVideoPlayActivityForResult(pos, videoPath, sectionTitle);
                                dismiss();
                            });
                        }
                    }

                    @Override
                    public void show(@NotNull View view) {
                        Log.d("aaaaaaaaaaaa", "show");
                    }

                    @Override
                    public void hide(@NotNull View view) {
                        Log.d("aaaaaaaaaaaa", "hide");
                    }

                    @Override
                    public void dismiss() {
                        Log.d("aaaaaaaaaaaa", "dismiss");
                    }

                    @Override
                    public void touchEvent(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void drag(@NotNull View view, @NotNull MotionEvent event) { }

                    @Override
                    public void dragEnd(@NotNull View view) { }
                })
                .show();
    }

    private void closeFloatingVideoPlay() {
        EasyFloat.dismiss(mFloatingVideoTag);
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
        } else if(resultCode == VideoPlayActivity.CODE_RESULT_VIDEO_PLAY_EXIT) {
            int actionCode = data.getIntExtra(VideoPlayActivity.KEY_RESULT_ACTION_KEY, VideoPlayActivity.EXIT_ACTION_NONE);
            if(actionCode == VideoPlayActivity.EXIT_ACTION_FLOAT) {
                //浮窗模式
                String videoPath = data.getStringExtra(VideoPlayActivity.KEY_VIDEO_PATH);
                String sectionTitle = data.getStringExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION);
                int curPlayPos = data.getIntExtra(VideoPlayActivity.KEY_VIDEO_START_PLAY_POS_MS, 0);
                showFloatingVideoPlay(curPlayPos, videoPath, sectionTitle);
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

        closeFloatPDFTools();
        closeFloatingVideoPlay();
    }
}
