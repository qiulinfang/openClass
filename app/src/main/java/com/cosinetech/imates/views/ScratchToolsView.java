package com.cosinetech.imates.views;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.colorpicker.ColorListener;
import com.cosinetech.imates.colorpicker.ColorPickerDialog;
import com.cosinetech.imates.models.Subject;
import com.cosinetech.imates.notes.NoteManager;
import com.cosinetech.imates.util.ImageUtils;
import com.cosinetech.imates.webservice.AiChatMessageRequest;
import com.cosinetech.imates.webservice.ApiUrl;
import com.litao.slider.NiftySlider;
import com.lzf.easyfloat.EasyFloat;

import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;

public class ScratchToolsView extends RelativeLayout {
    public interface OnScratchToolsListener {
        void onEnterScratchMode();
        void onExitScratchMode();
        Bitmap onGetScratchCanvasBitmap();
    }

    private Context context;
    /// edit tools
    private ImageView btnBrushSize;
    private ImageView btnPalatte;
    private ImageView btnUseBrush;
    private ImageView btnUseEraser;
    private ImageView btnUndo;
    private ImageView btnRedo;
    private ImageView btnSelectArea;
    private ImageView btnOk;
    private ImageView btnCancel;
    private TextView textColorIndicator;

    private PaintView paintView;

    private int selectionColorId = R.color.assist_blue;
    private View paintToolView;

    private OnScratchToolsListener mListener;
    private String mAiPrompt = "";

    public ScratchToolsView(Context context) {
        super(context);
        init(context);
    }

    public ScratchToolsView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init(context);
    }

    public ScratchToolsView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init(context);
    }

    public ScratchToolsView(Context context, AttributeSet attrs, int defStyleAttr, int defStyleRes) {
        super(context, attrs, defStyleAttr, defStyleRes);
        init(context);
    }

    public void setOnScratchToolsListener(OnScratchToolsListener l) {
        mListener = l;
    }

    public void setAskAiContextPrompt(String prompt) {
        mAiPrompt = prompt;
    }

    private void init(Context context) {
        this.context = context;
        View view = LayoutInflater.from(context).inflate(R.layout.scratch_tools_view, this, true);
        paintView = view.findViewById(R.id.paint_view);
        btnBrushSize = view.findViewById(R.id.imgBrushSize);
        btnPalatte = view.findViewById(R.id.imgPalette);
        btnUseBrush = view.findViewById(R.id.imgBrush);
        btnUseEraser = view.findViewById(R.id.imgErase);
        btnUndo = view.findViewById(R.id.imgUndo);
        btnRedo = view.findViewById(R.id.imgRedo);
        btnSelectArea = view.findViewById(R.id.imgSelectArea);
        btnOk = view.findViewById(R.id.imgOK);
        btnCancel = view.findViewById(R.id.imgCancel);

        textColorIndicator = view.findViewById(R.id.colorIndicator);
        paintToolView = view.findViewById(R.id.img_edit_layout);
        paintToolView.setVisibility(View.GONE);

        initPaintView(context);

        com.litao.slider.NiftySlider slider = findViewById(R.id.niftySlider);
        btnBrushSize.setOnClickListener(v -> {
            if(slider.getVisibility() == View.VISIBLE) {
                btnBrushSize.setBackgroundColor(context.getColor(R.color.semi_black_transparent));
                slider.setVisibility(View.GONE);
            } else {
                slider.setVisibility(View.VISIBLE);
                btnBrushSize.setBackgroundColor(context.getColor(selectionColorId));
            }
        });

        slider.setOnIntValueChangeListener(new NiftySlider.OnIntValueChangeListener() {
            @Override
            public void onValueChange(@NonNull NiftySlider niftySlider, int i, boolean b) {
                paintView.setBrushSize(i);
            }
        });

        btnPalatte.setOnClickListener(v->{
            new ColorPickerDialog.Builder(context)
                    .setTitle("选择颜色")
                    .setPositiveButton("确定", (ColorListener) (colorInfo, fromUser) -> {
                        textColorIndicator.setTextColor(colorInfo.getColor());
                        paintView.setBrushColor(colorInfo.getColor());
                    })
                    .show();
        });

        btnUseBrush.setOnClickListener(
                v -> {
                    if(mListener == null) {
                        return;
                    }
                    enterScratchMode();
                    resetPaintToolSelect();
                    paintView.disableEraser();
                    paintView.disableSelection();
                    btnUseBrush.setBackgroundColor(context.getColor(selectionColorId));
                }
        );

        btnUseEraser.setOnClickListener(
                v-> {
                    if(mListener == null) {
                        return;
                    }
                    enterScratchMode();
                    resetPaintToolSelect();
                    paintView.enableEraser();
                    paintView.disableSelection();
                    btnUseEraser.setBackgroundColor(context.getColor(selectionColorId));
                }
        );

        btnSelectArea.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if(mListener == null) {
                    return;
                }
                enterScratchMode();
                resetPaintToolSelect();
                paintView.enableSelection();
                paintView.disableEraser();
                btnSelectArea.setBackgroundColor(context.getColor(selectionColorId));
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

        btnCancel.setOnClickListener( v -> {
            exitScratchMode();
        });
    }

    private void initPaintView(Context context) {
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
                View popupView = LayoutInflater.from(context).inflate(R.layout.pdf_scribble_menu, null);

                // 创建 PopupWindow
                PopupWindow popupWindow = new PopupWindow(popupView,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        true);

                // 设置点击事件
                popupView.findViewById(R.id.menu_chat).setOnClickListener(view -> {
                    Bitmap bmp = paintView.getSelectedBitmap();
                    popupWindow.dismiss();
                    askQuestionForPicture(bmp, (int)x, (int)y);
                });

                popupView.findViewById(R.id.menu_note).setOnClickListener(view -> {
                    Bitmap bmp = paintView.getSelectedBitmap();
                    byte [] data = ImageUtils.compressBitmapToJpg(bmp);
                    try {
                        String fileName = makeNoteFullFilePath();
                        if(!writeJpgToExternalStorage(data, fileName)) {
                            Toast.makeText(context, "保存图片失败", Toast.LENGTH_SHORT).show();
                        } else {
                            NoteManager manager = new NoteManager(context);
                            StringBuilder htmlContentBuilder = new StringBuilder();
                            htmlContentBuilder.append("<img src=\"").append(fileName.toString()).append("\"/>");
                            manager.addNote(htmlContentBuilder.toString(), "");
                            popupWindow.dismiss();
                        }
                    }catch (Exception ex) {
                        Toast.makeText(context, "创建笔记失败", Toast.LENGTH_SHORT).show();
                    }
                });

                // 显示 PopupWindow 在指定位置 (例如屏幕中央)
                popupWindow.showAtLocation(paintView, Gravity.NO_GRAVITY, (int)x, (int)y);
            }
        });
    }

    private void enterScratchMode() {
        if(mListener == null) {
            return;
        }
        mListener.onEnterScratchMode();
        Bitmap bmp = mListener.onGetScratchCanvasBitmap();

        if(paintToolView.getVisibility() != View.VISIBLE) {
            EasyFloat.hide();
            paintView.setBitmap(bmp);
            paintToolView.setVisibility(View.VISIBLE);
        }
    }

    private void exitScratchMode() {
        if(mListener == null) {
            return;
        }
        mListener.onExitScratchMode();

        if(paintToolView.getVisibility() == View.VISIBLE) {
            paintToolView.setVisibility(View.GONE);
            EasyFloat.show();
        }
        resetPaintToolSelect();
    }

    private void askQuestionForPicture(Bitmap bmp, int x, int y) {
// 加载自定义布局
        View popupView = LayoutInflater.from(context).inflate(R.layout.pdf_ask_ai, null);
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
            if(editText.getText().toString().trim().isEmpty()) {
                Toast.makeText(context, "请输入要问的问题", Toast.LENGTH_SHORT).show();
                return;
            }
            popupWindow.dismiss();
            ApplicationModelShared app = ApplicationModelShared.getInstance();
            AiChatMessageRequest chatRequest = new AiChatMessageRequest(
                    UUID.nameUUIDFromBytes(mAiPrompt.getBytes()).toString(),
                    "1",
                    editText.getText().toString(),
                    ImageUtils.bitmapToHtmlJpgBase64(bmp),
                    mAiPrompt,
                    "",
                    "start",
                    "",
                    false);
            chatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);
            try {
                app.chatRequest = chatRequest;

                app.getFloatingWindowService().popupChatBot(ApiUrl.URL_CHAT_GENERAL, Subject.SUBJECT_ALL.name());
            } catch (Exception e) {
                Toast.makeText(context, "请输入要问的问题", Toast.LENGTH_SHORT).show();
            }
        });

        popupView.findViewById(R.id.btn_cancel).setOnClickListener(view -> {
            popupWindow.dismiss();
        });

        // 显示 PopupWindow 在指定位置 (例如屏幕中央)
        popupWindow.showAtLocation(paintView, Gravity.NO_GRAVITY, (int)x, 2);
    }

    private String makeNoteFullFilePath() {
        // 获取应用的私有外部存储目录
        File externalFilesDir = context.getExternalFilesDir(null);
        if (externalFilesDir == null) {
            Toast.makeText(context, "无法访问外部存储目录", Toast.LENGTH_SHORT).show();
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

    private boolean writeJpgToExternalStorage(byte [] data , String filePath) {
        try {
            File file = new File(filePath);
            // 创建文件并写入内容
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(data);
            fos.close();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(context, "写入文件失败: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    private void resetPaintToolSelect() {
        btnUseBrush.setBackgroundColor(context.getColor(R.color.semi_black_transparent));
        btnUseEraser.setBackgroundColor(context.getColor(R.color.semi_black_transparent));
        btnSelectArea.setBackgroundColor(context.getColor(R.color.semi_black_transparent));
    }
}
