import axios from "axios";

const API_URL = (import.meta.env.DEV ? "" : import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const API = axios.create({
  baseURL: `${API_URL}/api`,
});

export default API;
