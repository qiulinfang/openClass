package com.cosinetech.imates;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import androidx.viewpager2.adapter.FragmentStateAdapter;

import java.util.ArrayList;
import java.util.List;

public class SubjectViewAdapter extends FragmentStateAdapter {
    List<Fragment> mSubjectFragments = null;
    public SubjectViewAdapter(@NonNull FragmentActivity fragmentActivity, List<Fragment> fragments) {
        super(fragmentActivity);
        mSubjectFragments = fragments;
    }

    @NonNull
    @Override
    public Fragment createFragment(int position) {
        // 根据位置创建不同的 Fragment
        return mSubjectFragments.get(position);
    }

    @Override
    public int getItemCount() {
        return mSubjectFragments.size();
    }
}
