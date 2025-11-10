package com.cosinetech.imates.ui.activities;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.canhub.cropper.CropImageView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.coreapiservice.ApiGateWayService;
import com.cosinetech.imates.coreapiservice.ApiUrl;
import com.cosinetech.imates.coreapiservice.Question;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.data.models.UserInfoViewModel;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.WindowUtils;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.gson.Gson;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * 空白页面 Activity - 实现拍照搜题功能
 * 使用原生 Android 技术实现 PhotoSearchDialog.vue 的全部功能
 */
public class BlankActivity extends AppCompatActivity {
    private static final String TAG = "BlankActivity";
    private static final int REQUEST_CODE_PERMISSIONS = 10;
    private static final int REQUEST_CODE_PICK_IMAGE = 11;

    // 视图组件
    private PreviewView viewFinder;
    private CropImageView cropImageView;
    private ImageButton btnBack;
    private ImageButton btnGallery;
    private ImageButton btnCapture;
    private ImageButton btnRetake;
    private ImageButton btnSearch;
    private TextView btnSubjectMath;
    private TextView btnSubjectBiology;
    private LinearLayout subjectSelectorPanel;
    private LinearLayout actionButtonsPanel;
    private LinearLayout cropActionsPanel;
    private TextView hintText;
    private CoordinatorLayout drawerContainer;
    private WebView drawerWebView;
    private ProgressBar loadingIndicator;

    // 相机相关
    private ImageCapture imageCapture;
    private ProcessCameraProvider cameraProvider;
    private final Executor executor = Executors.newSingleThreadExecutor();

    // 状态管理
    private String selectedSubject = ""; // "math" 或 "biology"
    private boolean showCameraPreview = true;
    private boolean showCropView = false;
    private boolean showDrawer = false;
    private Question currentQuestion = null;
    private UserInfoViewModel userInfoViewModel;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 设置全屏模式
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        
        setContentView(R.layout.activity_blank);
        
        initViewModels();
        initViews();
        setupClickListeners();
        checkPermissionsAndStartCamera();
    }

    private void initViewModels() {
        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(UserInfoViewModel.class);
    }

    private void initViews() {
        viewFinder = findViewById(R.id.camera_previewer);
        cropImageView = findViewById(R.id.crop_img_view);
        btnBack = findViewById(R.id.btn_back);
        btnGallery = findViewById(R.id.btn_gallery);
        btnCapture = findViewById(R.id.btn_capture);
        btnRetake = findViewById(R.id.btn_retake);
        btnSearch = findViewById(R.id.btn_search);
        btnSubjectMath = findViewById(R.id.btn_subject_math);
        btnSubjectBiology = findViewById(R.id.btn_subject_biology);
        subjectSelectorPanel = findViewById(R.id.subject_selector_panel);
        actionButtonsPanel = findViewById(R.id.action_buttons_panel);
        cropActionsPanel = findViewById(R.id.crop_actions_panel);
        hintText = findViewById(R.id.hint_text);
        drawerContainer = findViewById(R.id.drawer_container);
        drawerWebView = findViewById(R.id.drawer_webview);
        loadingIndicator = findViewById(R.id.loading_indicator);

        // 配置 CropImageView
        cropImageView.setFixedAspectRatio(false);
        cropImageView.setGuidelines(CropImageView.Guidelines.ON);

        // 配置抽屉 WebView
        setupDrawerWebView();
    }

    private void setupDrawerWebView() {
        WebSettings settings = drawerWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportZoom(false);
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        drawerWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // 页面加载完成后，注入题目数据
                if (currentQuestion != null) {
                    injectQuestionData();
                }
            }
        });

        drawerWebView.setWebChromeClient(new WebChromeClient());
    }

    private void injectQuestionData() {
        if (currentQuestion != null && drawerWebView != null) {
            Gson gson = new Gson();
            String questionJson = gson.toJson(currentQuestion);
            String js = String.format(
                "javascript:(function() {" +
                "  if (window.setPhotoSearchQuestionData) {" +
                "    window.setPhotoSearchQuestionData(%s);" +
                "  }" +
                "})();",
                questionJson
            );
            drawerWebView.evaluateJavascript(js, null);
        }
    }

    private void setupClickListeners() {
        // 返回按钮
        btnBack.setOnClickListener(v -> finish());

        // 学科选择
        btnSubjectMath.setOnClickListener(v -> selectSubject("math"));
        btnSubjectBiology.setOnClickListener(v -> selectSubject("biology"));

        // 操作按钮
        btnGallery.setOnClickListener(v -> selectPhotoFromGallery());
        btnCapture.setOnClickListener(v -> takePhoto());
        btnRetake.setOnClickListener(v -> handleRetake());
        btnSearch.setOnClickListener(v -> processCroppedImage());

        // 抽屉背景点击关闭
        drawerContainer.setOnClickListener(v -> {
            if (v.getId() == R.id.drawer_container) {
                closeDrawer();
            }
        });
    }

    private void selectSubject(String subject) {
        selectedSubject = subject;
        updateSubjectSelection();
        updateHintVisibility();
    }

    private void updateSubjectSelection() {
        if (selectedSubject.equals("math")) {
            btnSubjectMath.setBackgroundColor(0xFF7a55ff);
            btnSubjectMath.setTextColor(0xFFFFFFFF);
            btnSubjectBiology.setBackgroundColor(0x00000000);
            btnSubjectBiology.setTextColor(0xFFFFFFFF);
        } else if (selectedSubject.equals("biology")) {
            btnSubjectBiology.setBackgroundColor(0xFF7a55ff);
            btnSubjectBiology.setTextColor(0xFFFFFFFF);
            btnSubjectMath.setBackgroundColor(0x00000000);
            btnSubjectMath.setTextColor(0xFFFFFFFF);
        }
    }

    private void updateHintVisibility() {
        if (selectedSubject.isEmpty() && !showCropView && !showDrawer) {
            hintText.setVisibility(View.VISIBLE);
        } else {
            hintText.setVisibility(View.GONE);
        }
    }

    private void checkPermissionsAndStartCamera() {
        if (checkCameraPermission()) {
            startCamera();
        } else {
            requestCameraPermission();
        }
    }

    private boolean checkCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void requestCameraPermission() {
        requestPermissions(new String[]{Manifest.permission.CAMERA}, REQUEST_CODE_PERMISSIONS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startCamera();
            } else {
                Toast.makeText(this, "需要相机权限才能使用拍照功能", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);
        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                bindPreview(cameraProvider);
            } catch (ExecutionException | InterruptedException e) {
                Toast.makeText(this, "无法开启相机: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    private void stopCamera() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll();
            cameraProvider = null;
        }
    }

    private void bindPreview(@NonNull ProcessCameraProvider cameraProvider) {
        Preview preview = new Preview.Builder().build();
        CameraSelector cameraSelector = new CameraSelector.Builder()
                .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                .build();

        imageCapture = new ImageCapture.Builder().build();
        preview.setSurfaceProvider(viewFinder.getSurfaceProvider());

        cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageCapture);
    }

    private void takePhoto() {
        if (selectedSubject.isEmpty()) {
            Toast.makeText(this, "请先选择学科", Toast.LENGTH_SHORT).show();
            return;
        }

        try {
            File photoFile = File.createTempFile("prefix_", ".jpg", getCacheDir());
            ImageCapture.OutputFileOptions outputOptions = new ImageCapture.OutputFileOptions.Builder(photoFile).build();

            imageCapture.takePicture(outputOptions, executor, new ImageCapture.OnImageSavedCallback() {
                @Override
                public void onImageSaved(@NonNull ImageCapture.OutputFileResults outputFileResults) {
                    runOnUiThread(() -> showCropView(photoFile));
                }

                @Override
                public void onError(@NonNull ImageCaptureException exception) {
                    runOnUiThread(() ->
                            Toast.makeText(BlankActivity.this, "无法拍照: " + exception.getMessage(), Toast.LENGTH_SHORT).show()
                    );
                }
            });
        } catch (Exception e) {
            Toast.makeText(this, "无法拍照: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void selectPhotoFromGallery() {
        if (selectedSubject.isEmpty()) {
            Toast.makeText(this, "请先选择学科", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, REQUEST_CODE_PICK_IMAGE);
    }

    private void showCropView(File photoFile) {
        showCameraPreview = false;
        showCropView = true;

        viewFinder.setVisibility(View.GONE);
        cropImageView.setVisibility(View.VISIBLE);
        actionButtonsPanel.setVisibility(View.GONE);
        cropActionsPanel.setVisibility(View.VISIBLE);
        subjectSelectorPanel.setVisibility(View.GONE);
        hintText.setVisibility(View.GONE);

        cropImageView.setImageUriAsync(Uri.fromFile(photoFile));
    }

    private void handleRetake() {
        showCameraPreview = true;
        showCropView = false;
        showDrawer = false;

        viewFinder.setVisibility(View.VISIBLE);
        cropImageView.setVisibility(View.GONE);
        actionButtonsPanel.setVisibility(View.VISIBLE);
        cropActionsPanel.setVisibility(View.GONE);
        subjectSelectorPanel.setVisibility(View.VISIBLE);
        drawerContainer.setVisibility(View.GONE);

        updateHintVisibility();
        currentQuestion = null;
        stopCamera();
        startCamera();
    }

    private void processCroppedImage() {
        // 检查是否选择了学科
        if (selectedSubject == null || selectedSubject.isEmpty()) {
            Toast.makeText(this, "请先选择学科", Toast.LENGTH_SHORT).show();
            return;
        }

        // 检查是否有裁剪后的图片
        if (cropImageView.getCroppedImage() == null) {
            Toast.makeText(this, "请先选择图片区域", Toast.LENGTH_SHORT).show();
            return;
        }

        Bitmap croppedBitmap = cropImageView.getCroppedImage();
        if (croppedBitmap == null) {
            Toast.makeText(this, "图片裁剪失败", Toast.LENGTH_SHORT).show();
            return;
        }

        // 检查 token 是否有效
        String token = userInfoViewModel.token.getValue();
        if (token == null || token.isEmpty()) {
            Toast.makeText(this, "用户未登录，请先登录", Toast.LENGTH_SHORT).show();
            return;
        }

        // 检查图片是否有效
        if (croppedBitmap.getWidth() <= 0 || croppedBitmap.getHeight() <= 0) {
            Toast.makeText(this, "图片无效，请重新选择", Toast.LENGTH_SHORT).show();
            return;
        }

        loadingIndicator.setVisibility(View.VISIBLE);
        btnSearch.setEnabled(false);

        // 根据学科选择 API URL
        String url;
        if (selectedSubject.equals("biology")) {
            url = ApiUrl.URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY;
        } else {
            url = ApiUrl.URL_QUESTION_IMAGE_RECOGNISE_MATH;
        }

        Log.d(TAG, "开始识别图片 - 学科: " + selectedSubject + ", URL: " + url + ", 图片尺寸: " + croppedBitmap.getWidth() + "x" + croppedBitmap.getHeight());

        ApiGateWayService.recognizeImage(url, croppedBitmap, token,
                new ApiGateWayService.ExerciseRecognitionCallback() {
                    @Override
                    public void onSuccess(Question q) {
                        runOnUiThread(() -> {
                            loadingIndicator.setVisibility(View.GONE);
                            btnSearch.setEnabled(true);
                            if (q != null && q.getQuestion() != null && !q.getQuestion().isEmpty()) {
                                currentQuestion = q;
                                showResultView(q.getQuestion());
                                Log.d(TAG, "图片识别成功 - 题目ID: " + (q.bmNo != null ? q.bmNo : "未知"));
                            } else {
                                Log.w(TAG, "图片识别返回空题目");
                                Toast.makeText(BlankActivity.this, "未识别到题目，请尝试重新拍照或使用文本搜索", Toast.LENGTH_LONG).show();
                            }
                        });
                    }

                    @Override
                    public void onFailure(String msg, int code) {
                        runOnUiThread(() -> {
                            loadingIndicator.setVisibility(View.GONE);
                            btnSearch.setEnabled(true);
                            Log.e(TAG, "图片识别失败 - 错误码: " + code + ", 错误信息: " + msg);
                            String errorMsg = "未识别到题目";
                            if (msg != null && !msg.isEmpty()) {
                                errorMsg += ": " + msg;
                            }
                            Toast.makeText(BlankActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                        });
                    }
                });
    }

    private void showResultView(String questionString) {
        showCropView = false;
        showDrawer = true;

        cropImageView.setVisibility(View.GONE);
        drawerContainer.setVisibility(View.VISIBLE);

        // 加载抽屉 WebView
        loadDrawerInterface();
    }

    private void loadDrawerInterface() {
        // 加载抽屉页面 - 使用 WebView 加载 Vue 应用的抽屉页面
        String drawerUrl = "file:///android_asset/webapp/index.html#/app/photo-search-drawer?subject=" + selectedSubject;
        if (currentQuestion != null) {
            drawerUrl += "&questionId=" + currentQuestion.bmNo;
        }
        drawerWebView.loadUrl(drawerUrl);
    }

    private void closeDrawer() {
        showDrawer = false;
        drawerContainer.setVisibility(View.GONE);
        handleRetake();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_PICK_IMAGE) {
            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();
                if (uri != null) {
                    try {
                        File photoFile = File.createTempFile("prefix_", ".jpg", getCacheDir());
                        String filePath = photoFile.getAbsolutePath();
                        boolean success = AppUtils.copyImageToExternalFilesDir(this, uri, filePath);
                        if (success) {
                            showCropView(photoFile);
                        } else {
                            Toast.makeText(this, "加载照片失败", Toast.LENGTH_SHORT).show();
                        }
                    } catch (IOException e) {
                        Toast.makeText(this, "读取照片失败", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        WindowUtils.hideSystemUI(this);
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if (app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().hideRobot();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if (app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
    }

    @Override
    protected void onDestroy() {
        stopCamera();
        if (drawerWebView != null) {
            drawerWebView.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }
}
