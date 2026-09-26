package com.modulo;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ModuloStateCachePlugin.class);
        // Keystore-backed credential storage for the OIDC refresh token (#488).
        registerPlugin(ModuloSecureStorePlugin.class);
        // Owns bar appearance and the IME inset; see ShellWindowPlugin.
        registerPlugin(ShellWindowPlugin.class);
        // Share-to-Modulo, system save and share sheet (#493).
        registerPlugin(ModuloSharePlugin.class);
        // Local reminder notifications (#494).
        registerPlugin(ModuloRemindersPlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        // Draw behind the system bars. Android 15 enforces this for apps
        // targeting SDK 35+ anyway; asking for it explicitly means the same
        // layout on every supported release rather than two different ones.
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        // Without this the IME padding flashes white on every keyboard open.
        getBridge().getWebView().setBackgroundColor(Color.parseColor("#151414"));
    }
}
