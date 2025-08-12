package com.cosinetech.imates.feedback;

import static com.cosinetech.imates.feedback.OkHttpTicketCreator.createTicketWithAttachments;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.lifecycle.ViewModelStoreOwner;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.databinding.ActivityFeedbackBinding;
import com.cosinetech.imates.models.UserInfoViewModel;
import com.cosinetech.imates.util.AppUtils;
import com.cosinetech.imates.util.SimpleImageCompressor;
import com.cosinetech.imates.util.WindowUtils;

import java.io.File;
import java.util.UUID;

import gun0912.tedimagepicker.builder.TedImagePicker;
import me.minetsh.imaging.IMGEditActivity;

/**
 * An example full-screen activity that shows and hides the system UI (i.e.
 * status bar and navigation/system bar) with user interaction.
 */
public class FeedbackActivity extends AppCompatActivity {
    public static final String KEY_FEEDBACK_IMAGE = "FEEDBACK_IMAGE";
    private static final int REQ_IMAGE_EDIT = 1;
    private ActivityFeedbackBinding binding;

    private String mFeedbackImagePath;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowUtils.hideSystemUI(this);
        WindowUtils.setFullScreenMode(this);

        binding = ActivityFeedbackBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        ((ApplicationModelShared)getApplication()).getFloatingWindowService().hideRobot();

        binding.summitButton.setOnClickListener(v -> {
            binding.summitButton.setEnabled(false);
            binding.summitButton.setText(R.string.summit_in_progress);
            UserInfoViewModel userInfoViewModel = new ViewModelProvider(
                    (ViewModelStoreOwner) getApplication(),
                    new ViewModelProvider.AndroidViewModelFactory(getApplication())
            ).get(UserInfoViewModel.class);
            String body = binding.feedDesc.getEditableText().toString();
            if(body.trim().length() < 5) {
                Toast.makeText(FeedbackActivity.this, "描述您遇到的问题,至少5个字", Toast.LENGTH_SHORT).show();
                binding.feedDesc.requestFocus();
                binding.summitButton.setText(R.string.summit);
                binding.summitButton.setEnabled(true);
                return;
            }
            String title = userInfoViewModel.userId.getValue() + "的反馈";
            createTicketWithAttachments(title, body, mFeedbackImagePath.trim().isEmpty() ? null : new File(mFeedbackImagePath), new OkHttpTicketCreator.TicketCreationCallback() {
                @Override
                public void onSuccess(String response) {
                    Toast.makeText(FeedbackActivity.this, "感谢您的反馈!", Toast.LENGTH_SHORT).show();
                    binding.summitButton.setText(R.string.summit);
                    binding.summitButton.setEnabled(true);
                    finish();
                }

                @Override
                public void onFailure(String error) {
                    Toast.makeText(FeedbackActivity.this, "反馈失败了", Toast.LENGTH_SHORT).show();
                    binding.summitButton.setText(R.string.summit);
                    binding.summitButton.setEnabled(true);
                }
            });
            ((ApplicationModelShared)getApplication()).getFloatingWindowService().showRobot();
        });

        mFeedbackImagePath = getIntent().getStringExtra(KEY_FEEDBACK_IMAGE);
        if(mFeedbackImagePath != null && new File(mFeedbackImagePath).exists()) {
            binding.feedImage.setImageURI(Uri.fromFile(new File(mFeedbackImagePath)));
        } else {
            mFeedbackImagePath = "";
        }
        binding.feedImage.setOnClickListener(v -> {
            startActivityForResult(
                    new Intent(this, IMGEditActivity.class)
                   .putExtra(IMGEditActivity.EXTRA_IMAGE_URI, Uri.fromFile(new File(mFeedbackImagePath)))
                    .putExtra(IMGEditActivity.EXTRA_IMAGE_SAVE_PATH, mFeedbackImagePath),
            REQ_IMAGE_EDIT);
        });

        binding.uploadImageButton.setOnClickListener(v->{
            TedImagePicker.with(this)
                    .startMultiImage(uriList -> {
                        String paths = "";
                        for(Uri uri : uriList) {
                            if(uri != null) {
                                // 复制图片到外部存储
                                String filePath = AppUtils.getUserFilePath().getAbsolutePath() + "/" + UUID.randomUUID().toString() + ".png";
                                boolean success = AppUtils.copyImageToExternalFilesDir(getApplicationContext(), uri, filePath);
                                if (success) {
                                    SimpleImageCompressor.compressInPlace(filePath, 40);
                                    paths = filePath;
                                } else {
                                    Log.e("PhotoPicker", "Failed to copy image.");
                                    Toast.makeText(getApplicationContext(), "照片读取失败", Toast.LENGTH_SHORT).show();
                                }
                            } else {
                                Toast.makeText(getApplicationContext(), "没有选择相片", Toast.LENGTH_SHORT).show();
                            }
                        }

                        if(!paths.isEmpty()) {
                            mFeedbackImagePath = paths;
                            binding.feedImage.setImageURI(Uri.fromFile(new File(mFeedbackImagePath)));
                        }
                    });
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowUtils.hideSystemUI(this);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_IMAGE_EDIT) {
            Bitmap bmp = BitmapFactory.decodeFile(mFeedbackImagePath);
            binding.feedImage.setImageBitmap(bmp);
        }
    }
}