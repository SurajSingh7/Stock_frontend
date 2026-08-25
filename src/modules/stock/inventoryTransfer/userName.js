export const USER_NAME_KEY = "stock:userName";

export const loadSavedName = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(USER_NAME_KEY) || "";
};

export const saveName = (name) => {
  if (typeof window === "undefined") return;
  if (name && name.trim()) window.localStorage.setItem(USER_NAME_KEY, name.trim());
};
