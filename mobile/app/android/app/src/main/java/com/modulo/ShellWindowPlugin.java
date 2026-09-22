package com.modulo;

import android.view.View;
import android.view.Window;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The two things the packaged window has to tell the web app, and vice versa.
 *
 * <p><b>Bar appearance.</b> The window is edge to edge, so what sits behind the
 * status and navigation bars is the web app's own surface. Only the web app
 * knows whether that surface is Modulo's dark canvas or one of its light
 * themes, and the system will happily draw white icons on a white app bar if
 * nobody tells it otherwise.
 *
 * <p><b>The keyboard.</b> Edge to edge also means the window no longer resizes
 * itself for the IME. This plugin insets the WebView instead — which is what
 * keeps the focused field on screen — and reports the same inset to the page,
 * because after that resize the page can no longer detect the keyboard by
 * comparing viewport heights: both shrank together.
 */
@CapacitorPlugin(name = "ModuloShellWindow")
public class ShellWindowPlugin extends Plugin {

    private int lastReportedCssPx = -1;

    @Override
    public void load() {
        final View webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, insets) -> {
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(0, 0, 0, ime.bottom);
            reportKeyboard(ime.bottom);
            return insets;
        });
    }

    private void reportKeyboard(int devicePx) {
        float density = getContext().getResources().getDisplayMetrics().density;
        int cssPx = density > 0 ? Math.round(devicePx / density) : devicePx;
        if (cssPx == lastReportedCssPx) return;
        lastReportedCssPx = cssPx;
        JSObject payload = new JSObject();
        payload.put("height", cssPx);
        notifyListeners("keyboardInsetChange", payload, true);
    }

    /** @param dark true when the app is painting a dark canvas behind the bars. */
    @PluginMethod
    public void setAppearance(final PluginCall call) {
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", Boolean.TRUE));
        final Window window = getActivity().getWindow();
        getActivity().runOnUiThread(() -> {
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, window.getDecorView());
            controller.setAppearanceLightStatusBars(!dark);
            controller.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
