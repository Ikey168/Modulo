import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.modulo',
  appName: 'Modulo',
  webDir: '../../frontend/dist',
  android: { allowMixedContent: false },
};

export default config;
