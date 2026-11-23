/* Povezava na spletno bazo računov (Supabase).
   URL in "anon/publishable" ključ sta javna podatka in sta namenjena uporabi v aplikaciji;
   dostop do podatkov ščitijo pravila Row Level Security v bazi. */
const APP_CONFIG = {
  supabaseUrl: 'https://miutavwmyeyckmrazgds.supabase.co',
  supabaseKey: 'sb_publishable_aCv6vh94lVHhiIVvJ9HLog_NKEhLCc5',
  // stran, na katero vodijo povezave iz e-pošte (potrditev računa, novo geslo)
  authRedirect: 'https://janznidaric911.github.io/vozni-red-maribor/racun.html',
};
