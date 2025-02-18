package com.cosinetech.imates.activities;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.canhub.cropper.CropImageView;
import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.models.AddQuestionRequest;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.WindowUtils;
import com.cosinetech.imates.views.MarkdownTextView;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.Question;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class PhotoQuestionLookupActivity extends AppCompatActivity {
    private PreviewView viewFinder;
    private ImageCapture imageCapture;
    private CropImageView cropImageView;
    private ImageView ivPreview;
    private Button btnCapture;
    private Button btnSearch;
    private Button btnAddToList;
    private Button btnExit;
    private Button btnShotAgain;
    private View scanLine;
    private View splitLine;
    private final Executor executor = Executors.newSingleThreadExecutor();
    private ProcessCameraProvider cameraProvider;
    private MarkdownTextView questionView;
    private UserInfoViewModel userInfoViewModel;
    private Subject subject;
    private Question question;

    private List<Question> mQuestions = new ArrayList<>();

    public final static String KEY_PARAM_SUBJECT = "SUBJECT";
    private static final int REQUEST_CODE_PERMISSIONS = 10;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);
        setContentView(R.layout.activity_photo_question_lookup);
        subject = Subject.valueOf(getIntent().getStringExtra(KEY_PARAM_SUBJECT));
        initView();
    }

    private void initView() {
        ViewModelStoreOwner owner = (ViewModelStoreOwner) getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(getApplication())
        ).get(com.cosinetech.imates.models.UserInfoViewModel.class);

        viewFinder = findViewById(R.id.camera_previewer);
        cropImageView = findViewById(R.id.crop_img_view);
        ivPreview = findViewById(R.id.img_previewer);
        btnCapture = findViewById(R.id.btn_capture);
        btnSearch = findViewById(R.id.btn_search);
        btnAddToList = findViewById(R.id.btn_add_question);
        btnExit = findViewById(R.id.btn_exit);
        btnShotAgain = findViewById(R.id.btn_reshoot);
        scanLine = findViewById(R.id.scan_line);
        questionView = findViewById(R.id.question_view);
        splitLine = findViewById(R.id.split_line);

        if (allPermissionsGranted()) {
            startCamera();
        } else {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQUEST_CODE_PERMISSIONS);
        }

        btnCapture.setOnClickListener(v -> {
            takePhoto();
        });
        btnSearch.setOnClickListener(v -> processCroppedImage());

        btnExit.setOnClickListener(v -> {
            stopCamera();
            finish();
        });

        btnAddToList.setOnClickListener(v -> {
            addExerciseToList();
            stopCamera();
            Intent intent = new Intent(this, QuestionSolveActivity.class);
            intent.putExtra(QuestionSolveActivity.KEY_CHATBOT_URL, subject == Subject.SUBJECT_BIOLOGY ? ApiUrl.URL_CHAT_BIOLOGY : ApiUrl.URL_CHAT_MATH);
            intent.putExtra(QuestionSolveActivity.KEY_SUBJECT, subject.name());
            startActivity(intent);
        });

        btnShotAgain.setOnClickListener( v-> {
            viewFinder.setVisibility(View.VISIBLE);
            btnCapture.setVisibility(View.VISIBLE);
            btnSearch.setVisibility(View.GONE);
            btnShotAgain.setVisibility(View.GONE);
            cropImageView.setVisibility(View.GONE);
            ivPreview.setVisibility(View.GONE);
            questionView.setContent("");
            btnAddToList.setVisibility(View.INVISIBLE);
            splitLine.setVisibility(View.GONE);
            stopCamera();
            startCamera();
        });

        fetchQuestionList();
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putString(KEY_PARAM_SUBJECT, subject.name());
    }

    @Override
    protected void onRestoreInstanceState(Bundle savedState) {
        subject = Subject.valueOf(savedState.getString(KEY_PARAM_SUBJECT));
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(this);
        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                bindPreview(cameraProvider);
            } catch (ExecutionException | InterruptedException e) {
                Toast.makeText(this, "Error starting camera: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }, ContextCompat.getMainExecutor(this));
    }

    public void stopCamera() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll(); // 解绑所有用例，停止相机预览
            cameraProvider = null;
        }
    }
    private void addExerciseToList() {
        if(question == null) {
            return;
        }
        Question q = question;
        AddQuestionRequest item = new AddQuestionRequest();

        item.setTitle(q.title);
        item.setImgName(q.titleImg);
        item.setImgTitleUrl(q.titleImg);

        final List<String> optImgs = q.optionsImg.isEmpty() ? q.imgUrl : q.optionsImg;
        StringBuilder optionImgs = new StringBuilder();

        for(int i = 0; i< optImgs.size(); i++) {
            if(i == 0) {
                optionImgs.append("[");
            }

            optionImgs.append("\"").append(optImgs.get(i)).append("\"");
            if(i != optImgs.size() - 1) {
                optionImgs.append(",");
            } else {
                optionImgs.append("]");
            }
        }

        item.setImgUrl(optionImgs.toString());

        StringBuilder opts = new StringBuilder();
        for(int i = 0; i < q.options.size(); i++) {
            if(i == 0) {
                opts.append("[");
            }

            opts.append("\"").append(q.options.get(i)).append("\"");
            if(i != q.options.size() - 1) {
                opts.append(",");
            } else {
                opts.append("]");
            }
        }
        item.setOptions(opts.toString());
        item.setAnswer(q.answer);
        item.setExplanation(q.explanation);

        StringBuilder ids = new StringBuilder();
        for (Question qq:mQuestions) {
            ids.append(qq.bmNo).append(",");
        }
        item.setExercisesId(ids.toString());
        item.setBmNo(q.bmNo);

        if(subject == Subject.SUBJECT_BIOLOGY) {
            item.setType("biology");
        } else if(subject == Subject.SUBJECT_MATH) {
            item.setType("math");
        }
        ApiGateWayService.addExerciseToList(item, ApiUrl.URL_ADD_EXERCISE_TO_LIST, userInfoViewModel.token.getValue());
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
                            Toast.makeText(PhotoQuestionLookupActivity.this, "Error taking photo: " + exception.getMessage(), Toast.LENGTH_SHORT).show()
                    );
                }
            });
        } catch (Exception e) {
            Toast.makeText(this, "Error taking photo: " +e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void showCropView(File photoFile) {
        viewFinder.setVisibility(View.GONE);
        cropImageView.setVisibility(View.VISIBLE);
        btnCapture.setVisibility(View.GONE);
        btnSearch.setVisibility(View.VISIBLE);
        btnShotAgain.setVisibility(View.VISIBLE);

        cropImageView.setImageUriAsync(Uri.fromFile(photoFile));
        cropImageView.setFixedAspectRatio(false); // 取消固定纵横比
        cropImageView.setGuidelines(CropImageView.Guidelines.ON);
    }

    private void fetchQuestionList() {
        String url;
        if(subject == Subject.SUBJECT_BIOLOGY) {
            url = ApiUrl.URL_GET_EXERCISE_BIOLOGY;
        } else if (subject == Subject.SUBJECT_MATH) {
            url = ApiUrl.URL_GET_EXERCISE_MATH;
        } else {
            url = "";
        }
        if(!url.isEmpty()) {
            ApiGateWayService.queryExerciseList(url, userInfoViewModel.token.getValue(), new ApiGateWayService.QueryExerciseListCallback() {
                @Override
                public void onSuccess(List<Question> q) {
                    runOnUiThread(() -> {
                        mQuestions.clear();
                        mQuestions.addAll(q);
                    });
                }

                @Override
                public void onFailure(String msg, int code) {
                    runOnUiThread(() -> {
                        Toast.makeText(PhotoQuestionLookupActivity.this, msg, Toast.LENGTH_SHORT).show();
                    });
                }
            });
        }
    }

    private void processCroppedImage() {
        RectF cropRect = cropImageView.getCropWindowRect();
        Bitmap croppedBitmap = cropImageView.getCroppedImage((int) cropRect.width(), (int) cropRect.height());
        if (croppedBitmap != null) {
            // 创建一个字节输出流
            showFinalImage(croppedBitmap);
            startScanAnimation(cropImageView, scanLine);
            if(mQuestions.isEmpty()) {
                fetchQuestionList();
            }
            String url;
            if(subject == Subject.SUBJECT_BIOLOGY) {
                url = ApiUrl.URL_QUESTION_IMAGE_RECOGNISE_BIOLOGY;
            } else {
                url = ApiUrl.URL_QUESTION_IMAGE_RECOGNISE_MATH;
            }
            ApiGateWayService.recognizeImage(url, croppedBitmap, userInfoViewModel.token.getValue(), new ApiGateWayService.ExerciseImageRecognitionCallback() {
                @Override
                public void onSuccess(Question q) {
                    runOnUiThread(() -> {
                        stopScanAnimation(scanLine);
                        String questionString = "";

                        switch (subject) {
                            case SUBJECT_BIOLOGY:
                            case SUBJECT_MATH:
                                question = q;
                                questionString = question.getQuestion();
                                break;
                            default:
                                return;
                        }
                        splitLine.setVisibility(View.VISIBLE);
                        questionView.setContent(questionString);
                        btnAddToList.setVisibility(View.VISIBLE);
                    });
                }

                @Override
                public void onFailure(String msg, int code) {
                    runOnUiThread(() -> {
                        Toast.makeText(PhotoQuestionLookupActivity.this, msg, Toast.LENGTH_SHORT).show();
                        stopScanAnimation(scanLine);
                    });

                }
            });
        } else {
            Toast.makeText(this, getString(R.string.crop_image_fail), Toast.LENGTH_SHORT).show();
        }
    }

    private void stopScanAnimation(View scanLine) {
        scanLine.setVisibility(View.INVISIBLE);
    }

    private void startScanAnimation(CropImageView imageView, View scanLine) {
        // 获取ImageView的高度
        AtomicInteger height = new AtomicInteger(imageView.getHeight());

        // 如果ImageView的高度为0（可能是因为视图尚未测量），则设置一个监听器并在视图准备好时启动动画
        if (height.get() == 0) {
            imageView.post(() -> {
                height.set(imageView.getHeight());
                animateScanLine(scanLine, height.get());
            });
        } else {
            animateScanLine(scanLine, height.get());
        }
    }

    private void animateScanLine(View scanLine, int height) {
        // 创建并配置ObjectAnimator
        ObjectAnimator animator = ObjectAnimator.ofFloat(scanLine, "translationY", 0f, height);
        animator.setDuration(2000); // 动画持续时间2秒
        animator.setRepeatCount(ObjectAnimator.INFINITE); // 无限循环
        animator.setRepeatMode(ObjectAnimator.RESTART);   // 每次重复时重新开始

        // 开始动画
        animator.start();
    }

    private void showFinalImage(Bitmap bitmap) {
        cropImageView.setVisibility(View.GONE);
        ivPreview.setVisibility(View.VISIBLE);
        ivPreview.setImageBitmap(bitmap);
        scanLine.setVisibility(View.VISIBLE);
        ivPreview.requestLayout();
        scanLine.requestLayout();
    }

    private boolean allPermissionsGranted() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (allPermissionsGranted()) {
                startCamera();
            } else {
                Toast.makeText(this, "拍照授权失败", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if(keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME){
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if(keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME){
            return true;
        }
        return super.onKeyUp(keyCode, event);
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

    @Override
    public void onResume() {
        super.onResume();
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().hideRobot();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        ApplicationModelShared app = (ApplicationModelShared) getApplication();
        if(app.getFloatingWindowService() != null) {
            app.getFloatingWindowService().showRobot();
        }
    }

    @Override
    protected void onDestroy() {
        stopCamera(); // 确保在活动销毁时停止相机
        super.onDestroy();
    }
}