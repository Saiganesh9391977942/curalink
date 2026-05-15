import axios from "axios";

const API = axios.create({
  baseURL: "https://curalink-j3dq.onrender.com/api",
});

export default API;