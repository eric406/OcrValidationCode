import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "OCR Auto Fill",
  version: "0.1.0",
  permissions: ["storage", "offscreen"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ],
  options_page: "src/options/index.html",
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  web_accessible_resources: [
    {
      matches: ["<all_urls>"],
      resources: [
        "tesseract/worker.min.js",
        "tesseract-core/*",
        "tessdata/*"
      ]
    }
  ]
});
