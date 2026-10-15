import type { MetadataRoute } from "next";

/**
 * Web App Manifest — memberi tahu browser bahwa ASETA bisa dipasang sebagai
 * aplikasi (PWA) lewat menu "Install app" di Chrome/Edge Android.
 *
 * File konvensi metadata: otomatis diekspos sebagai `/manifest.webmanifest`.
 * `start_url` mengarah ke Beranda karena landing `/` hanya berisi halaman
 * promosi, sedangkan aplikasi yang sudah terpasang harus langsung masuk ke
 * experience utama.
 *
 * Catatan: ikon memakai `/favicon.ico`, yang bersumber dari `app/favicon.ico`
 * (file konvensi metadata Next otomatis disajikan di root path) — bukan
 * `public/favicon.ico` yang memang tidak ada di repo ini.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ASETA — Naga Penjelajah Asetmu",
    short_name: "ASETA",
    description: "Aplikasi finansial dan investasi terkelola berbasis gamifikasi.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
