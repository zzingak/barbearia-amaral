import type { Config } from "tailwindcss";

// Para mudar as cores do site inteiro, edite apenas a paleta "brand" abaixo.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f7f5f2",
          100: "#ece7e0",
          500: "#8a6d4b",
          600: "#735a3d",
          900: "#1c1917",
        },
      },
      fontFamily: { sans: ["system-ui", "Segoe UI", "Roboto", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
