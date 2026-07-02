const API_BASE_URL = process.env.NEXT_PUBLIC_API || 'http://localhost:3001';
const API_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8006";
const API_PORTAL_BACKEND_URL = process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL || "http://localhost:5001/";
const API_BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL_BASE  || "http://localhost:8006";
const API_TINY_MCE = process.env.NEXT_PUBLIC_TINY_MCE || "";
const SHOW_DEV = process.env.NEXT_PUBLIC_SHOW_DEV_MENU === "true";


export {API_BASE_URL,API_BACKEND_URL,API_PORTAL_BACKEND_URL,API_BACKEND_BASE_URL,API_TINY_MCE,SHOW_DEV};
