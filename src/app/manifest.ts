import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Schooly",
    short_name: "Schooly",
    description: "La plateforme de gestion de votre établissement scolaire.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF6EE",
    theme_color: "#0E2D52",
    lang: "fr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
