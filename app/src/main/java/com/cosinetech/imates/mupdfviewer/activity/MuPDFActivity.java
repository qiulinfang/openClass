package com.cosinetech.imates.mupdfviewer.activity;

import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.AsyncTask;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.view.animation.Animation;
import android.view.animation.TranslateAnimation;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewAnimator;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.artifex.mupdfdemo.Annotation;
import com.artifex.mupdfdemo.Hit;
import com.artifex.mupdfdemo.MuPDFAlert;
import com.artifex.mupdfdemo.MuPDFCore;
import com.artifex.mupdfdemo.MuPDFPageAdapter;
import com.artifex.mupdfdemo.MuPDFReaderView;
import com.artifex.mupdfdemo.MuPDFReaderViewListener;
import com.artifex.mupdfdemo.MuPDFView;
import com.artifex.mupdfdemo.OutlineActivityData;
import com.artifex.mupdfdemo.OutlineItem;
import com.artifex.mupdfdemo.ReaderView;
import com.artifex.mupdfdemo.SearchTask;
import com.artifex.mupdfdemo.SearchTaskResult;
import com.artifex.mupdfdemo.SharedPreferencesUtil;
import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.VideoPlayActivity;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.notes.NotePopupWindow;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.FloatingResizableVideoView;
import com.cosinetech.imates.views.ScratchToolsView;
import com.cosinetech.imates.views.VideoPlayView;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.anim.DefaultAnimator;
import com.lzf.easyfloat.enums.ShowPattern;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;

import org.jetbrains.annotations.NotNull;

import java.io.File;
import java.util.concurrent.Executor;

public class MuPDFActivity extends AppCompatActivity {
    private static final String TAG = MuPDFActivity.class.getSimpleName();
    private final int OUTLINE_REQUEST = 0;// 目录回调
    private String mFilePath; // 文件路径

    private AlertDialog.Builder mAlertBuilder;// 弹出框

    private MuPDFCore muPDFCore;// 加载mupdf.so文件
    private MuPDFReaderView muPDFReaderView;// 显示pdf的view

    private boolean mAlertsActive = false;
    private AsyncTask<Void, Void, MuPDFAlert> mAlertTask;
    private AlertDialog mAlertDialog;// 初始加载pdf等待弹出框
    // tools
    private ViewAnimator mTopBarSwitcher;// 工具栏动画
    private ImageButton mLinkButton;// 超链接
    private ImageButton mOutlineButton;// 目录
    private ImageButton mSearchButton;// 搜索
    private ImageButton mAnnotButton;// 注释
    // tools 搜索框
    private EditText et_searchText;// 搜索内容输入框
    private ImageButton mSearchBack;// 搜索内容上一个
    private ImageButton mSearchFwd;// 搜索内容下一个
    // tools 注释类型
    private TextView mAnnotTypeText;// 注释类型
    // tools 底部布局
    private TextView mPageNumberView;// 页数
    private SeekBar mPageSlider;// 底部拖动条

    private int mPageSliderRes;// 拖动条的个数
    private boolean mButtonsVisible;// 是否显示工具栏
    private TopBarMode mTopBarMode = TopBarMode.Main;// 工具栏类型
    private AcceptMode mAcceptMode;// 工具栏注释类型

    private SearchTask mSearchTask;// 搜索线程
    private boolean mLinkHighlight = false;// 是否高亮显示

    //
    // 视频播放相关
    private static final String mFloatingVideoTag = "FLOATING_VIDEO_PLAYER";
    private static final String mFloatingReaderToolsTag = "FLOATING_READER_TOOLS";
    private boolean mIsPlayingVideo = false;

    private Chapter.Schema mSchema;
    private Chapter.Section mSection;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        setContentView(R.layout.activity_mupdf);
        mFilePath = getIntent().getData().getPath();
        mSchema = getIntent().getParcelableExtra("Schema");
        mSection = getIntent().getParcelableExtra("Section");
        ScratchToolsView scratchToolsView = findViewById(R.id.scratch_tool);
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
                Bitmap bmp = WindowUtils.getScreenshot2Bitmap(MuPDFActivity.this, muPDFReaderView);
                return  bmp;
            }
        });
        initView();
        showFloatingReaderTools();
    }

    /**
     * 初始化
     */
    private void initView() {
        SharedPreferencesUtil.init(getApplication());

        muPDFReaderView = findViewById(R.id.mu_pdf_mupdfreaderview);

        initToolsView();
        createPDF();
    }

    /**
     * 初始化工具栏
     */
    private void initToolsView() {
        mTopBarSwitcher = findViewById(R.id.switcher);
        mLinkButton = findViewById(R.id.linkButton);
        mAnnotButton = findViewById(R.id.reflowButton);
        mOutlineButton = findViewById(R.id.outlineButton);
        mSearchButton = findViewById(R.id.searchButton);

        et_searchText = findViewById(R.id.searchText);
        mSearchBack = findViewById(R.id.searchBack);
        mSearchFwd = findViewById(R.id.searchForward);

        mAnnotTypeText = findViewById(R.id.annotType);

        mPageNumberView = findViewById(R.id.pageNumber);
        mPageSlider = findViewById(R.id.pageSlider);

        mTopBarSwitcher.setVisibility(View.INVISIBLE);
        mPageNumberView.setVisibility(View.INVISIBLE);
        mPageSlider.setVisibility(View.INVISIBLE);
    }

    private void createPDF() {
        mAlertBuilder = new AlertDialog.Builder(this);

        // 通过MuPDFCore打开pdf文件
        muPDFCore = openFile(mFilePath);
        // 搜索设为空
        SearchTaskResult.set(null);
        // 判断如果core为空，提示不能打开文件
        if (muPDFCore == null) {
            AlertDialog alert = mAlertBuilder.create();
            alert.setTitle(R.string.cannot_open_document);
            alert.setButton(AlertDialog.BUTTON_POSITIVE, getString(R.string.dismiss),
                    (dialog, which) -> finish());
            alert.setOnCancelListener(dialog -> finish());
            alert.show();
            return;
        }
        // 显示
        muPDFReaderView.setAdapter(new MuPDFPageAdapter(this, picker -> {

        }, muPDFCore));
        // Set up the page slider
        int smax = Math.max(muPDFCore.countPages() - 1, 1);
        mPageSliderRes = ((10 + smax - 1) / smax) * 2;

        // 创建搜索任务
        mSearchTask = new SearchTask(this, muPDFCore) {
            @Override
            protected void onTextFound(SearchTaskResult result) {
                SearchTaskResult.set(result);
                // Ask the ReaderView to move to the resulting page
                muPDFReaderView.setDisplayedViewIndex(result.pageNumber);
                // Make the ReaderView act on the change to SearchTaskResult
                // via overridden onChildSetup method.
                muPDFReaderView.resetupChildren();
            }
        };

        // Search invoking buttons are disabled while there is no text specified
        mSearchBack.setEnabled(false);
        mSearchFwd.setEnabled(false);
        mSearchBack.setColorFilter(Color.argb(0xFF, 250, 250, 250));
        mSearchFwd.setColorFilter(Color.argb(0xFF, 250, 250, 250));

        // 判断如果pdf文件有目录
        if (muPDFCore.hasOutline()) {
            // 点击目录按钮跳转到目录页
            mOutlineButton.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    showPdfOutline();
                }
            });
        } else {
            mOutlineButton.setVisibility(View.GONE);
        }

        // 设置监听事件
        setListener();
    }

    private void showPdfOutline() {
        OutlineItem[] outline = muPDFCore.getOutline();
        if (outline != null) {
            OutlineActivityData.get().items = outline;
            Intent intent = new Intent(MuPDFActivity.this, OutlineActivity.class);
            startActivityForResult(intent, OUTLINE_REQUEST);
        }
    }

    /**
     * 打开文件
     *
     * @param path 文件路径
     * @return
     */
    private MuPDFCore openFile(String path) {

        Log.e(TAG, "Trying to open " + path);
        try {
            muPDFCore = new MuPDFCore(this, path);
            // 新建：删除旧的目录数据
            OutlineActivityData.set(null);
        } catch (Exception e) {
            Log.e(TAG, "openFile catch:" + e.toString());
            return null;
        } catch (OutOfMemoryError e) {
            //  out of memory is not an Exception, so we catch it separately.
            Log.e(TAG, "openFile catch: OutOfMemoryError " + e.toString());
            return null;
        }
        return muPDFCore;
    }

    /**
     * 设置监听事件
     */
    private void setListener() {
        // 设置MuPDFReaderView的监听事件
        setMuPDFReaderViewListener();
        // 设置页面拖动条监听事件
        mPageSlider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onStopTrackingTouch(SeekBar seekBar) {
                muPDFReaderView.setDisplayedViewIndex((seekBar.getProgress() + mPageSliderRes / 2) / mPageSliderRes);
            }

            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            public void onProgressChanged(SeekBar seekBar, int progress,
                                          boolean fromUser) {
                updatePageNumView((progress + mPageSliderRes / 2) / mPageSliderRes);
            }
        });
        // 搜索按钮
        mSearchButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                searchModeOn();
            }
        });
        // 注释按钮
        if (muPDFCore.fileFormat().startsWith("PDF") && muPDFCore.isUnencryptedPDF() && !muPDFCore.wasOpenedFromBuffer()) {
            mAnnotButton.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    mTopBarMode = TopBarMode.Annot;
                    mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
                }
            });
        } else {
            mAnnotButton.setVisibility(View.GONE);
        }
        // 搜索的输入框监听事件
        et_searchText.addTextChangedListener(new TextWatcher() {

            public void afterTextChanged(Editable s) {
                boolean haveText = s.toString().length() > 0;
                setButtonEnabled(mSearchBack, haveText);
                setButtonEnabled(mSearchFwd, haveText);

                // Remove any previous search results
                if (SearchTaskResult.get() != null && !et_searchText.getText().toString().equals(SearchTaskResult.get().txt)) {
                    SearchTaskResult.set(null);
                    muPDFReaderView.resetupChildren();
                }
            }

            public void beforeTextChanged(CharSequence s, int start, int count,
                                          int after) {
            }

            public void onTextChanged(CharSequence s, int start, int before,
                                      int count) {
            }
        });

        //React to Done button on keyboard
        et_searchText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_DONE)
                    search(1);
                return false;
            }
        });

        et_searchText.setOnKeyListener(new View.OnKeyListener() {
            public boolean onKey(View v, int keyCode, KeyEvent event) {
                if (event.getAction() == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_ENTER)
                    search(1);
                return false;
            }
        });

        // Activate search invoking buttons
        mSearchBack.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                search(-1);
            }
        });
        mSearchFwd.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                search(1);
            }
        });

        mLinkButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                setLinkHighlight(!mLinkHighlight);
            }
        });
    }

    /**
     * 设置MuPDFReaderView的监听事件
     */
    private void setMuPDFReaderViewListener() {
        muPDFReaderView.setListener(new MuPDFReaderViewListener() {
            @Override
            public void onMoveToChild(int i) {
                if (muPDFCore == null) {
                    return;
                }
                mPageNumberView.setText(String.format("%d / %d", i + 1,
                        muPDFCore.countPages()));
                mPageSlider.setMax((muPDFCore.countPages() - 1) * mPageSliderRes);
                mPageSlider.setProgress(i * mPageSliderRes);
            }

            @Override
            public void onTapMainDocArea() {
                if (!mButtonsVisible) {
                    showButtons();
                } else {
                    if (mTopBarMode == TopBarMode.Main)
                        hideButtons();
                }
            }

            @Override
            public void onDocMotion() {
                hideButtons();
            }

            @Override
            public void onHit(Hit item) {
                switch (mTopBarMode) {
                    case Annot:
                        if (item == Hit.Annotation) {
                            showButtons();
                            mTopBarMode = TopBarMode.Delete;
                            mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
                        }
                        break;
                    case Delete:
                        mTopBarMode = TopBarMode.Annot;
                        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
                        // fall through
                    default:
                        // Not in annotation editing mode, but the pageview will
                        // still select and highlight hit annotations, so
                        // deselect just in case.
                        MuPDFView pageView = (MuPDFView) muPDFReaderView.getDisplayedView();
                        if (pageView != null) {
                            pageView.deselectAnnotation();
                        }
                        break;
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        // 目录回调
        if (requestCode == OUTLINE_REQUEST) {
            if (resultCode >= 0)
                muPDFReaderView.setDisplayedViewIndex(resultCode);
        }

        if(resultCode == VideoPlayActivity.CODE_RESULT_VIDEO_PLAY_EXIT) {
            int actionCode = data.getIntExtra(VideoPlayActivity.KEY_RESULT_ACTION_KEY, VideoPlayActivity.EXIT_ACTION_NONE);
            if(actionCode == VideoPlayActivity.EXIT_ACTION_FLOAT) {
                //浮窗模式
                String videoPath = data.getStringExtra(VideoPlayActivity.KEY_VIDEO_PATH);
                String sectionTitle = data.getStringExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION);
                int curPlayPos = data.getIntExtra(VideoPlayActivity.KEY_VIDEO_START_PLAY_POS_MS, 0);
                showFloatingVideoPlay(curPlayPos, videoPath, sectionTitle);
            } else {
                mIsPlayingVideo = false;
            }
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    /**
     * 显示工具栏
     */
    private void showButtons() {
        if (muPDFCore == null)
            return;
        if (!mButtonsVisible) {
            mButtonsVisible = true;
            // Update page number text and slider
            int index = muPDFReaderView.getDisplayedViewIndex();
            updatePageNumView(index);
            mPageSlider.setMax((muPDFCore.countPages() - 1) * mPageSliderRes);
            mPageSlider.setProgress(index * mPageSliderRes);
            if (mTopBarMode == TopBarMode.Search) {
                et_searchText.requestFocus();
                showKeyboard();
            }

            Animation anim = new TranslateAnimation(0, 0, -mTopBarSwitcher.getHeight(), 0);
            anim.setDuration(200);
            anim.setAnimationListener(new Animation.AnimationListener() {
                public void onAnimationStart(Animation animation) {
                    mTopBarSwitcher.setVisibility(View.VISIBLE);
                }

                public void onAnimationRepeat(Animation animation) {
                }

                public void onAnimationEnd(Animation animation) {
                }
            });
            mTopBarSwitcher.startAnimation(anim);

            anim = new TranslateAnimation(0, 0, mPageSlider.getHeight(), 0);
            anim.setDuration(200);
            anim.setAnimationListener(new Animation.AnimationListener() {
                public void onAnimationStart(Animation animation) {
                    mPageSlider.setVisibility(View.VISIBLE);
                }

                public void onAnimationRepeat(Animation animation) {
                }

                public void onAnimationEnd(Animation animation) {
                    mPageNumberView.setVisibility(View.VISIBLE);
                }
            });
            mPageSlider.startAnimation(anim);
        }
    }

    /**
     * 隐藏工具栏
     */
    private void hideButtons() {
        if (mButtonsVisible) {
            mButtonsVisible = false;
            hideKeyboard();

            Animation anim = new TranslateAnimation(0, 0, 0, -mTopBarSwitcher.getHeight());
            anim.setDuration(200);
            anim.setAnimationListener(new Animation.AnimationListener() {
                public void onAnimationStart(Animation animation) {
                }

                public void onAnimationRepeat(Animation animation) {
                }

                public void onAnimationEnd(Animation animation) {
                    mTopBarSwitcher.setVisibility(View.INVISIBLE);
                }
            });
            mTopBarSwitcher.startAnimation(anim);

            anim = new TranslateAnimation(0, 0, 0, mPageSlider.getHeight());
            anim.setDuration(200);
            anim.setAnimationListener(new Animation.AnimationListener() {
                public void onAnimationStart(Animation animation) {
                    mPageNumberView.setVisibility(View.INVISIBLE);
                }

                public void onAnimationRepeat(Animation animation) {
                }

                public void onAnimationEnd(Animation animation) {
                    mPageSlider.setVisibility(View.INVISIBLE);
                }
            });
            mPageSlider.startAnimation(anim);
        }
    }

    /**
     * 更新当前是第多少页
     *
     * @param index
     */
    private void updatePageNumView(int index) {
        if (muPDFCore == null)
            return;
        mPageNumberView.setText(String.format("%d / %d", index + 1, muPDFCore.countPages()));
    }

    /**
     * 显示键盘
     */
    private void showKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null)
            imm.showSoftInput(et_searchText, 0);
    }

    /**
     * 隐藏键盘
     */
    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null)
            imm.hideSoftInputFromWindow(et_searchText.getWindowToken(), 0);
    }

    /**
     * 工具栏 - 注释点击事件
     *
     * @param v
     */
    public void OnEditAnnotButtonClick(View v) {
        mTopBarMode = TopBarMode.Main;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    /**
     * 工具栏 - 复制点击事件
     *
     * @param v
     */
    public void OnCopyTextButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.CopyText;
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(getString(R.string.copy_text));
        showInfo(getString(R.string.select_text));
    }

    /**
     * 工具栏 - 搜索框取消点击事件
     *
     * @param v
     */
    public void OnCancelSearchButtonClick(View v) {
        searchModeOff();
    }

    /**
     * 工具栏 - 注释取消点击事件
     *
     * @param v
     */
    public void OnCancelMoreButtonClick(View v) {
        mTopBarMode = TopBarMode.Main;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    /**
     * 开始搜索
     */
    private void searchModeOn() {
        if (mTopBarMode != TopBarMode.Search) {
            mTopBarMode = TopBarMode.Search;
            //Focus on EditTextWidget
            et_searchText.requestFocus();
            showKeyboard();
            mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        }
    }

    /**
     * 取消搜索
     */
    private void searchModeOff() {
        if (mTopBarMode == TopBarMode.Search) {
            mTopBarMode = TopBarMode.Main;
            hideKeyboard();
            mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
            SearchTaskResult.set(null);
            // Make the ReaderView act on the change to mSearchTaskResult
            // via overridden onChildSetup method.
            muPDFReaderView.resetupChildren();
        }
    }

    /**
     * 工具栏 - 注释 - 高亮点击事件
     *
     * @param v
     */
    public void OnHighlightButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Highlight;
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.pdf_tools_highlight);
        showInfo(getString(R.string.select_text));
    }

    /**
     * 工具栏 - 注释 - 底部画线点击事件
     *
     * @param v
     */
    public void OnUnderlineButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Underline;
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.pdf_tools_underline);
        showInfo(getString(R.string.select_text));
    }

    /**
     * 工具栏 - 注释 - 废弃线点击事件
     *
     * @param v
     */
    public void OnStrikeOutButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.StrikeOut;
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.pdf_tools_strike_out);
        showInfo(getString(R.string.select_text));
    }

    /**
     * 工具栏 - 注释 - 签字点击事件
     *
     * @param v
     */
    public void OnInkButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Ink;
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Drawing);
        mAnnotTypeText.setText(R.string.pdf_tools_ink);
        showInfo(getString(R.string.pdf_tools_draw_annotation));
    }

    /**
     * 工具栏 - 注释 - 删除注释点击事件
     *
     * @param v
     */
    public void OnDeleteButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) muPDFReaderView.getDisplayedView();
        if (pageView != null)
            pageView.deleteSelectedAnnotation();
        mTopBarMode = TopBarMode.Annot;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    /**
     * 工具栏 - 注释 - 取消删除注释点击事件
     *
     * @param v
     */
    public void OnCancelDeleteButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) muPDFReaderView.getDisplayedView();
        if (pageView != null)
            pageView.deselectAnnotation();
        mTopBarMode = TopBarMode.Annot;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    /**
     * 工具栏 - 注释 - 取消点击事件
     *
     * @param v
     */
    public void OnCancelAcceptButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) muPDFReaderView.getDisplayedView();
        if (pageView != null) {
            pageView.deselectText();
            pageView.cancelDraw();
        }
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Viewing);
        switch (mAcceptMode) {
            case CopyText:
                mTopBarMode = TopBarMode.Main;
                break;
            default:
                mTopBarMode = TopBarMode.Annot;
                break;
        }
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    /**
     * 工具栏 - 注释 - 确定点击事件
     *
     * @param v
     */
    public void OnAcceptButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) muPDFReaderView.getDisplayedView();
        boolean success = false;
        switch (mAcceptMode) {
            case CopyText:
                if (pageView != null)
                    success = pageView.copySelection();
                mTopBarMode = TopBarMode.Main;
                showInfo(success ? getString(R.string.copied_to_clipboard) : getString(R.string.no_text_selected));
                break;
            case Highlight:
                // 高亮
                if (pageView != null) {
                    success = pageView.markupSelection(Annotation.Type.HIGHLIGHT);
                }
                mTopBarMode = TopBarMode.Annot;
                if (!success) {
                    showInfo(getString(R.string.no_text_selected));
                }
                break;
            case Underline:
                if (pageView != null)
                    success = pageView.markupSelection(Annotation.Type.UNDERLINE);
                mTopBarMode = TopBarMode.Annot;
                if (!success)
                    showInfo(getString(R.string.no_text_selected));
                break;

            case StrikeOut:
                if (pageView != null)
                    success = pageView.markupSelection(Annotation.Type.STRIKEOUT);
                mTopBarMode = TopBarMode.Annot;
                if (!success)
                    showInfo(getString(R.string.no_text_selected));
                break;

            case Ink:
                if (pageView != null)
                    success = pageView.saveDraw();
                mTopBarMode = TopBarMode.Annot;
                if (!success)
                    showInfo(getString(R.string.nothing_to_save));
                break;
        }
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        muPDFReaderView.setMode(MuPDFReaderView.Mode.Viewing);
    }

    /**
     * 设置按钮是否可点击
     *
     * @param button
     * @param enabled
     */
    private void setButtonEnabled(ImageButton button, boolean enabled) {
        button.setEnabled(enabled);
        button.setColorFilter(enabled ? Color.argb(0xFF, 250, 250, 250) : Color.argb(0xFF, 250, 250, 250));
    }

    /**
     * 开始搜索
     *
     * @param direction 搜索内容
     */
    private void search(int direction) {
        hideKeyboard();
        int displayPage = muPDFReaderView.getDisplayedViewIndex();
        SearchTaskResult r = SearchTaskResult.get();
        int searchPage = r != null ? r.pageNumber : -1;
        mSearchTask.go(et_searchText.getText().toString(), direction, displayPage, searchPage);
    }

    /**
     * 设置超链接高亮显示
     *
     * @param highlight
     */
    private void setLinkHighlight(boolean highlight) {
        mLinkHighlight = highlight;
        // LINK_COLOR tint
        mLinkButton.setColorFilter(highlight ? Color.argb(0xFF, 255, 160, 0) : Color.argb(0xFF, 255, 255, 255));
        // Inform pages of the change.
        muPDFReaderView.setLinksEnabled(highlight);
    }

    /**
     * 工具栏弹出提示信息
     *
     * @param message 提示内容
     */
    private void showInfo(String message) {

        LayoutInflater inflater = getLayoutInflater();
        View toastLayout = inflater.inflate(R.layout.toast,
                (ViewGroup) findViewById(R.id.toast_root_view));

        TextView header = (TextView) toastLayout.findViewById(R.id.toast_message);
        header.setText(message);

        Toast toast = new Toast(getApplicationContext());
        toast.setGravity(Gravity.FILL_HORIZONTAL | Gravity.BOTTOM, 0, 0);
        toast.setDuration(Toast.LENGTH_LONG);
        toast.setView(toastLayout);
        toast.show();
    }

    /**
     * 创建提示等待
     */
    public void createAlertWaiter() {
        mAlertsActive = true;
        // All mupdf library calls are performed on asynchronous tasks to avoid stalling
        // the UI. Some calls can lead to javascript-invoked requests to display an
        // alert dialog and collect a reply from the user. The task has to be blocked
        // until the user's reply is received. This method creates an asynchronous task,
        // the purpose of which is to wait of these requests and produce the dialog
        // in response, while leaving the core blocked. When the dialog receives the
        // user's response, it is sent to the core via replyToAlert, unblocking it.
        // Another alert-waiting task is then created to pick up the next alert.
        if (mAlertTask != null) {
            mAlertTask.cancel(true);
            mAlertTask = null;
        }
        if (mAlertDialog != null) {
            mAlertDialog.cancel();
            mAlertDialog = null;
        }
        mAlertTask = new AsyncTask<Void, Void, MuPDFAlert>() {

            @Override
            protected MuPDFAlert doInBackground(Void... arg0) {
                if (!mAlertsActive)
                    return null;

                return muPDFCore.waitForAlert();
            }

            @Override
            protected void onPostExecute(final MuPDFAlert result) {
                // core.waitForAlert may return null when shutting down
                if (result == null)
                    return;
                final MuPDFAlert.ButtonPressed pressed[] = new MuPDFAlert.ButtonPressed[3];
                for (int i = 0; i < 3; i++)
                    pressed[i] = MuPDFAlert.ButtonPressed.None;
                DialogInterface.OnClickListener listener = new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        mAlertDialog = null;
                        if (mAlertsActive) {
                            int index = 0;
                            switch (which) {
                                case AlertDialog.BUTTON1:
                                    index = 0;
                                    break;
                                case AlertDialog.BUTTON2:
                                    index = 1;
                                    break;
                                case AlertDialog.BUTTON3:
                                    index = 2;
                                    break;
                            }
                            result.buttonPressed = pressed[index];
                            // Send the user's response to the core, so that it can
                            // continue processing.
                            muPDFCore.replyToAlert(result);
                            // Create another alert-waiter to pick up the next alert.
                            createAlertWaiter();
                        }
                    }
                };
                mAlertDialog = mAlertBuilder.create();
                mAlertDialog.setTitle(result.title);
                mAlertDialog.setMessage(result.message);
                switch (result.iconType) {
                    case Error:
                        break;
                    case Warning:
                        break;
                    case Question:
                        break;
                    case Status:
                        break;
                }
                switch (result.buttonGroupType) {
                    case OkCancel:
                        mAlertDialog.setButton(AlertDialog.BUTTON2, getString(R.string.cancel), listener);
                        pressed[1] = MuPDFAlert.ButtonPressed.Cancel;
                    case Ok:
                        mAlertDialog.setButton(AlertDialog.BUTTON1, getString(R.string.okay), listener);
                        pressed[0] = MuPDFAlert.ButtonPressed.Ok;
                        break;
                    case YesNoCancel:
                        mAlertDialog.setButton(AlertDialog.BUTTON3, getString(R.string.cancel), listener);
                        pressed[2] = MuPDFAlert.ButtonPressed.Cancel;
                    case YesNo:
                        mAlertDialog.setButton(AlertDialog.BUTTON1, getString(R.string.yes), listener);
                        pressed[0] = MuPDFAlert.ButtonPressed.Yes;
                        mAlertDialog.setButton(AlertDialog.BUTTON2, getString(R.string.no), listener);
                        pressed[1] = MuPDFAlert.ButtonPressed.No;
                        break;
                }
                mAlertDialog.setOnCancelListener(new DialogInterface.OnCancelListener() {
                    public void onCancel(DialogInterface dialog) {
                        mAlertDialog = null;
                        if (mAlertsActive) {
                            result.buttonPressed = MuPDFAlert.ButtonPressed.None;
                            muPDFCore.replyToAlert(result);
                            createAlertWaiter();
                        }
                    }
                });

                mAlertDialog.show();
            }
        };

        mAlertTask.executeOnExecutor(new ThreadPerTaskExecutor());
    }

    /**
     * 销毁提示等待
     */
    public void destroyAlertWaiter() {
        mAlertsActive = false;
        if (mAlertDialog != null) {
            mAlertDialog.cancel();
            mAlertDialog = null;
        }
        if (mAlertTask != null) {
            mAlertTask.cancel(true);
            mAlertTask = null;
        }
    }

    @Override
    protected void onStart() {
        if (muPDFCore != null) {
            muPDFCore.startAlerts();
            createAlertWaiter();
        }
        super.onStart();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mSearchTask != null) {
            mSearchTask.stop();
        }
    }

    @Override
    protected void onStop() {
        if (muPDFCore != null) {
            destroyAlertWaiter();
            muPDFCore.stopAlerts();
        }
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (muPDFReaderView != null) {
            muPDFReaderView.applyToChildren(new ReaderView.ViewMapper() {
                public void applyToView(View view) {
                    ((MuPDFView) view).releaseBitmaps();
                }
            });
        }
        if (muPDFCore != null)
            muPDFCore.onDestroy();
        if (mAlertTask != null) {
            mAlertTask.cancel(true);
            mAlertTask = null;
        }
        muPDFCore = null;
        super.onDestroy();

        closeFloatReaderTools();
        closeFloatingVideoPlay();
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        onFinishing();
    }

    private void onFinishing() {
        if (muPDFCore != null && muPDFCore.hasChanges()) {
            DialogInterface.OnClickListener listener = new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int which) {
                    if (which == AlertDialog.BUTTON_POSITIVE) {
                        muPDFCore.save();
                    }
                    finish();
                }
            };
            AlertDialog alert = mAlertBuilder.create();
            alert.setTitle(R.string.dialog_title);
            alert.setMessage(getString(R.string.document_has_changes_save_them));
            alert.setButton(AlertDialog.BUTTON_POSITIVE, getString(R.string.yes), listener);
            alert.setButton(AlertDialog.BUTTON_NEGATIVE, getString(R.string.no), listener);
            alert.show();
        } else {
            finish();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }


    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if(event.getKeyCode() == KeyEvent.KEYCODE_BACK
                || event.getKeyCode() == KeyEvent.KEYCODE_HOME
                || event.getKeyCode() == KeyEvent.KEYCODE_MENU){
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void showFloatingReaderTools() {
        EasyFloat.with(this).setLayout(R.layout.floating_reader_tools)
                .setDragEnable(false)
                .setShowPattern(ShowPattern.CURRENT_ACTIVITY)
                .setSidePattern(SidePattern.AUTO_SIDE)
                .setMatchParent(true, false)
                .setAnimator(new DefaultAnimator())
                .setTag(mFloatingReaderToolsTag)
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
                                    onBackPressed();
                                }
                            });

                            Button btnContent = view.findViewById(R.id.btn_contents);
                            btnContent.setOnClickListener(v -> {
                                //跳转目录页面
                                showPdfOutline();
                            });

                            Button btnThumbnail = view.findViewById(R.id.btn_thumbnail);
                            btnThumbnail.setOnClickListener( v->{
                                //跳转缩略图页面
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
//                                pdfFitPolicy = FitPolicy.WIDTH;
//                                pdfSwipeHorizontal = false;
//                                loadPdf();
                            });
                            Button btnFitHeight = view.findViewById(R.id.btn_fit_height);
                            btnFitHeight.setOnClickListener(v->{
                                muPDFReaderView.setHorizontalScrolling(true);
//                                pdfFitPolicy = FitPolicy.BOTH;
//                                pdfSwipeHorizontal = false;
//                                loadPdf();
                            });
                            Button btnScrollMode = view.findViewById(R.id.btn_hscroll);
                            btnScrollMode.setOnClickListener(v->{
//                                pdfFitPolicy = FitPolicy.HEIGHT;
//                                pdfSwipeHorizontal = true;
//                                loadPdf();
                                muPDFReaderView.setHorizontalScrolling(false);
                            });

                            Button btnNote = view.findViewById(R.id.btn_note);
                            btnNote.setOnClickListener(v -> {
                                NotePopupWindow win = new NotePopupWindow(view.getContext());
                                win.showAsDropDown(view);
                            });

                            Button btnWatchVideo = view.findViewById(R.id.btn_watch_video);
                            btnWatchVideo.setOnClickListener(v-> {
                                String path = getExternalFilesDir(null) + "/videos/1.mp4";
                                if(!mIsPlayingVideo) {
                                    startVideoPlayActivityForResult(0, path, mSection.getTitle());
                                }
                            });

                            Button btnToTextBook = view.findViewById(R.id.btn_to_textbook);
                            btnToTextBook.setOnClickListener(v->{
                                if(mSchema != null && !mSchema.getTextBook().isEmpty()) {
                                    Intent intent = getIntent();
                                    intent.putExtra("AssetsPdf", mSchema.getTextBook());
//                                    pdfFitPolicy = FitPolicy.BOTH;
//                                    pdfSwipeHorizontal = false;
//                                    loadPdf();
                                }
                            });

                            Button btnToPpt = view.findViewById(R.id.btn_to_ppt);
                            btnToPpt.setOnClickListener(v -> {
                                if(mSchema != null && !mSchema.getLecture().isEmpty()) {
                                    Intent intent = getIntent();
                                    intent.putExtra("AssetsPdf", mSchema.getLecture());
//                                    pdfFitPolicy = FitPolicy.WIDTH;
//                                    pdfSwipeHorizontal = false;
//                                    loadPdf();
                                }
                            });

                            Button btnToGuide= view.findViewById(R.id.btn_to_guide);
                            btnToGuide.setOnClickListener(v -> {
                                if(mSchema != null && !mSchema.getLearnGuide().isEmpty()) {
                                    Intent intent = getIntent();
                                    intent.putExtra("AssetsPdf", mSchema.getLearnGuide());
//                                    pdfFitPolicy = FitPolicy.BOTH;
//                                    pdfSwipeHorizontal = false;
//                                    loadPdf();
                                }
                            });
                        }
                    }

                    @Override
                    public void show(@NotNull View view) {
                    }

                    @Override
                    public void hide(@NotNull View view) {
                    }

                    @Override
                    public void dismiss() {
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

    private void closeFloatReaderTools() {
        EasyFloat.dismiss(mFloatingReaderToolsTag);
    }

    private void startVideoPlayActivityForResult(int startPos, String videoPath, String sectionTitle) {
        File file = new File(videoPath);
        if(!file.exists()) {
            Toast.makeText(this, "没有视频文件可观看", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent intent = new Intent(this, VideoPlayActivity.class);
        intent.putExtra(VideoPlayActivity.KEY_VIDEO_START_PLAY_POS_MS, startPos);
        intent.putExtra(VideoPlayActivity.KEY_VIDEO_PATH, videoPath);
        intent.putExtra(VideoPlayActivity.KEY_TEXTBOOK_SECTION, sectionTitle);
        startActivityForResult(intent, VideoPlayActivity.CODE_RESULT_VIDEO_PLAY_EXIT);
    }

    private void showFloatingVideoPlay(int startPos, String videoPath, String sectionTitle) {
        mIsPlayingVideo = true;
        EasyFloat.with(MuPDFActivity.this)
                .setLayout(R.layout.floating_video_container)
                .setDragEnable(true)
                .setShowPattern(ShowPattern.ALL_TIME)
                .setSidePattern(SidePattern.DEFAULT)
                .setMatchParent(false, false)
                .setAnimator(new DefaultAnimator())
                .setTag(mFloatingVideoTag)
                .registerCallbacks(new OnFloatCallbacks() {
                    @Override
                    public void createdResult(boolean isCreated, @Nullable String msg, @Nullable View view) {
                        if (isCreated && view != null) {
                            FloatingResizableVideoView resizableView = view.findViewById(R.id.resizable_float_view);
                            if (resizableView != null) {
                                resizableView.setTag(mFloatingVideoTag);

                                resizableView.getViewTreeObserver().addOnGlobalLayoutListener(new ViewTreeObserver.OnGlobalLayoutListener() {
                                    @Override
                                    public void onGlobalLayout() {
                                        resizableView.getViewTreeObserver().removeOnGlobalLayoutListener(this);

                                        // 现在可以安全地获取坐标并设置监听器
                                        resizableView.setTag(mFloatingVideoTag);
                                        resizableView.setOnResizeListener(new FloatingResizableVideoView.OnResizeListener() {
                                            @Override
                                            public void onResizeBegin() {
                                                EasyFloat.dragEnable(false, mFloatingVideoTag);
                                            }

                                            @Override
                                            public void onResize(int width, int height) {
                                                // 获取浮窗相对于屏幕的X和Y坐标
                                                int[] location = new int[2];
                                                resizableView.getLocationOnScreen(location);
                                                int x = location[0];
                                                int y = location[1];
                                                // 更新浮窗的位置和大小
                                                EasyFloat.updateFloat(mFloatingVideoTag, x, y, width, height);
                                            }

                                            @Override
                                            public void onResizeEnd() {
                                                EasyFloat.dragEnable(true, mFloatingVideoTag);
                                            }
                                        });
                                    }
                                });
                            }

                            VideoPlayView videoPlayView = view.findViewById(R.id.video_play_view);
                            videoPlayView.setVideoInfo(videoPath, sectionTitle, startPos);
                            videoPlayView.hideScratchTools();
                            EasyFloat.updateFloat(mFloatingVideoTag, 0,0, 640, 400);

                            Button btnExit = view.findViewById(R.id.btn_exit_video);
                            btnExit.setOnClickListener(v-> {
                                videoPlayView.stopPlay();
                                closeFloatingVideoPlay();
                            });

                            Button btnFullScreen = view.findViewById(R.id.btn_full_screen);
                            btnFullScreen.setOnClickListener(v-> {
                                int pos = videoPlayView.getCurrentPlayPosition();
                                videoPlayView.stopPlay();
                                startVideoPlayActivityForResult(pos, videoPath, sectionTitle);
                                closeFloatingVideoPlay();
                            });
                        }
                    }

                    @Override
                    public void show(@NotNull View view) {
                    }

                    @Override
                    public void hide(@NotNull View view) {
                    }

                    @Override
                    public void dismiss() {
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
        mIsPlayingVideo = false;
        EasyFloat.dismiss(mFloatingVideoTag);
    }


    /**
     * 多线程类
     */
    static class ThreadPerTaskExecutor implements Executor {
        public void execute(Runnable r) {
            new Thread(r).start();
        }
    }

    /**
     * 工具栏类型 Search:搜索 Annot:注释
     */
    enum TopBarMode {
        Main, Search, Annot, Delete, Accept
    }

    /**
     * 工具栏注释类型 Highlight:高亮显示 ,Underline:底部画线 ,StrikeOut:废弃线 ,Ink:签字 ,CopyText:复制文字
     */
    enum AcceptMode {
        Highlight, Underline, StrikeOut, Ink, CopyText
    }
}
