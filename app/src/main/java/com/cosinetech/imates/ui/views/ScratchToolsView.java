package com.cosinetech.imates.ui.views;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.drawable.ColorDrawable;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.RelativeLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.cosinetech.imates.ApplicationModelShared;
import com.cosinetech.imates.R;
import com.cosinetech.imates.data.models.SubjectUtils;
import com.cosinetech.imates.ui.colorpicker.ColorListener;
import com.cosinetech.imates.ui.colorpicker.ColorPickerDialog;
import com.cosinetech.imates.data.models.Subject;
import com.cosinetech.imates.utils.AppUtils;
import com.cosinetech.imates.utils.ImageUtils;
import com.cosinetech.imates.utils.ScreenUtils;
import com.cosinetech.imates.coreapiservice.AiChatMessageRequest;
import com.cosinetech.imates.coreapiservice.ApiUrl;
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

        NiftySlider slider = findViewById(R.id.niftySlider);
        btnBrushSize.setOnClickListener(v -> {
            if(slider.getVisibility() == View.VISIBLE) {
                btnBrushSize.setBackgroundColor(context.getColor(R.color.semi_black_transparent));
                slider.setVisibility(View.GONE);
            } else {
                slider.setVisibility(View.VISIBLE);
                btnBrushSize.setBackgroundColor(context.getColor(selectionColorId));
            }
        });

        slider.setOnIntValueChangeListener((niftySlider, i, b) -> paintView.setBrushSize(i));

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

        btnSelectArea.setOnClickListener(v -> {
            if(mListener == null) {
                return;
            }
            enterScratchMode();
            resetPaintToolSelect();
            paintView.enableSelection();
            paintView.disableEraser();
            btnSelectArea.setBackgroundColor(context.getColor(selectionColorId));
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
//                            NoteManager manager = new NoteManager(context);
//                            StringBuilder htmlContentBuilder = new StringBuilder();
//                            htmlContentBuilder.append("<img src=\"").append(fileName.toString()).append("\"/>");
//                            manager.addNote(htmlContentBuilder.toString(), "");
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
        View qView = LayoutInflater.from(context).inflate(R.layout.pdf_ask_ai, null);
        ImageView imageView = qView.findViewById(R.id.ask_picture_src);
        EditText editText = qView.findViewById(R.id.ask_content);
        // 动态设置窗口宽度
        int screenWidth = ScreenUtils.getScreenWidth(getContext());
        int screenHeight = ScreenUtils.getScreenHeight(getContext());
        // 创建 PopupWindow
        PopupWindow popupWindow = new PopupWindow(qView,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
                true);

        imageView.setImageBitmap(bmp);

        // 设置点击事件
        qView.findViewById(R.id.btn_ok).setOnClickListener(view -> {
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
                    AppUtils.getUserNickName(),
                    "start",
                    "",
                    false,
                    "math");
            chatRequest.setDstUrl(ApiUrl.URL_CHAT_PREVIEW_PICTURE);
            try {
                app.chatRequest = chatRequest;

                app.getFloatingWindowService().popupChatBot(ApiUrl.URL_CHAT_GENERAL, false);
            } catch (Exception e) {
                Toast.makeText(context, "请输入要问的问题", Toast.LENGTH_SHORT).show();
            }
        });

        qView.findViewById(R.id.btn_cancel).setOnClickListener(view -> {
            popupWindow.dismiss();
        });

        // 拖动功能实现
        final int[] anchorScreenLocation = new int[2];

// 在showAtLocation之前添加
        paintView.getLocationOnScreen(anchorScreenLocation);

// 修改触摸监听
//        final int[] lastTouchPos = new int[2];
//        final boolean[] isDragging = {false};
//        qView.setOnTouchListener(new View.OnTouchListener() {
//            @Override
//            public boolean onTouch(View v, MotionEvent event) {
//                int action = event.getAction();
//                int x = (int) event.getRawX();
//                int y = (int) event.getRawY();
//
//                switch (action) {
//                    case MotionEvent.ACTION_DOWN:
//                        lastTouchPos[0] = x;
//                        lastTouchPos[1] = y;
//                        isDragging[0] = false;
//                        return true;
//
//                    case MotionEvent.ACTION_MOVE:
//                        int dx = x - lastTouchPos[0];
//                        int dy = y - lastTouchPos[1];
//
//                        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
//                            if (!isDragging[0]) {
//                                qView.animate().alpha(0.9f).setDuration(100).start();
//                            }
//                            isDragging[0] = true;
//
//                            // 获取当前PopupWindow位置
//                            int[] popupLocation = new int[2];
//                            qView.getLocationOnScreen(popupLocation);
//
//                            // 计算新位置
//                            int newX = popupLocation[0] + dx;
//                            int newY = popupLocation[1] + dy;
//
//                            // 确保视图尺寸有效
//                            if (qView.getWidth() <= 0 || qView.getHeight() <= 0) {
//                                qView.measure(
//                                        View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
//                                        View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
//                                );
//                            }
//
//                            // 边界检查
//                            newX = Math.max(0, Math.min(newX, screenWidth - qView.getMeasuredWidth()));
//                            newY = Math.max(0, Math.min(newY, screenHeight - qView.getMeasuredHeight()));
//
//                            // 转换为相对于锚点的坐标
//                            int relativeX = newX - anchorScreenLocation[0];
//                            int relativeY = newY - anchorScreenLocation[1];
//
//                            // 更新位置
//                            popupWindow.update(relativeX, relativeY, -1, -1, true);
//
//                            lastTouchPos[0] = x;
//                            lastTouchPos[1] = y;
//                        }
//                        return true;
//
//                    case MotionEvent.ACTION_UP:
//                        if (isDragging[0]) {
//                            isDragging[0] = false;
//                            qView.animate().alpha(1.0f).setDuration(200).start();
//                            return true;
//                        }
//                        return false;
//                }
//                return false;
//            }
//        });


        final Rect popupRect = new Rect();
        final int[] lastTouchPos = new int[2];
        final boolean[] isDragging = {false};
        final int[] popupLocation = new int[2]; // 记录PopupWindow当前位置
         //设置拖动触摸监听
        qView.setOnTouchListener(new OnTouchListener() {
            @SuppressLint("ClickableViewAccessibility")
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                int action = event.getAction();
                int x = (int) event.getRawX();
                int y = (int) event.getRawY();

                switch (action) {
                    case MotionEvent.ACTION_DOWN:
                        // 记录初始触摸位置
                        lastTouchPos[0] = x;
                        lastTouchPos[1] = y;
                        isDragging[0] = false;
                        // 获取当前PopupWindow位置
                        qView.getLocationOnScreen(popupLocation);
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        // 计算移动距离
                        int dx = x - lastTouchPos[0];
                        int dy = y - lastTouchPos[1];

                        // 更新PopupWindow位置
                        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) { // 移动阈值，避免误触
                            if (!isDragging[0]) {
                                // 开始拖动时添加动画效果
                                qView.animate().alpha(0.9f).setDuration(100).start();
                            }
                            isDragging[0] = true;

                            // 计算新位置（带边界检查）
                            int newX = popupLocation[0] + dx;
                            int newY = popupLocation[1] + dy;

                            // 边界检查 - 防止拖出屏幕
                            int popupWidth = qView.getWidth();
                            int popupHeight = qView.getHeight();

                            newX = Math.max(0, Math.min(newX, screenWidth - popupWidth));
                            newY = Math.max(0, Math.min(newY, screenHeight - popupHeight));

                            // 更新位置
                            popupWindow.update(newX, newY, -1, -1, true);

                            // 更新记录的位置
                            popupLocation[0] = newX;
                            popupLocation[1] = newY;
                            lastTouchPos[0] = x;
                            lastTouchPos[1] = y;
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isDragging[0]) {
                            isDragging[0] = false;
                            // 拖动结束恢复透明度
                            qView.animate().alpha(1.0f).setDuration(200).start();
                            return true; // 消费事件，防止触发点击
                        }
                        return false;
                }
                return false;
            }
        });

        popupWindow.setTouchable(true);
        popupWindow.setFocusable(true);
        popupWindow.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        popupWindow.setOutsideTouchable(true);

        popupWindow.setTouchInterceptor(new OnTouchListener() {
            @SuppressLint("ClickableViewAccessibility")
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                int [] location = new int[2];
                qView.getLocationOnScreen(location);
                popupRect.set(
                        location[0],
                        location[1],
                        location[0] + qView.getWidth(),
                        location[1] + qView.getHeight()
                );


                // 检查是否点击在PopupWindow外部
                if (!popupRect.contains((int)event.getRawX(), (int)event.getRawY())) {
                    return true; // 拦截外部点击
                }
                return false; // 允许内部事件传递
            }
        });
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
