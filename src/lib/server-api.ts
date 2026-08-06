const isProd = process.env.NODE_ENV === "production";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (isProd ? "https://chillers.onrender.com/api" : "http://localhost:4000/api");
