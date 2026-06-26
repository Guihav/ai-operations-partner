import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.aiworkforce",
  appName: "AI Workforce",
  webDir: ".output/public",
  server: {
    // Para hot-reload em dispositivo durante desenvolvimento, descomente e ajuste:
    // url: "https://09d94df3-b5a9-4212-8b7e-6742ead9cb93.lovableproject.com",
    // cleartext: true,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
