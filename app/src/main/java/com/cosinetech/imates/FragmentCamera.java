package com.cosinetech.imates;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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

import com.canhub.cropper.CropImageView;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

public class FragmentCamera extends Fragment {
    private PreviewView viewFinder;
    private ImageCapture imageCapture;
    private CropImageView cropImageView;
    private ImageView ivPreview;
    private Button btnCapture;
    private Button btnDone;
    private Executor executor = Executors.newSingleThreadExecutor();
    private SharedViewModel viewModel;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_camera, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        viewModel = new ViewModelProvider(requireActivity()).get(SharedViewModel.class);
        viewFinder = view.findViewById(R.id.viewFinder);
        cropImageView = view.findViewById(R.id.cropImageView);
        ivPreview = view.findViewById(R.id.ivPreview);
        btnCapture = view.findViewById(R.id.btnCapture);
        btnDone = view.findViewById(R.id.btnDone);

        if (allPermissionsGranted()) {
            startCamera();
        } else {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQUEST_CODE_PERMISSIONS);
        }

        btnCapture.setOnClickListener(v -> takePhoto());
        btnDone.setOnClickListener(v -> processCroppedImage());
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> cameraProviderFuture = ProcessCameraProvider.getInstance(requireContext());

        cameraProviderFuture.addListener(() -> {
            try {
                ProcessCameraProvider cameraProvider = cameraProviderFuture.get();
                bindPreview(cameraProvider);
            } catch (ExecutionException | InterruptedException e) {
                // Handle any errors
                Toast.makeText(requireContext(), "Error starting camera: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        }, ContextCompat.getMainExecutor(requireContext()));
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
        File photoFile = new File(requireContext().getExternalCacheDir(), "photo.jpg");

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
    }

    private void showCropView(File photoFile) {
        viewFinder.setVisibility(View.GONE);
        cropImageView.setVisibility(View.VISIBLE);
        btnCapture.setVisibility(View.GONE);
        btnDone.setVisibility(View.VISIBLE);

        cropImageView.setImageUriAsync(Uri.fromFile(photoFile));
        cropImageView.setAspectRatio(1, 1); // You can adjust this as needed
        cropImageView.setGuidelines(CropImageView.Guidelines.ON);
    }

    private void processCroppedImage() {
        Bitmap croppedBitmap = cropImageView.getCroppedImage();
        if (croppedBitmap != null) {
            Bitmap scannedBitmap = applyScannerEffect(croppedBitmap);
            showFinalImage(scannedBitmap);
            saveImage(scannedBitmap);

            Object objectToPass = new Object(); // 或者任何你想要传递的对象
            viewModel.setSharedObject(objectToPass); // 将对象传递给ParentFragment
            getParentFragmentManager().popBackStack(); // 移除ChildFragment并恢复到ParentFragment

        } else {
            Toast.makeText(requireContext(), "Failed to crop image", Toast.LENGTH_SHORT).show();
        }
    }

    private Bitmap applyScannerEffect(Bitmap source) {
        // Apply a custom shader for scanner effect
        // This is a placeholder. You should implement your own shader effect here.
        return ScannerShader.applyEffect(source);
    }

    private void showFinalImage(Bitmap bitmap) {
        cropImageView.setVisibility(View.GONE);
        ivPreview.setVisibility(View.VISIBLE);
        ivPreview.setImageBitmap(bitmap);
    }

    private void saveImage(Bitmap bitmap) {
        File outputFile = new File(requireContext().getExternalFilesDir(null), "scanned_image.jpg");
        try {
            FileOutputStream fos = new FileOutputStream(outputFile);
            bitmap.compress(Bitmap.CompressFormat.JPEG, 100, fos);
            fos.close();
            Toast.makeText(requireContext(), "Image saved: " + outputFile.getAbsolutePath(), Toast.LENGTH_LONG).show();
        } catch (IOException e) {
            e.printStackTrace();
            Toast.makeText(requireContext(), "Failed to save image: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
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