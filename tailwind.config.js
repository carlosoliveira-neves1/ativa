import defaultTheme from "tailwindcss/defaultTheme";

const config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0b2f6d",
        "primary-dark": "#061a3c",
        accent: "#31c0b5",
        surface: "#f5f7fb",
      },
      fontFamily: {
        sans: ["Montserrat", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        elevated: "0 20px 45px rgba(6, 26, 60, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
