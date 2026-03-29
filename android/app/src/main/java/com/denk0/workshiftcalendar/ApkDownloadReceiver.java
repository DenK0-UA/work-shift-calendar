package com.denk0.workshiftcalendar;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;

public class ApkDownloadReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) {
            return;
        }

        long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        if (downloadId <= 0 || !ApkDownloadStore.contains(context, downloadId)) {
            return;
        }

        ApkDownloadStore.remove(context, downloadId);

        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = downloadManager.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                ApkDownloadPlugin.openDownloadsUi(context);
                return;
            }

            int statusColumn = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int status = statusColumn >= 0 ? cursor.getInt(statusColumn) : DownloadManager.STATUS_FAILED;
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                ApkDownloadPlugin.openDownloadsUi(context);
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
                ApkDownloadPlugin.openInstallPermissionSettings(context);
                return;
            }

            Uri apkUri = ApkDownloadPlugin.getDownloadedApkUri(context, downloadId);
            if (apkUri == null) {
                ApkDownloadPlugin.openDownloadsUi(context);
                return;
            }

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

            try {
                context.startActivity(installIntent);
            } catch (Exception error) {
                ApkDownloadPlugin.openDownloadsUi(context);
            }
        }
    }
}