import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Bolão Arena Barra Mares",
        short_name: "Bolão Arena",
        description: "Bolão do 5º torneio de equipes da Arena Barra Mares",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#71432D",
        background_color: "#71432D",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: { navigateFallback: "/index.html" },
    }),
  ],
});
