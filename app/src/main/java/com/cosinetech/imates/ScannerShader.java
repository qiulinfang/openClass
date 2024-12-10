package com.cosinetech.imates;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;

public class ScannerShader {
    public static Bitmap applyEffect(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        Bitmap result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(result);

        ColorMatrix colorMatrix = new ColorMatrix();
        colorMatrix.setSaturation(0); // Convert to grayscale
        colorMatrix.postConcat(createHighContrastMatrix());

        Paint paint = new Paint();
        paint.setColorFilter(new ColorMatrixColorFilter(colorMatrix));

        canvas.drawBitmap(source, 0, 0, paint);
        return result;
    }

    private static ColorMatrix createHighContrastMatrix() {
        ColorMatrix matrix = new ColorMatrix(new float[]{
                2.0f, 0, 0, 0, -128,
                0, 2.0f, 0, 0, -128,
                0, 0, 2.0f, 0, -128,
                0, 0, 0, 1, 0
        });
        return matrix;
    }
}