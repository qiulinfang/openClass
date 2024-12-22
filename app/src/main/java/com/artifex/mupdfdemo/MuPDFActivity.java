package com.artifex.mupdfdemo;

import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;
import java.util.concurrent.Executor;

import com.artifex.mupdfdemo.ReaderView.ViewMapper;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.DialogInterface.OnCancelListener;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.text.Editable;
import android.text.TextWatcher;
import android.text.method.PasswordTransformationMethod;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.Menu;
import android.view.MotionEvent;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.TranslateAnimation;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.RelativeLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewAnimator;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.colorpicker.ColorListener;
import com.cosinetech.imates.colorpicker.ColorPickerDialog;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.notes.NoteManager;
import com.cosinetech.imates.notes.NotePopupWindow;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.widgets.DrawingChangeListener;
import com.cosinetech.imates.widgets.PaintView;
import com.litao.slider.NiftySlider;
import com.lzf.easyfloat.EasyFloat;
import com.lzf.easyfloat.enums.SidePattern;
import com.lzf.easyfloat.interfaces.OnFloatCallbacks;

import org.jetbrains.annotations.NotNull;

class ThreadPerTaskExecutor implements Executor {
    public void execute(Runnable r) {
        new Thread(r).start();
    }
}

public class MuPDFActivity extends Activity implements FilePicker.FilePickerSupport {
    /* The core rendering instance */
    enum TopBarMode {Main, Search, Annot, Delete, More, Accept}

    ;

    enum AcceptMode {Highlight, Underline, StrikeOut, Ink, CopyText}

    ;
    private Chapter.Schema mSchema;
    private Chapter.Section mSection;
    private final int OUTLINE_REQUEST = 0;
    private final int PRINT_REQUEST = 1;
    private final int FILEPICK_REQUEST = 2;
    private MuPDFCore core;
    private String mFileName;
    private MuPDFReaderView mDocView;
    private View mButtonsView;
    private boolean mButtonsVisible;
    private EditText mPasswordView;
    //private TextView     mFilenameView;
    private SeekBar mPageSlider;
    private int mPageSliderRes;
    private TextView mPageNumberView;
    private TextView mInfoView;
    private ImageButton mSearchButton;
    private ImageButton mReflowButton;
    private ImageButton mOutlineButton;
    private ImageButton mMoreButton;
    private TextView mAnnotTypeText;
    private ImageButton mAnnotButton;
    private ViewAnimator mTopBarSwitcher;
    private ImageButton mLinkButton;
    private TopBarMode mTopBarMode = TopBarMode.Main;
    private AcceptMode mAcceptMode;
    private ImageButton mSearchBack;
    private ImageButton mSearchFwd;
    private EditText mSearchText;
    private SearchTask mSearchTask;
    private AlertDialog.Builder mAlertBuilder;
    private boolean mLinkHighlight = false;
    private final Handler mHandler = new Handler();
    private boolean mAlertsActive = false;
    private boolean mReflow = false;
    private AsyncTask<Void, Void, MuPDFAlert> mAlertTask;
    private AlertDialog mAlertDialog;
    private FilePicker mFilePicker;

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

                return core.waitForAlert();
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
                            core.replyToAlert(result);
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
                mAlertDialog.setOnCancelListener(new OnCancelListener() {
                    public void onCancel(DialogInterface dialog) {
                        mAlertDialog = null;
                        if (mAlertsActive) {
                            result.buttonPressed = MuPDFAlert.ButtonPressed.None;
                            core.replyToAlert(result);
                            createAlertWaiter();
                        }
                    }
                });

                mAlertDialog.show();
            }
        };

        mAlertTask.executeOnExecutor(new ThreadPerTaskExecutor());
    }

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

    private MuPDFCore openFile(String path) {
        int lastSlashPos = path.lastIndexOf('/');
        mFileName = new String(lastSlashPos == -1
                ? path
                : path.substring(lastSlashPos + 1));
        System.out.println("Trying to open " + path);
        try {
            core = new MuPDFCore(this, path);
            // New file: drop the old outline data
            OutlineActivityData.set(null);
        } catch (Exception e) {
            System.out.println(e);
            return null;
        }
        return core;
    }

    private MuPDFCore openBuffer(byte buffer[], String magic) {
        System.out.println("Trying to open byte buffer");
        try {
            core = new MuPDFCore(this, buffer, magic);
            // New file: drop the old outline data
            OutlineActivityData.set(null);
        } catch (Exception e) {
            System.out.println(e);
            return null;
        }
        return core;
    }

    /**
     * Called when the activity is first created.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        mSchema = getIntent().getParcelableExtra("Schema");
        mSection = getIntent().getParcelableExtra("Section");
        mAlertBuilder = new AlertDialog.Builder(this);
        makeButtonsView();

        Intent intent = getIntent();
        Uri uri = intent.getData();
        preparePdfCore(uri.getEncodedPath());

        createUI();
    }

    private void preparePdfCore(String path) {
        if (core != null) {
            releaseResource();
            core = null;
        }
        if (core == null) {
            core = (MuPDFCore) getLastNonConfigurationInstance();
        }

        if (core == null) {
            core = openFile(path);
            SearchTaskResult.set(null);
            if (core != null && core.needsPassword()) {
                requestPassword();
                return;
            }
            if (core != null && core.countPages() == 0) {
                core = null;
            }
        }
        if (core == null) {
            AlertDialog alert = mAlertBuilder.create();
            alert.setTitle(R.string.cannot_open_document);
            alert.setButton(AlertDialog.BUTTON_POSITIVE, getString(R.string.dismiss),
                    new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface dialog, int which) {
                            finish();
                        }
                    });
            alert.setOnCancelListener(new OnCancelListener() {

                @Override
                public void onCancel(DialogInterface dialog) {
                    finish();
                }
            });
            alert.show();
        }
    }

    public void requestPassword() {
        mPasswordView = new EditText(this);
        mPasswordView.setInputType(EditorInfo.TYPE_TEXT_VARIATION_PASSWORD);
        mPasswordView.setTransformationMethod(new PasswordTransformationMethod());

        AlertDialog alert = mAlertBuilder.create();
        alert.setTitle(R.string.enter_password);
        alert.setView(mPasswordView);
        alert.setButton(AlertDialog.BUTTON_POSITIVE, getString(R.string.okay),
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        if (core.authenticatePassword(mPasswordView.getText().toString())) {
                            createUI();
                        } else {
                            requestPassword();
                        }
                    }
                });
        alert.setButton(AlertDialog.BUTTON_NEGATIVE, getString(R.string.cancel),
                new DialogInterface.OnClickListener() {

                    public void onClick(DialogInterface dialog, int which) {
                        finish();
                    }
                });
        alert.show();
    }

    public void createUI() {
        if (core == null)
            return;

        // Stick the document view and the buttons overlay into a parent view
        LayoutInflater inflater = getLayoutInflater();
        View rootView = inflater.inflate(R.layout.activity_mupdf, null);
        RelativeLayout layout = rootView.findViewById(R.id.pdfView);
        if (mDocView != null) {
            layout.removeView(mDocView);
            mDocView = null;
        }

        // Now create the UI.
        // First create the document view
        mDocView = new MuPDFReaderView(this) {
            @Override
            protected void onMoveToChild(int i) {
                if (core == null)
                    return;
                mPageNumberView.setText(String.format("%d / %d", i + 1,
                        core.countPages()));
                mPageSlider.setMax((core.countPages() - 1) * mPageSliderRes);
                mPageSlider.setProgress(i * mPageSliderRes);
                super.onMoveToChild(i);
            }

            @Override
            protected void onTapMainDocArea() {
                if (!mButtonsVisible) {
                    showButtons();
                } else {
                    if (mTopBarMode == TopBarMode.Main)
                        hideButtons();
                }
            }

            @Override
            protected void onDocMotion() {
                hideButtons();
            }

            @Override
            protected void onHit(Hit item) {
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
                        MuPDFView pageView = (MuPDFView) mDocView.getDisplayedView();
                        if (pageView != null)
                            pageView.deselectAnnotation();
                        break;
                }
            }
        };
        mDocView.setLongClickable(true);
        mDocView.setAdapter(new MuPDFPageAdapter(this, this, core));
        mDocView.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                OnCopyTextButtonClick(v);
                return true;
            }
        });

        mSearchTask = new SearchTask(this, core) {
            @Override
            protected void onTextFound(SearchTaskResult result) {
                SearchTaskResult.set(result);
                // Ask the ReaderView to move to the resulting page
                mDocView.setDisplayedViewIndex(result.pageNumber);
                // Make the ReaderView act on the change to SearchTaskResult
                // via overridden onChildSetup method.
                mDocView.resetupChildren();
            }
        };

        // Set up the page slider
        int smax = Math.max(core.countPages() - 1, 1);
        mPageSliderRes = ((10 + smax - 1) / smax) * 2;

        // Set the file-name text
        //mFilenameView.setText(mFileName);

        // Activate the seekbar
        mPageSlider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onStopTrackingTouch(SeekBar seekBar) {
                mDocView.setDisplayedViewIndex((seekBar.getProgress() + mPageSliderRes / 2) / mPageSliderRes);
            }

            public void onStartTrackingTouch(SeekBar seekBar) {
            }

            public void onProgressChanged(SeekBar seekBar, int progress,
                                          boolean fromUser) {
                updatePageNumView((progress + mPageSliderRes / 2) / mPageSliderRes);
            }
        });

        // Activate the search-preparing button
        mSearchButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                searchModeOn();
            }
        });

        // Activate the reflow button
        mReflowButton.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                toggleReflow();
            }
        });

        if (core.fileFormat().startsWith("PDF") && core.isUnencryptedPDF() && !core.wasOpenedFromBuffer()) {
            mAnnotButton.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    mTopBarMode = TopBarMode.Annot;
                    mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
                }
            });
        } else {
            mAnnotButton.setVisibility(View.GONE);
        }

        // Search invoking buttons are disabled while there is no text specified
        mSearchBack.setEnabled(false);
        mSearchFwd.setEnabled(false);
        mSearchBack.setColorFilter(Color.argb(255, 128, 128, 128));
        mSearchFwd.setColorFilter(Color.argb(255, 128, 128, 128));

        // React to interaction with the text widget
        mSearchText.addTextChangedListener(new TextWatcher() {

            public void afterTextChanged(Editable s) {
                boolean haveText = s.toString().length() > 0;
                setButtonEnabled(mSearchBack, haveText);
                setButtonEnabled(mSearchFwd, haveText);

                // Remove any previous search results
                if (SearchTaskResult.get() != null && !mSearchText.getText().toString().equals(SearchTaskResult.get().txt)) {
                    SearchTaskResult.set(null);
                    mDocView.resetupChildren();
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
        mSearchText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_DONE)
                    search(1);
                return false;
            }
        });

        mSearchText.setOnKeyListener(new View.OnKeyListener() {
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

        if (core.hasOutline()) {
            mOutlineButton.setOnClickListener(new View.OnClickListener() {
                public void onClick(View v) {
                    OutlineItem outline[] = core.getOutline();
                    if (outline != null) {
                        OutlineActivityData.get().items = outline;
                        Intent intent = new Intent(MuPDFActivity.this, OutlineActivity.class);
                        startActivityForResult(intent, OUTLINE_REQUEST);
                    }
                }
            });
        } else {
            mOutlineButton.setVisibility(View.GONE);
        }

        // Reenstate last state if it was recorded
        SharedPreferences prefs = getPreferences(Context.MODE_PRIVATE);
        mDocView.setDisplayedViewIndex(prefs.getInt("page" + mFileName, 0));
//
//		if (savedInstanceState == null || !savedInstanceState.getBoolean("ButtonsHidden", false))
//			showButtons();
//
//		if(savedInstanceState != null && savedInstanceState.getBoolean("SearchMode", false))
//			searchModeOn();
//
//		if(savedInstanceState != null && savedInstanceState.getBoolean("ReflowMode", false))
//			reflowModeSet(true);

        makeButtonsView();
        layout.addView(mDocView);
        layout.addView(mButtonsView);
        setContentView(rootView);
        initFloatingTool(rootView);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        switch (requestCode) {
            case OUTLINE_REQUEST:
                if (resultCode >= 0)
                    mDocView.setDisplayedViewIndex(resultCode);
                break;
            case PRINT_REQUEST:
                if (resultCode == RESULT_CANCELED)
                    showInfo(getString(R.string.print_failed));
                break;
            case FILEPICK_REQUEST:
                if (mFilePicker != null && resultCode == RESULT_OK)
                    mFilePicker.onPick(data.getData());
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    public Object onRetainNonConfigurationInstance() {
        MuPDFCore mycore = core;
        core = null;
        return mycore;
    }

    private void reflowModeSet(boolean reflow) {
        mReflow = reflow;
        mDocView.setAdapter(mReflow ? new MuPDFReflowAdapter(this, core) : new MuPDFPageAdapter(this, this, core));
        mReflowButton.setColorFilter(mReflow ? Color.argb(0xFF, 172, 114, 37) : Color.argb(0xFF, 255, 255, 255));
        setButtonEnabled(mAnnotButton, !reflow);
        setButtonEnabled(mSearchButton, !reflow);
        if (reflow) setLinkHighlight(false);
        setButtonEnabled(mLinkButton, !reflow);
        setButtonEnabled(mMoreButton, !reflow);
        mDocView.refresh(mReflow);
    }

    private void toggleReflow() {
        reflowModeSet(!mReflow);
        showInfo(mReflow ? getString(R.string.entering_reflow_mode) : getString(R.string.leaving_reflow_mode));
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);

        if (mFileName != null && mDocView != null) {
            outState.putString("FileName", mFileName);

            // Store current page in the prefs against the file name,
            // so that we can pick it up each time the file is loaded
            // Other info is needed only for screen-orientation change,
            // so it can go in the bundle
            SharedPreferences prefs = getPreferences(Context.MODE_PRIVATE);
            SharedPreferences.Editor edit = prefs.edit();
            edit.putInt("page" + mFileName, mDocView.getDisplayedViewIndex());
            edit.commit();
        }

        if (!mButtonsVisible)
            outState.putBoolean("ButtonsHidden", true);

        if (mTopBarMode == TopBarMode.Search)
            outState.putBoolean("SearchMode", true);

        if (mReflow)
            outState.putBoolean("ReflowMode", true);
    }

    @Override
    protected void onPause() {
        super.onPause();

        if (mSearchTask != null)
            mSearchTask.stop();

        if (mFileName != null && mDocView != null) {
            SharedPreferences prefs = getPreferences(Context.MODE_PRIVATE);
            SharedPreferences.Editor edit = prefs.edit();
            edit.putInt("page" + mFileName, mDocView.getDisplayedViewIndex());
            edit.commit();
        }
    }

    public void onDestroy() {
        releaseResource();
        super.onDestroy();
    }

    private void setButtonEnabled(ImageButton button, boolean enabled) {
        button.setEnabled(enabled);
        button.setColorFilter(enabled ? Color.argb(255, 255, 255, 255) : Color.argb(255, 128, 128, 128));
    }

    private void setLinkHighlight(boolean highlight) {
        mLinkHighlight = highlight;
        // LINK_COLOR tint
        mLinkButton.setColorFilter(highlight ? Color.argb(0xFF, 172, 114, 37) : Color.argb(0xFF, 255, 255, 255));
        // Inform pages of the change.
        mDocView.setLinksEnabled(highlight);
    }

    private void showButtons() {
        if (core == null)
            return;
        if (!mButtonsVisible) {
            mButtonsVisible = true;
            // Update page number text and slider
            int index = mDocView.getDisplayedViewIndex();
            updatePageNumView(index);
            mPageSlider.setMax((core.countPages() - 1) * mPageSliderRes);
            mPageSlider.setProgress(index * mPageSliderRes);
            if (mTopBarMode == TopBarMode.Search) {
                mSearchText.requestFocus();
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

    private void searchModeOn() {
        if (mTopBarMode != TopBarMode.Search) {
            mTopBarMode = TopBarMode.Search;
            //Focus on EditTextWidget
            mSearchText.requestFocus();
            showKeyboard();
            mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        }
    }

    private void searchModeOff() {
        if (mTopBarMode == TopBarMode.Search) {
            mTopBarMode = TopBarMode.Main;
            hideKeyboard();
            mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
            SearchTaskResult.set(null);
            // Make the ReaderView act on the change to mSearchTaskResult
            // via overridden onChildSetup method.
            mDocView.resetupChildren();
        }
    }

    private void updatePageNumView(int index) {
        if (core == null)
            return;
        mPageNumberView.setText(String.format("%d / %d", index + 1, core.countPages()));
    }

    private void printDoc() {
        if (!core.fileFormat().startsWith("PDF")) {
            showInfo(getString(R.string.format_currently_not_supported));
            return;
        }

        Intent myIntent = getIntent();
        Uri docUri = myIntent != null ? myIntent.getData() : null;

        if (docUri == null) {
            showInfo(getString(R.string.print_failed));
        }

        if (docUri.getScheme() == null)
            docUri = Uri.parse("file://" + docUri.toString());

        Intent printIntent = new Intent(this, PrintDialogActivity.class);
        printIntent.setDataAndType(docUri, "aplication/pdf");
        printIntent.putExtra("title", mFileName);
        startActivityForResult(printIntent, PRINT_REQUEST);
    }

    private void showInfo(String message) {
        mInfoView.setText(message);

        int currentApiVersion = android.os.Build.VERSION.SDK_INT;
        if (currentApiVersion >= android.os.Build.VERSION_CODES.HONEYCOMB) {
            SafeAnimatorInflater safe = new SafeAnimatorInflater((Activity) this, R.animator.info, (View) mInfoView);
        } else {
            mInfoView.setVisibility(View.VISIBLE);
            mHandler.postDelayed(new Runnable() {
                public void run() {
                    mInfoView.setVisibility(View.INVISIBLE);
                }
            }, 500);
        }
    }

    private void makeButtonsView() {
        mButtonsView = getLayoutInflater().inflate(R.layout.mupdf_buttons, null);
        //mFilenameView = (TextView)mButtonsView.findViewById(R.id.docNameText);
        mPageSlider = (SeekBar) mButtonsView.findViewById(R.id.pageSlider);
        mPageNumberView = (TextView) mButtonsView.findViewById(R.id.pageNumber);
        mInfoView = (TextView) mButtonsView.findViewById(R.id.info);
        mSearchButton = (ImageButton) mButtonsView.findViewById(R.id.searchButton);
        mReflowButton = (ImageButton) mButtonsView.findViewById(R.id.reflowButton);
        mOutlineButton = (ImageButton) mButtonsView.findViewById(R.id.outlineButton);
        mAnnotButton = (ImageButton) mButtonsView.findViewById(R.id.editAnnotButton);
        mAnnotTypeText = (TextView) mButtonsView.findViewById(R.id.annotType);
        mTopBarSwitcher = (ViewAnimator) mButtonsView.findViewById(R.id.switcher);
        mSearchBack = (ImageButton) mButtonsView.findViewById(R.id.searchBack);
        mSearchFwd = (ImageButton) mButtonsView.findViewById(R.id.searchForward);
        mSearchText = (EditText) mButtonsView.findViewById(R.id.searchText);
        mLinkButton = (ImageButton) mButtonsView.findViewById(R.id.linkButton);
        mMoreButton = (ImageButton) mButtonsView.findViewById(R.id.moreButton);
        mTopBarSwitcher.setVisibility(View.INVISIBLE);
        mPageNumberView.setVisibility(View.INVISIBLE);
        mInfoView.setVisibility(View.INVISIBLE);
        mPageSlider.setVisibility(View.INVISIBLE);

        initToolsAction(mButtonsView);
    }

    public void OnMoreButtonClick(View v) {
        mTopBarMode = TopBarMode.More;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void OnCancelMoreButtonClick(View v) {
        mTopBarMode = TopBarMode.Main;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void OnPrintButtonClick(View v) {
        printDoc();
    }

    public void OnCopyTextButtonClick(View v0) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.CopyText;
        mDocView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(getString(R.string.select_text));
        showInfo(getString(R.string.select_text));
    }

    public void OnEditAnnotButtonClick(View v) {
        mTopBarMode = TopBarMode.Annot;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void OnCancelAnnotButtonClick(View v) {
        mTopBarMode = TopBarMode.More;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void OnHighlightButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Highlight;
        mDocView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.highlight);
        showInfo(getString(R.string.select_text));
    }

    public void OnUnderlineButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Underline;
        mDocView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.underline);
        showInfo(getString(R.string.select_text));
    }

    public void OnStrikeOutButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.StrikeOut;
        mDocView.setMode(MuPDFReaderView.Mode.Selecting);
        mAnnotTypeText.setText(R.string.strike_out);
        showInfo(getString(R.string.select_text));
    }

    public void OnInkButtonClick(View v) {
        mTopBarMode = TopBarMode.Accept;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
        mAcceptMode = AcceptMode.Ink;
        mDocView.setMode(MuPDFReaderView.Mode.Drawing);
        mAnnotTypeText.setText(R.string.ink);
        showInfo(getString(R.string.draw_annotation));
    }

    public void OnCancelAcceptButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) mDocView.getDisplayedView();
        if (pageView != null) {
            pageView.deselectText();
            pageView.cancelDraw();
        }
        mDocView.setMode(MuPDFReaderView.Mode.Viewing);
        switch (mAcceptMode) {
            case CopyText:
                mTopBarMode = TopBarMode.More;
                break;
            default:
                mTopBarMode = TopBarMode.Annot;
                break;
        }
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void showSelectTextContextMenu(View v, String selectedText) {
        // 加载自定义布局
        View menuView = LayoutInflater.from(MuPDFActivity.this).inflate(R.layout.pdf_scribble_menu, null);

        // 创建 PopupWindow
        PopupWindow popupMenu = new PopupWindow(menuView,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                true);

        // 设置点击事件
        menuView.findViewById(R.id.menu_chat).setOnClickListener(view -> {
            popupMenu.dismiss();
            askQuestionForText(selectedText);
        });

        menuView.findViewById(R.id.menu_note).setOnClickListener(view -> {
            try {
                NoteManager manager = new NoteManager(getBaseContext());
                StringBuilder htmlContentBuilder = new StringBuilder();
                htmlContentBuilder.append(selectedText);
                manager.addNote(htmlContentBuilder.toString(), "");
                popupMenu.dismiss();
            } catch (Exception ex) {
                Toast.makeText(MuPDFActivity.this, "创建笔记失败", Toast.LENGTH_SHORT).show();
            }
        });

        popupMenu.showAtLocation(v, Gravity.CENTER, 0, 0);

    }

    public void OnAcceptButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) mDocView.getDisplayedView();
        boolean success = false;
        switch (mAcceptMode) {
            case CopyText:
                if (pageView != null) {
                    String text = pageView.getSelection();
                    showSelectTextContextMenu(v, text);
                    //success = pageView.copySelection();
                    mTopBarMode = TopBarMode.Main;
                    //showInfo(success ? getString(R.string.copied_to_clipboard) : getString(R.string.no_text_selected));
                }
                break;

            case Highlight:
                if (pageView != null)
                    success = pageView.markupSelection(Annotation.Type.HIGHLIGHT);
                mTopBarMode = TopBarMode.Annot;
                if (!success)
                    showInfo(getString(R.string.no_text_selected));
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
        mDocView.setMode(MuPDFReaderView.Mode.Viewing);
    }

    public void OnCancelSearchButtonClick(View v) {
        searchModeOff();
    }

    public void OnDeleteButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) mDocView.getDisplayedView();
        if (pageView != null)
            pageView.deleteSelectedAnnotation();
        mTopBarMode = TopBarMode.Annot;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    public void OnCancelDeleteButtonClick(View v) {
        MuPDFView pageView = (MuPDFView) mDocView.getDisplayedView();
        if (pageView != null)
            pageView.deselectAnnotation();
        mTopBarMode = TopBarMode.Annot;
        mTopBarSwitcher.setDisplayedChild(mTopBarMode.ordinal());
    }

    private void showKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null)
            imm.showSoftInput(mSearchText, 0);
    }

    private void hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null)
            imm.hideSoftInputFromWindow(mSearchText.getWindowToken(), 0);
    }

    private void search(int direction) {
        hideKeyboard();
        int displayPage = mDocView.getDisplayedViewIndex();
        SearchTaskResult r = SearchTaskResult.get();
        int searchPage = r != null ? r.pageNumber : -1;
        mSearchTask.go(mSearchText.getText().toString(), direction, displayPage, searchPage);
    }

    @Override
    public boolean onSearchRequested() {
        if (mButtonsVisible && mTopBarMode == TopBarMode.Search) {
            hideButtons();
        } else {
            showButtons();
            searchModeOn();
        }
        return super.onSearchRequested();
    }

    @Override
    public boolean onPrepareOptionsMenu(Menu menu) {
        if (mButtonsVisible && mTopBarMode != TopBarMode.Search) {
            hideButtons();
        } else {
            showButtons();
            searchModeOff();
        }
        return super.onPrepareOptionsMenu(menu);
    }

    @Override
    protected void onStart() {
        if (core != null) {
            core.startAlerts();
            createAlertWaiter();
        }

        super.onStart();
    }

    @Override
    protected void onStop() {
        if (core != null) {
            destroyAlertWaiter();
            core.stopAlerts();
        }

        super.onStop();
    }

    @Override
    public void onBackPressed() {
        if (core != null && core.hasChanges()) {
            DialogInterface.OnClickListener listener = new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int which) {
                    if (which == AlertDialog.BUTTON_POSITIVE)
                        core.save();

                    finish();
                }
            };
            AlertDialog alert = mAlertBuilder.create();
            alert.setTitle("MuPDF");
            alert.setMessage(getString(R.string.document_has_changes_save_them_));
            alert.setButton(AlertDialog.BUTTON_POSITIVE, getString(R.string.yes), listener);
            alert.setButton(AlertDialog.BUTTON_NEGATIVE, getString(R.string.no), listener);
            alert.show();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void performPickFor(FilePicker picker) {
        mFilePicker = picker;
        Intent intent = new Intent(this, ChoosePDFActivity.class);
        intent.setAction(ChoosePDFActivity.PICK_KEY_FILE);
        startActivityForResult(intent, FILEPICK_REQUEST);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    private void initFloatingTool(View view) {
        ImageView btnBrushSize;
        ImageView btnPalatte;
        ImageView btnUseBrush;
        ImageView btnUseEraser;
        ImageView btnUndo;
        ImageView btnRedo;
        ImageView btnSelectArea;
        ImageView btnOk;
        ImageView btnCancel;

        TextView textColorIndicator;
        PaintView paintView;
        View paintToolView;
        int selectionColorId = R.color.assist_blue;
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
                View popupView = LayoutInflater.from(MuPDFActivity.this).inflate(R.layout.pdf_scribble_menu, null);

                // 创建 PopupWindow
                PopupWindow popupWindow = new PopupWindow(popupView,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        true);

                // 设置点击事件
                popupView.findViewById(R.id.menu_chat).setOnClickListener(view -> {
                    Bitmap bmp = paintView.getSelectedBitmap();
                    popupWindow.dismiss();
                    askQuestionForPicture(bmp, (int) x, (int) y);
                });

                popupView.findViewById(R.id.menu_note).setOnClickListener(view -> {
                    Bitmap bmp = paintView.getSelectedBitmap();
                    byte[] data = ImageUtils.compressBitmapToJpg(bmp);
                    try {
                        String fileName = makeNoteFullFilePath();
                        if (!writeJpgToExternalStorage(data, fileName)) {
                            Toast.makeText(MuPDFActivity.this, "保存图片失败", Toast.LENGTH_SHORT).show();
                        } else {
                            NoteManager manager = new NoteManager(getBaseContext());
                            StringBuilder htmlContentBuilder = new StringBuilder();
                            htmlContentBuilder.append("<img src=\"").append(fileName.toString()).append("\"/>");
                            manager.addNote(htmlContentBuilder.toString(), "");
                            popupWindow.dismiss();
                        }
                    } catch (Exception ex) {
                        Toast.makeText(MuPDFActivity.this, "创建笔记失败", Toast.LENGTH_SHORT).show();
                    }
                });

                // 显示 PopupWindow 在指定位置 (例如屏幕中央)
                popupWindow.showAtLocation(paintView, Gravity.NO_GRAVITY, (int) x, (int) y);
            }
        });

        com.litao.slider.NiftySlider slider = findViewById(R.id.niftySlider);
        btnBrushSize.setOnClickListener(v -> {
            if (slider.getVisibility() == View.VISIBLE) {
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

        btnPalatte.setOnClickListener(v -> {
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
                v -> {
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

        btnCancel.setOnClickListener(v -> {
            paintToolView.setVisibility(View.GONE);
            //EasyFloat.show();
        });

//        EasyFloat.with(this).setLayout(R.layout.floating_pdf_tools)
//                .setSidePattern(SidePattern.AUTO_SIDE)
//                .registerCallbacks(new OnFloatCallbacks() {
//                    @Override
//                    public void createdResult(boolean isCreated, @Nullable String msg, @Nullable View view) {
//                        if (isCreated && view != null) {
//                            // 获取浮动窗口中的按钮
//                            initToolsAction(view);
//                        }
//                    }
//
//                    @Override
//                    public void show(@NotNull View view) {
//                    }
//
//                    @Override
//                    public void hide(@NotNull View view) {
//                    }
//
//                    @Override
//                    public void dismiss() {
//                    }
//
//                    @Override
//                    public void touchEvent(@NotNull View view, @NotNull MotionEvent event) {
//                    }
//
//                    @Override
//                    public void drag(@NotNull View view, @NotNull MotionEvent event) {
//                    }
//
//                    @Override
//                    public void dragEnd(@NotNull View view) {
//                    }
//                })
//                .show();
    }

    private void initToolsAction(View view) {
        Button btnClose = view.findViewById(R.id.btn_back);
        btnClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // 点击按钮时退出当前 Activity
                MuPDFActivity.this.finish();
            }
        });

        Button btnContents = view.findViewById(R.id.btn_contents);
        btnContents.setOnClickListener(new View.OnClickListener() {
           @Override
           public void onClick(View v) {
               if(core.hasOutline()) {
                   OutlineItem outline[] = core.getOutline();
                   if (outline != null) {
                       OutlineActivityData.get().items = outline;
                       Intent intent = new Intent(MuPDFActivity.this, OutlineActivity.class);
                       startActivityForResult(intent, OUTLINE_REQUEST);
                   }
               }
           }
       });
        Button btnScratch = view.findViewById(R.id.btn_scratch);
        btnScratch.setOnClickListener(v -> {
            hideButtons();
            Bitmap bmp = WindowUtils.getScreenshot2Bitmap(MuPDFActivity.this, mDocView);
            //EasyFloat.hide();
            PaintView paintView = findViewById(R.id.paint_view);
            paintView.setBitmap(bmp);

            View paintToolView = findViewById(R.id.img_edit_layout);
            paintToolView.setVisibility(View.VISIBLE);
        });

//							// tool bar
//							Button btnFitWidth = view.findViewById(R.id.btn_fit_width);
//							btnFitWidth.setOnClickListener(v->{
//								pdfFitPolicy = FitPolicy.WIDTH;
//								pdfSwipeHorizontal = false;
//								loadPdf();
//							});
//							Button btnFitHeight = view.findViewById(R.id.btn_fit_height);
//							btnFitHeight.setOnClickListener(v->{
//								pdfFitPolicy = FitPolicy.BOTH;
//								pdfSwipeHorizontal = false;
//								loadPdf();
//							});
//							Button btnScrollMode = view.findViewById(R.id.btn_hscroll);
//							btnScrollMode.setOnClickListener(v->{
//								pdfFitPolicy = FitPolicy.HEIGHT;
//								pdfSwipeHorizontal = true;
//								loadPdf();
//							});

        Button btnNote = view.findViewById(R.id.btn_note);
        btnNote.setOnClickListener(v -> {
            NotePopupWindow win = new NotePopupWindow(view.getContext());
            win.showAsDropDown(view);
        });

        Button btnToTextBook = view.findViewById(R.id.btn_to_textbook);
        btnToTextBook.setOnClickListener(v -> {
            if (mSchema != null && !mSchema.getTextBook().isEmpty()) {
                Uri uri = Uri.parse(MuPDFActivity.this.getExternalFilesDir(null) + "/" + mSchema.getTextBook());
                preparePdfCore(uri.getEncodedPath());
                createUI();
            }
        });

        Button btnToPpt = view.findViewById(R.id.btn_to_ppt);
        btnToPpt.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mSchema != null && !mSchema.getLecture().isEmpty()) {
                    Uri uri = Uri.parse(MuPDFActivity.this.getExternalFilesDir(null) + "/" + mSchema.getLecture());
                    preparePdfCore(uri.getEncodedPath());
                    createUI();
                }
            }
        });

        Button btnToGuide = view.findViewById(R.id.btn_to_guide);
        btnToGuide.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (mSchema != null && !mSchema.getLearnGuide().isEmpty()) {
                    Uri uri = Uri.parse(MuPDFActivity.this.getExternalFilesDir(null) + "/" + mSchema.getLearnGuide());
                    preparePdfCore(uri.getEncodedPath());
                    createUI();
                }
            }
        });
    }

    private void releaseResource() {
        if (mDocView != null) {
            mDocView.applyToChildren(new ViewMapper() {
                void applyToView(View view) {
                    ((MuPDFView) view).releaseBitmaps();
                }
            });
        }
        if (core != null)
            core.onDestroy();
        if (mAlertTask != null) {
            mAlertTask.cancel(true);
            mAlertTask = null;
        }
        core = null;
    }

    private void resetPaintToolSelect() {
        ImageView btnUseBrush = findViewById(R.id.imgBrush);
        ImageView btnUseEraser = findViewById(R.id.imgErase);
        ImageView btnSelectArea = findViewById(R.id.imgSelectArea);

        btnUseBrush.setBackgroundColor(getColor(R.color.semi_black_transparent));
        btnUseEraser.setBackgroundColor(getColor(R.color.semi_black_transparent));
        btnSelectArea.setBackgroundColor(getColor(R.color.semi_black_transparent));
    }

    private void askQuestionForText(String text) {
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        AiChatMessageRequest chatRequest = new AiChatMessageRequest("",
                "",
                "",
                "",
                "",
                "",
                "start",
                "");
        try {
            chatRequest.setQuestion("");
            chatRequest.setCoversation("解释一下:" + text.trim().replace("\n", ""));
            chatRequest.setAnswer(mSection.getTitle()); //当前章节
            app.chatRequest = chatRequest;

            app.getFloatingWindowService().popupChatBot(ApiUrl.URL_CHAT_GENERAL, Subject.SUBJECT_ALL.name());
        } catch (Exception e) {
            Toast.makeText(MuPDFActivity.this, "请输入要问的问题", Toast.LENGTH_SHORT).show();
        }
    }

    private void askQuestionForPicture(Bitmap bmp, int x, int y) {
// 加载自定义布局
        View popupView = LayoutInflater.from(MuPDFActivity.this).inflate(R.layout.pdf_ask_ai, null);
        ImageView imageView = popupView.findViewById(R.id.ask_picture_src);
        EditText editText = popupView.findViewById(R.id.ask_content);
        // 创建 PopupWindow
        PopupWindow popupWindow = new PopupWindow(popupView,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                true);

        imageView.setImageBitmap(bmp);

        // 设置点击事件
        popupView.findViewById(R.id.btn_ok).setOnClickListener(view -> {
            if (editText.getText().toString().trim().isEmpty()) {
                Toast.makeText(MuPDFActivity.this, "请输入要问的问题", Toast.LENGTH_SHORT).show();
                return;
            }
            popupWindow.dismiss();
            ApplicationModelShared app = (ApplicationModelShared) getApplication();
            AiChatMessageRequest chatRequest = new AiChatMessageRequest("",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "start",
                    "");
            try {
                chatRequest.setQuestion(ImageUtils.bitmapToHtmlJpgBase64(bmp));
                chatRequest.setCoversation(editText.getText().toString());
                chatRequest.setAnswer(mSection.getTitle()); //当前章节
                app.chatRequest = chatRequest;

                app.getFloatingWindowService().popupChatBot(ApiUrl.URL_CHAT_PREVIEW_PICTURE, Subject.SUBJECT_ALL.name());
            } catch (Exception e) {
                Toast.makeText(MuPDFActivity.this, "请输入要问的问题", Toast.LENGTH_SHORT).show();
            }
        });

        popupView.findViewById(R.id.btn_cancel).setOnClickListener(view -> {
            popupWindow.dismiss();
        });

        // 显示 PopupWindow 在指定位置 (例如屏幕中央)
        PaintView paintView = findViewById(R.id.paint_view);
        popupWindow.showAtLocation(paintView, Gravity.NO_GRAVITY, (int) x, (int) y);
    }

    private String makeNoteFullFilePath() {
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

        return file.getAbsolutePath();
    }

    private boolean writeJpgToExternalStorage(byte[] data, String filePath) {
        try {
            File file = new File(filePath);
            // 创建文件并写入内容
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(data);
            fos.close();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "写入文件失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            return false;
        }
    }

}
