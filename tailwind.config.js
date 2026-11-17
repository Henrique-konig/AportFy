// Configuração do Tailwind usada para gerar o css/tailwind.css (npm run build:css).
// É a mesma que antes ficava no index.html, quando o Tailwind rodava no navegador pelo CDN.
// O Tailwind lê as classes usadas no index.html e em todos os arquivos de js/ e
// gera só o CSS que o app usa (bem menor, e sem compilar nada na hora de abrir).

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Paleta preta com detalhes vibrantes (inspirada no roxo do Nubank).
        slate: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3a3a42", 800: "#1f1f26", 900: "#0e0e12", 950: "#000000" },
        blue: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8a6f7", 400: "#bb6af0", 500: "#9a2be2", 600: "#860ad3", 700: "#6d06ab", 800: "#560587", 900: "#3b035c", 950: "#25023a" },
        purple: { 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d" },
        couple: {
          50: "#fdf2f8",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
      },
    },
  },
};
