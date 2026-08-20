package com.trileza.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Disable edge-to-edge behavior to prevent app content from overlapping the status bar.
        // This is especially important for apps targeting Android 15 (SDK 35) and above.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        
        super.onCreate(savedInstanceState);
        
        // Ensure the root view applies padding for system bars (Status Bar and Navigation Bar).
        View root = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });
    }
}
