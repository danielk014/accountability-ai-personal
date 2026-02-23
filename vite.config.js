import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [
      base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        // These are dev-only tools — disable in production so the Base44 platform
        // agent doesn't run in the deployed app and interfere with user sessions/data.
        hmrNotifier: isDev,
        navigationNotifier: isDev,
        visualEditAgent: isDev,
      }),
      react(),
    ]
  };
});
