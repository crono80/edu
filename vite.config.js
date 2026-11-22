import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base relativa: o build funciona em qualquer caminho.
// O app logado vive em /app/ (app/index.html). A raiz, /inss/, /vendas/ (redirect), /privacidade/,
// robots.txt, sitemap.xml e 404.html são estáticos em public/ e vão para dist/ como estão.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { input: { app: resolve(__dirname, "app/index.html") } } },
});
