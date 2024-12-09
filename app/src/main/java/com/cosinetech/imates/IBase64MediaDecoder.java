package com.cosinetech.imates;

import androidx.annotation.NonNull;

public interface IBase64MediaDecoder {
    boolean handles(@NonNull String raw);
}
