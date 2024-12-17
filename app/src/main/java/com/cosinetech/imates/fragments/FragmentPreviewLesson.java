package com.cosinetech.imates.fragments;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.R;
import com.cosinetech.imates.models.Chapter;
import com.cosinetech.imates.widgets.ConstraintRadioGroup;
import com.github.spareyaya.SimpleRatingView;
import com.xhh.pdfui.PDFActivity;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

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

    private Chapter.Schema mCurrentSchema = null;

    private Chapter.Section mPreviewSection;

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
            Toast.makeText(getContext(), "oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
        });

        SimpleRatingView ratingDifficult = view.findViewById(R.id.rating_difficulty);
        ratingDifficult.setOnRatingChangeListener((oldRating, newRating) -> {
            Toast.makeText(getContext(), "diff: oldRating:" + oldRating + " newRating:" + newRating, Toast.LENGTH_SHORT).show();
        });

        int [] rdoButonIds = new int[] {
                R.id.opt_scheme_1, R.id.opt_scheme_2, R.id.opt_scheme_3, R.id.opt_scheme_4, R.id.opt_scheme_5, R.id.opt_scheme_6
        };

        for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
            RadioButton rdoButton = view.findViewById(rdoButonIds[i]);
            rdoButton.setVisibility(View.VISIBLE);
        }

        ConstraintRadioGroup schemaGroup = view.findViewById(R.id.schema_group);
        schemaGroup.SetOnCheckedChangeListener((rg, nCheckedId) -> {
            for(int i = 0; i < mPreviewSection.getSchemas().size() && i < rdoButonIds.length; i++) {
                if(nCheckedId == rdoButonIds[i]) {
                    mCurrentSchema = mPreviewSection.getSchemas().get(i);
                    updateSchemaIntroduction(view.findViewById(R.id.schema_intro));
                    break;
                }
            }

        });

        Button goPreview = view.findViewById(R.id.btn_go_prepare);
        goPreview.setOnClickListener(v -> {
            if(mCurrentSchema == null) {
                Toast.makeText(getContext(), "先选择一个学习方案", Toast.LENGTH_SHORT).show();
            } else {
//                Intent intent = new Intent(getContext(), PDFActivity.class);
//                intent.putExtra("AssetsPdf","biology/chapter5/text_book.pdf");
//                getContext().startActivity(intent);


            }
        });
    }

    private void updateSchemaIntroduction(TextView view) {
        StringBuilder stringBuilder = new StringBuilder();
        InputStream inputStream = null;
        try {
            inputStream = getResources().getAssets().open(mCurrentSchema.getIntroduction());
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