import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ambulancia.app',
  appName: 'Diárias Ambulância',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
