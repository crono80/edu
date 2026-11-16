// Public configuration. The OAuth client id is not a secret (it ships in every page that uses Google login).
// Empty = the "Sincronizar com Google Agenda" button stays hidden.
export const GOOGLE_CLIENT_ID = "32512512170-m8ht04ls3o3mr1sfdoqiihno0c9egbv1.apps.googleusercontent.com";
// Planned blocks sent to Google per sync (studied blocks always go). Re-syncing moves the window forward.
export const GOOGLE_SYNC_DAYS = 56;
