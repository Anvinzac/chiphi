export const ADMIN_USERNAME = "admin";
export const ADMIN_EMAIL = "admin@mise.local";
export const ADMIN_PASSWORD = "AdminDemo2024!";

/** Prefill and show admin credentials only in local Vite — never a production build. */
export const LOCAL_ADMIN_LOGIN_VISIBLE = import.meta.env.DEV;
