package com.denk0.workshiftcalendar;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

final class ApkDownloadStore {
    private static final String PREFS_NAME = "apk-download-store";
    private static final String KEY_DOWNLOAD_IDS = "download-ids";

    private ApkDownloadStore() {}

    static void add(Context context, long downloadId) {
        Set<String> downloadIds = getDownloadIds(context);
        downloadIds.add(String.valueOf(downloadId));
        writeDownloadIds(context, downloadIds);
    }

    static boolean contains(Context context, long downloadId) {
        return getDownloadIds(context).contains(String.valueOf(downloadId));
    }

    static void remove(Context context, long downloadId) {
        Set<String> downloadIds = getDownloadIds(context);
        if (downloadIds.remove(String.valueOf(downloadId))) {
            writeDownloadIds(context, downloadIds);
        }
    }

    private static Set<String> getDownloadIds(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> storedIds = prefs.getStringSet(KEY_DOWNLOAD_IDS, new HashSet<>());
        return new HashSet<>(storedIds);
    }

    private static void writeDownloadIds(Context context, Set<String> downloadIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putStringSet(KEY_DOWNLOAD_IDS, new HashSet<>(downloadIds)).apply();
    }
}