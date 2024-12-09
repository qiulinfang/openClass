package com.cosinetech.imates;

import androidx.annotation.NonNull;

import java.io.InputStream;
import java.util.jar.Attributes;

public interface IBase64SchemeHandler {
    @NonNull
    InputStream handle(@NonNull String raw, @NonNull Attributes attributes);
}
