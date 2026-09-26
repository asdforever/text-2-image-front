/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ps: {
          950: "#121417",
          900: "#1b1e22",
          850: "#24282d",
          800: "#2d3238",
          700: "#454c54",
          500: "#858d96",
          300: "#c9ced3",
          100: "#edf0f2",
        },
      },
      spacing: {
        1: "0.2rem",
        2: "0.4rem",
        3: "0.6rem",
        4: "0.8rem",
        5: "1rem",
        6: "1.2rem",
        8: "1.6rem",
        10: "2rem",
        12: "2.4rem",
        18: "0.9rem",
        22: "1.1rem",
      },
    },
  },
  plugins: [],
};
