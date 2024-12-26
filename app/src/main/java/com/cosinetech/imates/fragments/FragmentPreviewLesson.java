package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;

import com.cosinetech.imates.R;
import com.cosinetech.imates.activities.MainActivity;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.widgets.ConstraintRadioGroup;
import com.github.spareyaya.SimpleRatingView;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import android.widget.MediaController;
/**
 * A simple {@link Fragment} subclass.
 * Use the {@link FragmentPreviewLesson#newInstance} factory method to
 * create an instance of this fragment.
 */
public class FragmentPreviewLesson extends Fragment {
    private static final String KEY_PREVIEW_SECTION_NAME = "PREVIEW_SECTION_NAME";
    private static final String KEY_SECTION_SCHEMA = "SECTION_SCHEMA";

    // TODO: Rename and change types of parameters
    private String mPreviewSectionName;

    private int mCurrentSchemaIndex = -1;

    private Chapter.Section mPreviewSection;

    private SharedPreferences sharedPreferences;
    private final String CONFIG_NAME = "SCHEMA_LEARN_STAT";

    public FragmentPreviewLesson() {
        // Required empty public constructor
    }


    public static FragmentPreviewLesson newInstance(String sectionName, Chapter.Section section) {
        FragmentPreviewLesson fragment = new FragmentPreviewLesson();
        Bundle args = new Bundle();
        args.putString(KEY_PREVIEW_SECTION_NAME, sectionName);
        args.putParcelable(KEY_SECTION_SCHEMA, section);
        fragment.setArguments(args);
        return fragment;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            mPreviewSectionName = getArguments().getString(KEY_PREVIEW_SECTION_NAME);
            mPreviewSection = getArguments().getParcelable(KEY_SECTION_SCHEMA);
        }
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_preview_lession, container, false);
    }

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        if(!mPreviewSectionName.contains("5.1")) {
            view.findViewById(R.id.teacher_video1).setVisibility(View.GONE);
            view.findViewById(R.id.teacher_video2).setVisibility(View.GONE);
        }
        String sectionId = mPreviewSection.getSection();
        TextView textPreview = view.findViewById(R.id.label);
        textPreview.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                getParentFragmentManager().popBackStack();
            }
        });

        TextView textPreviewSectionName = view.findViewById(R.id.preview_section_name);
        textPreviewSectionName.setText(mPreviewSectionName);

        SimpleRatingView ratingView = view.findViewById(R.id.rating);
        ratingView.setOnRatingChangeListener((oldRating, newRating) ->  {
            //Toast.makeText(getContext(), "oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
            if(mCurrentSchemaIndex >= 0) {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putInt(sectionId + "schema_rating" + mCurrentSchemaIndex, newRating);
                editor.apply();
            }
        });

        SimpleRatingView ratingDifficult = view.findViewById(R.id.rating_difficulty);
        ratingDifficult.setOnRatingChangeListener((oldRating, newRating) -> {
            //Toast.makeText(getContext(), "diff: oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
            if(mCurrentSchemaIndex >= 0) {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putInt(sectionId + "schema_rating_difficulty" + mCurrentSchemaIndex, newRating);
                editor.apply();
            }
        });

        ratingView.setEnabled(false);
        ratingDifficult.setEnabled(false);

        sharedPreferences = requireActivity().getSharedPreferences(CONFIG_NAME, Context.MODE_PRIVATE);

        int [] rdoButonIds = new int[] {
                R.id.opt_scheme_1, R.id.opt_scheme_2, R.id.opt_scheme_3,
                R.id.opt_scheme_4, R.id.opt_scheme_5, R.id.opt_scheme_6
        };


        int [] textViewSchemaStat = new int[] {
                R.id.schema_1_stat, R.id.schema_2_stat, R.id.schema_3_stat,
                R.id.schema_4_stat, R.id.schema_5_stat, R.id.schema_6_stat
        };

        for(int i = 0; i < rdoButonIds.length; i++) {
            RadioButton rdoButton = view.findViewById(rdoButonIds[i]);
            TextView v = view.findViewById(textViewSchemaStat[i]);
            rdoButton.setVisibility(View.INVISIBLE);
            v.setVisibility(View.INVISIBLE);
        }

        for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
            RadioButton rdoButton = view.findViewById(rdoButonIds[i]);
            TextView v = view.findViewById(textViewSchemaStat[i]);
            rdoButton.setVisibility(View.VISIBLE);
            v.setVisibility(View.VISIBLE);
        }

        for(int i = 0; i < textViewSchemaStat.length; i++) {
            TextView v = view.findViewById(textViewSchemaStat[i]);
            boolean learned = sharedPreferences.getBoolean(sectionId + "_schema" + i, false);
            if(learned) {
                v.setText("已学习");
                v.setTextColor(Color.GREEN);
            } else {
                v.setText("未学习");
                v.setTextColor(Color.GRAY);
            }
        }

        ConstraintRadioGroup schemaGroup = view.findViewById(R.id.schema_group);
        schemaGroup.SetOnCheckedChangeListener((rg, nCheckedId) -> {
            ratingView.setEnabled(true);
            ratingDifficult.setEnabled(true);

            for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
                if(nCheckedId == rdoButonIds[i]) {
                    mCurrentSchemaIndex = i;
                    int rating = sharedPreferences.getInt(sectionId + "schema_rating_difficulty" + i, 0);
                    ratingDifficult.setRating(rating);

                    rating = sharedPreferences.getInt(sectionId + "schema_rating" + i, 0);
                    ratingView.setRating(rating);

                    updateSchemaIntroduction(view.findViewById(R.id.schema_intro));
                    break;
                }
            }

        });

        Button goPreview = view.findViewById(R.id.btn_go_prepare);
        goPreview.setOnClickListener(v -> {
            for(int i = 0; i < rdoButonIds.length; i++) {
                RadioButton rdoButton = view.findViewById(rdoButonIds[i]);
                if(rdoButton.isChecked()) {
                    mCurrentSchemaIndex = i;
                    break;
                }
            }
            if(mCurrentSchemaIndex < 0) {
                Toast.makeText(getContext(), "先选择一个学习方案", Toast.LENGTH_SHORT).show();
            } else {
                SharedPreferences.Editor editor = sharedPreferences.edit();
                editor.putBoolean(sectionId + "_schema" + mCurrentSchemaIndex, true);
                editor.apply();

                TextView textView = view.findViewById(textViewSchemaStat[mCurrentSchemaIndex]);
                textView.setText("已学习");
                textView.setTextColor(Color.GREEN);

                Intent intent = new Intent(getContext(), com.cosinetech.imates.pdfui.PDFActivity.class);
                intent.putExtra("AssetsPdf", mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getTextBook());
                intent.putExtra("Schema", mPreviewSection.getSchemas().get(mCurrentSchemaIndex));
                intent.putExtra("Section", mPreviewSection);
                getContext().startActivity(intent);

//                Uri uri = Uri.parse(getContext().getExternalFilesDir(null) + mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getTextBook());
//                Intent intent = new Intent(getContext(), MuPDFActivity.class);
//                intent.putExtra("Schema", mPreviewSection.getSchemas().get(mCurrentSchemaIndex));
//                intent.putExtra("Section", mPreviewSection);
//                intent.setAction(Intent.ACTION_VIEW);
//                intent.setData(uri);
//
//                getContext().startActivity(intent);
            }
        });


        VideoView videoView = view.findViewById(R.id.video_view);
        View video_layout = view.findViewById(R.id.video_area);
        TextView textView1 = view.findViewById(R.id.teacher_video1);
        TextView textView2 = view.findViewById(R.id.teacher_video2);

        textView1.setOnClickListener(v->{
            String path = requireActivity().getExternalFilesDir(null) + "/videos/1.mp4";
            File file = new File(path);
            if(file.exists()) {
                video_layout.setVisibility(View.VISIBLE);
                videoView.setVideoPath(path);
                videoView.start();
            } else {
                Toast.makeText(requireContext(), "视频文件不存在", Toast.LENGTH_SHORT).show();
            }
        });

        textView2.setOnClickListener(v->{
            String path = requireActivity().getExternalFilesDir(null) + "/videos/2.mp4";
            File file = new File(path);
            if(file.exists()) {
                video_layout.setVisibility(View.VISIBLE);
                videoView.setVideoPath(path);
                videoView.start();
            } else {
                Toast.makeText(requireContext(), "视频文件不存在", Toast.LENGTH_SHORT).show();
            }
        });

        MediaController mediaController = new MediaController(requireContext());
        mediaController.setAnchorView(videoView);
        // 控制 MediaController 显示时间
        mediaController.setVisibility(View.VISIBLE);
        videoView.setMediaController(mediaController);

        videoView.setOnPreparedListener(mp -> {
            float videoRatio = mp.getVideoWidth() / (float) mp.getVideoHeight();
            float screenRatio = videoView.getWidth() / (float) videoView.getHeight();
            float scaleX = videoRatio / screenRatio;
            if (scaleX >= 1f) {
                videoView.setScaleX(scaleX);
            } else {
                videoView.setScaleY(1f / scaleX);
            }
        });

        videoView.setOnCompletionListener(mp-> {

        });

        Button buttonExitVideo = view.findViewById(R.id.btn_exit_video);
        buttonExitVideo.setOnClickListener(v->{
            videoView.stopPlayback();
            video_layout.setVisibility(View.GONE);
        });
    }

    private void updateSchemaIntroduction(TextView view) {
        StringBuilder stringBuilder = new StringBuilder();
        InputStream inputStream = null;
        try {
            inputStream = getResources().getAssets().open(mPreviewSection.getSchemas().get(mCurrentSchemaIndex).getIntroduction());
            InputStreamReader isr = new InputStreamReader(inputStream);
            BufferedReader reader = new BufferedReader(isr);
            String line;
            while ((line = reader.readLine()) != null) {
                stringBuilder.append(line).append("\n");
            }
            reader.close();
            isr.close();
            inputStream.close();
            view.setText(stringBuilder.toString());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void showLessonPreparePopupWindow() {

    }
}