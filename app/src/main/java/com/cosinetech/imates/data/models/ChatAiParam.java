package com.cosinetech.imates.data.models;

import android.os.Parcel;
import android.os.Parcelable;

public class ChatAiParam implements Parcelable {
    public String chatBotUrl;
    public boolean showHeader;
    public boolean streamDisplay;
    public boolean showHistory;
    public boolean initialSendEnable;

    public boolean showTeacherSessionOnly;
    public ChatAiParam() {
    }

    protected ChatAiParam(Parcel in) {
        chatBotUrl = in.readString();
        showHeader = in.readByte() != 0;
        streamDisplay = in.readByte() != 0;
        showHistory = in.readByte() != 0;
        initialSendEnable = in.readByte() != 0;
        showTeacherSessionOnly = in.readByte() != 0;
    }

    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeString(chatBotUrl);
        dest.writeByte((byte) (showHeader ? 1 : 0));
        dest.writeByte((byte) (streamDisplay ? 1 : 0));
        dest.writeByte((byte) (showHistory ? 1 : 0));
        dest.writeByte((byte) (initialSendEnable ? 1 : 0));
        dest.writeByte((byte) (showTeacherSessionOnly ? 1 : 0));
    }

    @Override
    public int describeContents() {
        return 0;
    }

    public static final Creator<ChatAiParam> CREATOR = new Creator<ChatAiParam>() {
        @Override
        public ChatAiParam createFromParcel(Parcel in) {
            return new ChatAiParam(in);
        }

        @Override
        public ChatAiParam[] newArray(int size) {
            return new ChatAiParam[size];
        }
    };
}
