package com.cosinetech.imates;

import android.graphics.drawable.Drawable;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;

import io.noties.markwon.image.MediaDecoder;

public class Base64MediaDecoder extends MediaDecoder implements IBase64MediaDecoder {
    @Override
    public boolean handles(@NonNull String raw) {
        return raw.startsWith("data:image/");
    }

    /**
     * Changes since 4.0.0:
     * <ul>
     * <li>Returns `non-null` drawable</li>
     * <li>Added `contentType` method parameter</li>
     * </ul>
     *
     * @param contentType
     * @param inputStream
     */
    @NonNull
    @Override
    public Drawable decode(@Nullable String contentType, @NonNull InputStream inputStream) {
        return null;
    }

    /**
     * @since 4.0.0
     */
    @NonNull
    @Override
    public Collection<String> supportedTypes() {
        return Collections.emptyList();
    }
}
