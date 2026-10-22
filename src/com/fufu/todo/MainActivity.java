package com.fufu.todo;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.AtomicFile;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.MimeTypeMap;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView web;
    private File images;
    private AtomicFile store;
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private static MainActivity active;
    private static volatile JSONArray pickedImages;
    private static String pickMessage;
    private static String pickToken;
    private static volatile boolean importing;
    private volatile boolean picking;
    private boolean pageReady;
    private static final String IMAGE_NAME = "[0-9a-f-]{36}\\.[a-z0-9]{2,5}";
    private final long startedAt = SystemClock.elapsedRealtime();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        active = this;
        picking = savedInstanceState != null && savedInstanceState.getBoolean("picking");
        images = new File(getFilesDir(), "images");
        images.mkdirs();
        store = new AtomicFile(new File(getFilesDir(), "tasks.json"));
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(252, 252, 254));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        Matcher chrome = Pattern.compile("Chrome/(\\d+)").matcher(settings.getUserAgentString());
        if (chrome.find() && Integer.parseInt(chrome.group(1)) < 90) {
            new AlertDialog.Builder(this).setTitle("请更新系统组件")
                .setMessage("请先在应用商店更新 Android System WebView（安卓系统网页组件），再打开夫夫清单。此设备当前的组件版本过旧。")
                .setPositiveButton("知道了", (dialog, which) -> finish()).setCancelable(false).show();
            return;
        }
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(100);
        web.setBackgroundColor(Color.rgb(252, 252, 254));
        web.addJavascriptInterface(new Bridge(), "NativeBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                deliverImages();
                view.postVisualStateCallback(1, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) {
                        reportFullyDrawn();
                        Log.i("FufuList", "Content ready in " + (SystemClock.elapsedRealtime() - startedAt) + " ms");
                    }
                });
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return resource(request.getUrl());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("删除", (dialog, which) -> result.confirm())
                    .setNegativeButton("取消", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("知道了", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.confirm()).show();
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        web.loadUrl("https://fufu.local/index.html");
    }

    private WebResourceResponse resource(Uri uri) {
        try {
            if (!"https".equals(uri.getScheme()) || !"fufu.local".equals(uri.getHost())) return missing();
            String path = uri.getPath();
            if (path != null && path.startsWith("/images/")) {
                String name = path.substring(8);
                if (!name.matches(IMAGE_NAME)) return missing();
                String extension = name.substring(name.lastIndexOf('.') + 1);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                return new WebResourceResponse(mime == null ? "image/jpeg" : mime, null,
                    new FileInputStream(new File(images, name)));
            }
            String name = "/".equals(path) ? "index.html" : path.substring(1);
            if (!name.matches("index\\.html|style\\.css|core\\.js|calendar\\.js|app\\.js|THIRD_PARTY_NOTICES\\.txt")) return missing();
            String mime = name.endsWith("html") ? "text/html" : name.endsWith("css") ? "text/css"
                : name.endsWith("js") ? "application/javascript" : "text/plain";
            return new WebResourceResponse(mime, "UTF-8", getAssets().open(name));
        } catch (Exception error) {
            return missing();
        }
    }

    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
            new ByteArrayInputStream(new byte[0]));
    }

    private class Bridge {
        @JavascriptInterface public synchronized String loadState() {
            if (!store.getBaseFile().exists() && !new File(store.getBaseFile() + ".bak").exists()) return "";
            try (InputStream input = store.openRead(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                copy(input, out);
                return new String(out.toByteArray(), StandardCharsets.UTF_8);
            } catch (Exception error) {
                return "!READ_ERROR!";
            }
        }
        @JavascriptInterface public synchronized String saveState(String raw) {
            FileOutputStream stream = null;
            try {
                new JSONObject(raw).getJSONArray("tasks");
                stream = store.startWrite();
                stream.write(raw.getBytes(StandardCharsets.UTF_8));
                store.finishWrite(stream);
                cleanImages(raw);
                return "ok";
            } catch (Exception error) {
                if (stream != null) store.failWrite(stream);
                return "error";
            }
        }
        @JavascriptInterface public synchronized void cleanImages(String raw) {
            try {
                JSONArray tasks = new JSONObject(raw).getJSONArray("tasks");
                Set<String> used = new HashSet<>();
                for (int i = 0; i < tasks.length(); i++) {
                    JSONArray attached = tasks.getJSONObject(i).optJSONArray("images");
                    if (attached != null) for (int j = 0; j < attached.length(); j++) used.add(attached.getString(j));
                }
                File[] local = images.listFiles();
                if (local != null) for (File file : local) {
                    if (file.getName().matches(IMAGE_NAME) && !used.contains(file.getName())) file.delete();
                }
            } catch (Exception error) {
                // Invalid state must never delete a user's files.
            }
        }
        @JavascriptInterface public void pickImages() {
            runOnUiThread(() -> {
                picking = true;
                ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(web.getWindowToken(), 0);
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(intent, 10); }
                catch (Exception error) { picking = false; finishPicking(new JSONArray(), "暂时无法打开图片选择器"); }
            });
        }
        @JavascriptInterface public boolean isPicking() { return picking || importing || pickedImages != null; }
        @JavascriptInterface public void showKeyboard() {
            runOnUiThread(() -> web.postDelayed(() -> {
                if (!isFinishing()) ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).showSoftInput(web, InputMethodManager.SHOW_IMPLICIT);
            }, 120));
        }
        @JavascriptInterface public void hideKeyboard() {
            runOnUiThread(() -> ((InputMethodManager) getSystemService(INPUT_METHOD_SERVICE))
                .hideSoftInputFromWindow(web.getWindowToken(), 0));
        }
    }

    private static void copy(InputStream input, java.io.OutputStream output) throws IOException {
        byte[] buffer = new byte[65536];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
    }

    private String importImage(Uri uri) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(input, null, bounds);
        }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("Unsupported image");
        String extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(bounds.outMimeType);
        if (extension == null || !extension.matches("[a-z0-9]{2,5}")) extension = "jpg";
        String name = UUID.randomUUID().toString() + "." + extension;
        File file = new File(images, name);
        try (InputStream input = getContentResolver().openInputStream(uri);
             FileOutputStream output = new FileOutputStream(file)) {
            copy(input, output);
            output.getFD().sync();
        } catch (IOException error) {
            file.delete();
            throw error;
        }
        return name;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != 10) return;
        picking = false;
        if (resultCode != RESULT_OK || data == null) { finishPicking(new JSONArray(), ""); return; }
        ArrayList<Uri> selected = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) for (int i = 0; i < clip.getItemCount(); i++) selected.add(clip.getItemAt(i).getUri());
        else if (data.getData() != null) selected.add(data.getData());
        importing = true;
        files.execute(() -> {
            JSONArray imported = new JSONArray();
            int failed = 0;
            for (Uri uri : selected) {
                try { imported.put(importImage(uri)); }
                catch (Exception error) { failed++; }
            }
            final String message = failed == 0 ? "" : "部分图片未能读取，请重试";
            runOnUiThread(() -> finishPicking(imported, message));
        });
    }

    private static void finishPicking(JSONArray result, String message) {
        pickedImages = result;
        pickMessage = message;
        pickToken = UUID.randomUUID().toString();
        importing = false;
        if (active != null) active.deliverImages();
    }

    private void deliverImages() {
        if (!pageReady || pickedImages == null || isFinishing() || isDestroyed()) return;
        final String token = pickToken;
        String script = "window.onImagesPicked(" + pickedImages + "," + JSONObject.quote(pickMessage) + "," + JSONObject.quote(token) + ")";
        web.evaluateJavascript(script, accepted -> {
            if ("true".equals(accepted) && token.equals(pickToken)) pickedImages = null;
        });
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("picking", picking);
        super.onSaveInstanceState(state);
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.handleBack && window.handleBack()", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    @Override protected void onDestroy() {
        if (active == this) active = null;
        pageReady = false;
        files.shutdown();
        web.removeJavascriptInterface("NativeBridge");
        web.destroy();
        super.onDestroy();
    }
}
