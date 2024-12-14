package com.cosinetech.imates;

import android.Manifest;
import android.animation.ObjectAnimator;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import com.canhub.cropper.CropImageView;
import com.cosinetech.imates.model.ExerciseToAddList;
import com.cosinetech.imates.model.UserInfoViewModel;
import com.cosinetech.imates.webservice.ApiUrl;
import com.cosinetech.imates.webservice.ApiGateWayService;
import com.cosinetech.imates.webservice.QuestionImageResponse;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

public class FragmentCamera extends Fragment {
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
    private EnumSubject subject;
    private QuestionImageResponse question;


    public static FragmentCamera newInstance(EnumSubject subject) {
        FragmentCamera fragmentCamera = new FragmentCamera();
        fragmentCamera.setSubject(subject);
        return fragmentCamera;
    }

    public FragmentCamera() {
    }

    private void setSubject(EnumSubject subject) {
        this.subject = subject;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }


    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_camera, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        ViewModelStoreOwner owner = (ViewModelStoreOwner) requireActivity().getApplication();
        userInfoViewModel = new ViewModelProvider(
                owner,
                new ViewModelProvider.AndroidViewModelFactory(requireActivity().getApplication())
        ).get(com.cosinetech.imates.model.UserInfoViewModel.class);

        viewFinder = view.findViewById(R.id.viewFinder);
        cropImageView = view.findViewById(R.id.cropImageView);
        ivPreview = view.findViewById(R.id.ivPreview);
        btnCapture = view.findViewById(R.id.btnCapture);
        btnSearch = view.findViewById(R.id.btnSearch);
        btnAddToList = view.findViewById(R.id.addToList);
        btnExit = view.findViewById(R.id.btnExit);
        btnShotAgain = view.findViewById(R.id.btnReshoot);
        scanLine = view.findViewById(R.id.scanLine);
        questionView = view.findViewById(R.id.questionView);
        splitLine = view.findViewById(R.id.split_line);

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
            getParentFragmentManager().popBackStack();
        });

        btnAddToList.setOnClickListener(v -> {
            addExerciseToList();
            stopCamera();
            final FragmentExerciseList fragmentExerciseList = FragmentExerciseList.newInstance(ApiUrl.URL_CHAT_BIOLOGY, subject);
            getParentFragmentManager().beginTransaction()
                    .addToBackStack(null)
                    .replace(R.id.container, fragmentExerciseList)
                    .commit();
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
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(requireContext());

        cameraProviderFuture.addListener(() -> {
            try {
                cameraProvider = cameraProviderFuture.get();
                bindPreview(cameraProvider);
            } catch (ExecutionException | InterruptedException e) {
                Toast.makeText(requireContext(), "Error starting camera: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }, ContextCompat.getMainExecutor(requireContext()));
    }

    public void stopCamera() {
        if (cameraProvider != null) {
            cameraProvider.unbindAll(); // 解绑所有用例，停止相机预览
            cameraProvider = null;
        }
    }

    @Override
    public void onDestroy() {
        stopCamera(); // 确保在活动销毁时停止相机
        super.onDestroy();
    }

    private void addExerciseToList() {
        if(question == null || question.data.item.questionsConfirm.isEmpty()) {
            return;
        }
        QuestionImageResponse.Data.Item.Question q = question.data.item.questionsConfirm.get(0);
        ExerciseToAddList item = new ExerciseToAddList();
        item.setTitle(q.title);
        item.setImgName(q.titleImg);
        item.setImgTitleUrl(q.titleImg);
        item.setOptions(q.options);
        item.setSelect(q.options1);
        item.setImgUrl(q.optionsImg);
        item.setAnswer(q.answer);
        item.setExplanation(q.explanation);
        item.setExercisesId("");
        item.setBmNo(q.bmNo);

        if(subject == EnumSubject.SUBJECT_BIOLOGY) {
            item.setType("biology");
        } else if(subject == EnumSubject.SUBJECT_MATH) {
            item.setType("math");
        }
        ApiGateWayService.addExerciseToList(item, ApiUrl.URL_UPLOAD_EXERCISE, userInfoViewModel.token.getValue());
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
            File photoFile = File.createTempFile("prefix_", ".jpg", requireContext().getCacheDir());
            ImageCapture.OutputFileOptions outputOptions = new ImageCapture.OutputFileOptions.Builder(photoFile).build();

            imageCapture.takePicture(outputOptions, executor, new ImageCapture.OnImageSavedCallback() {
                @Override
                public void onImageSaved(@NonNull ImageCapture.OutputFileResults outputFileResults) {
                    requireActivity().runOnUiThread(() -> showCropView(photoFile));
                }

                @Override
                public void onError(@NonNull ImageCaptureException exception) {
                    requireActivity().runOnUiThread(() ->
                            Toast.makeText(requireContext(), "Error taking photo: " + exception.getMessage(), Toast.LENGTH_SHORT).show()
                    );
                }
            });
        } catch (Exception e) {
            Toast.makeText(requireContext(), "Error taking photo: " +e.getMessage(), Toast.LENGTH_SHORT).show();
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

    private void processCroppedImage() {
        RectF cropRect = cropImageView.getCropWindowRect();
        Bitmap croppedBitmap = cropImageView.getCroppedImage((int) cropRect.width(), (int) cropRect.height());
        if (croppedBitmap != null) {
            // 创建一个字节输出流
            showFinalImage(croppedBitmap);
            startScanAnimation(cropImageView, scanLine);
            ApiGateWayService.recognizeImage(croppedBitmap, userInfoViewModel.token.getValue(), new ApiGateWayService.ExerciseImageRecognitionCallback() {
                @Override
                public void onSuccess(String response) {
                    requireActivity().runOnUiThread(() -> {
                        stopScanAnimation(scanLine);
                        String questionString = "";

                        switch (subject) {
                            case SUBJECT_BIOLOGY:
                            case SUBJECT_MATH:
                                question = QuestionImageResponse.fromJson(response);
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
                    requireActivity().runOnUiThread(() -> {
                        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show();
                        stopScanAnimation(scanLine);
                    });

                }
            });
        } else {
            Toast.makeText(requireContext(), getString(R.string.crop_image_fail), Toast.LENGTH_SHORT).show();
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
        return ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (requestCode == REQUEST_CODE_PERMISSIONS) {
            if (allPermissionsGranted()) {
                startCamera();
            } else {
                Toast.makeText(requireContext(), "Permissions not granted by the user.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private static final int REQUEST_CODE_PERMISSIONS = 10;
}