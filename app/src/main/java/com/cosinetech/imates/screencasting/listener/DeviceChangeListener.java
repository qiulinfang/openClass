package com.cosinetech.imates.screencasting.listener;

import com.cosinetech.imates.screencasting.model.ClassroomInfo;

/**
 * 设备变化监听器接口
 */
public interface DeviceChangeListener {
    /**
     * 当设备信息发生变化时调用
     * @param change 变化事件信息
     */
    void onDeviceChanged(ClassroomInfo oldInfo, ClassroomInfo newInfo);
}
