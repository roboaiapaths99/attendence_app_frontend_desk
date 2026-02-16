/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: "#6366f1", // Indigo
                secondary: "#22d3ee", // Cyan
                background: "#0f172a", // Deep Slate
                card: "rgba(30, 41, 59, 0.7)", // Glassmorphic card
                accent: "#7c3aed", // Violet
            },
        },
    },
    plugins: [],
}
