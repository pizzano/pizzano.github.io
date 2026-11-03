package no.siparis.admin;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    // The repository's CNAME is bestill.online. The previous URL redirects
    // here, and the old allowlist incorrectly opened that redirect in Opera.
    private static final String ADMIN_URL = "https://bestill.online/demo/admin.html";

    private WebView webView;
    private ProgressBar loadProgress;

    private static boolean isAppSite(Uri uri) {
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        String host = uri.getHost();
        return host != null && (
            "bestill.online".equalsIgnoreCase(host)
            || "www.bestill.online".equalsIgnoreCase(host)
            || "pizzano.github.io".equalsIgnoreCase(host)
        );
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(19, 59, 43));
        getWindow().setNavigationBarColor(Color.BLACK);

        FrameLayout shell = new FrameLayout(this);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        shell.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        loadProgress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loadProgress.setMax(100);
        loadProgress.setProgressTintList(ColorStateList.valueOf(Color.rgb(31, 130, 80)));
        loadProgress.setProgressBackgroundTintList(ColorStateList.valueOf(Color.TRANSPARENT));
        FrameLayout.LayoutParams progressLayout = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP
        );
        shell.addView(loadProgress, progressLayout);

        // Keep navigation and recovery inside the APK when the main page fails.
        FrameLayout errorPane = new FrameLayout(this);
        errorPane.setBackgroundColor(Color.rgb(249, 249, 249));
        errorPane.setVisibility(View.GONE);
        LinearLayout recovery = new LinearLayout(this);
        recovery.setOrientation(LinearLayout.VERTICAL);
        recovery.setGravity(Gravity.CENTER);
        recovery.setPadding(dp(28), dp(20), dp(28), dp(20));
        TextView errorMessage = new TextView(this);
        errorMessage.setText("Kan ikke åpne adminpanelet. Kontroller internett og prøv igjen.");
        errorMessage.setTextColor(Color.rgb(38, 43, 40));
        errorMessage.setTextSize(16);
        errorMessage.setGravity(Gravity.CENTER);
        recovery.addView(errorMessage, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        Button retry = new Button(this);
        retry.setText("Prøv igjen");
        LinearLayout.LayoutParams retryLayout = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        retryLayout.topMargin = dp(18);
        recovery.addView(retry, retryLayout);
        errorPane.addView(recovery, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        shell.addView(errorPane, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        retry.setOnClickListener(view -> {
            errorPane.setVisibility(View.GONE);
            webView.loadUrl(ADMIN_URL);
        });
        setContentView(shell);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int progress) {
                loadProgress.setProgress(progress);
                loadProgress.setVisibility(progress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) {
                errorPane.setVisibility(View.GONE);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // Ignore failed images/secondary requests; only the main page needs recovery UI.
                if (!request.isForMainFrame()) return;
                loadProgress.setVisibility(View.GONE);
                errorPane.setVisibility(View.VISIBLE);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isAppSite(uri)) return false; // Keep our site inside the APK.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { }
                return true;
            }
        });
        if (savedState == null) webView.loadUrl(ADMIN_URL);
        else if (webView.restoreState(savedState) == null) webView.loadUrl(ADMIN_URL);
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
