package com.cosinetech.imates;

import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;
import java.util.jar.Attributes;

import io.noties.markwon.image.ImageItem;
import io.noties.markwon.image.MediaDecoder;
import io.noties.markwon.image.SchemeHandler;

public class Base64SchemeHandler extends SchemeHandler implements IBase64SchemeHandler {
    @NonNull
    @Override
    public InputStream handle(@NonNull String raw, @NonNull Attributes attributes) {
        String base64Data = raw.substring("data:image/".length());
        byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
        return new ByteArrayInputStream(decodedBytes);
    }

    /**
     * Changes since 4.0.0:
     * <ul>
     * <li>Returns `non-null` image-item</li>
     * </ul>
     *
     * @param raw
     * @param uri
     * @see ImageItem#withResult(Drawable)
     * @see ImageItem#withDecodingNeeded(String, InputStream)
     */
    @NonNull
    @Override
    public ImageItem handle(@NonNull String raw, @NonNull Uri uri) {
        return null;
    }

    /**
     * @since 4.0.0
     */
    @NonNull
    @Override
    public Collection<String> supportedSchemes() {
        return Collections.emptyList();
    }
}

