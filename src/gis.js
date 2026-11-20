// Loads Google Identity Services once (used by the login and by the Google Agenda sync).
const GIS_SRC = "https://accounts.google.com/gsi/client";
let loading = null;

export function loadGis() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id && window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      loading = null;
      reject(new Error("Não foi possível carregar o login do Google."));
    };
    document.head.append(s);
  });
  return loading;
}
