package com.denk0.workshiftcalendar;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.URLUtil;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ApkDownload")
public class ApkDownloadPlugin extends Plugin {
    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (url.isEmpty()) {
            call.reject("APK url is required.");
            return;
        }

        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
            openInstallPermissionSettings(context);

            JSObject result = new JSObject();
            result.put("started", false);
            result.put("permissionRequired", true);
            call.resolve(result);
            return;
        }

        String requestedFileName = call.getString("fileName", "").trim();
        String fileName = sanitizeFileName(requestedFileName, url);

        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            call.reject("DownloadManager is unavailable.");
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Оновлення Work Shift Calendar");
        request.setDescription("Завантаження APK для встановлення оновлення");
        request.setMimeType("application/vnd.android.package-archive");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setVisibleInDownloadsUi(true);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

        long downloadId = downloadManager.enqueue(request);
        ApkDownloadStore.add(context, downloadId);

        JSObject result = new JSObject();
        result.put("started", true);
        result.put("permissionRequired", false);
        result.put("downloadId", downloadId);
        result.put("fileName", fileName);
        call.resolve(result);
    }

    private static String sanitizeFileName(String requestedFileName, String url) {
        String fileName = requestedFileName;
        if (fileName.isEmpty()) {
            String guessed = URLUtil.guessFileName(url, null, "application/vnd.android.package-archive");
            fileName = guessed == null ? "work-shift-calendar-update.apk" : guessed;
        }

        fileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "-").trim();
        if (!fileName.endsWith(".apk")) {
            fileName = fileName + ".apk";
        }

        return fileName.isEmpty() ? "work-shift-calendar-update.apk" : fileName;
    }

    static void openInstallPermissionSettings(Context context) {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + context.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    static void openDownloadsUi(Context context) {
        Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    @Nullable
    static Uri getDownloadedApkUri(Context context, long downloadId) {
        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            return null;
        }

        return downloadManager.getUriForDownloadedFile(downloadId);
    }
}