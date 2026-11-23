/* =====================================================================
   Računi uporabnikov (Supabase Auth + tabela "profiles") — brez knjižnic, samo fetch
   Acc.configured, Acc.user, Acc.profile, Acc.signUp(), Acc.signIn(), Acc.signOut(),
   Acc.reset(), Acc.load(), Acc.save(), Acc.on(fn)
   ===================================================================== */
(function () {
  'use strict';
  const CFG = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : {};
  const URL0 = (CFG.supabaseUrl || '').replace(/\/+$/, ''), KEY = CFG.supabaseKey || '';
  const LS_AUTH = 'vr-auth', LS_PROF = 'vr-profile';
  const listeners = [];
  const ls = {
    get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const Acc = {
    configured: !!(URL0 && KEY),
    session: ls.get(LS_AUTH),
    profile: ls.get(LS_PROF),
    syncing: false, lastSync: 0, error: null,
    get user() { return this.session && this.session.user ? this.session.user : null; },
    get loggedIn() { return !!(this.session && this.session.access_token); },
    on(fn) { listeners.push(fn); },
  };
  const emit = () => listeners.forEach(fn => { try { fn(Acc); } catch (e) {} });

  const MSG = {
    invalid_credentials: 'Napačen e-naslov ali geslo.',
    email_not_confirmed: 'E-naslov še ni potrjen. Klikni povezavo v e-pošti, nato se prijavi.',
    user_already_exists: 'Račun s tem e-naslovom že obstaja. Prijavi se.',
    email_exists: 'Račun s tem e-naslovom že obstaja. Prijavi se.',
    weak_password: 'Geslo je prešibko – uporabi vsaj 8 znakov, tudi številke.',
    over_email_send_rate_limit: 'Poslanih je bilo preveč e-sporočil. Poskusi čez nekaj minut.',
    over_request_rate_limit: 'Preveč poskusov. Počakaj trenutek in poskusi znova.',
    validation_failed: 'Preveri vnesene podatke.',
    email_address_invalid: 'E-naslov ni veljaven.',
    signup_disabled: 'Registracija je trenutno onemogočena.',
  };
  function errText(j, status) {
    if (!navigator.onLine) return 'Ni internetne povezave.';
    const code = j && (j.error_code || j.code || j.error);
    if (code && MSG[code]) return MSG[code];
    const m = j && (j.msg || j.message || j.error_description || '');
    if (/password/i.test(m) && /at least|short|weak/i.test(m)) return MSG.weak_password;
    if (/already registered/i.test(m)) return MSG.user_already_exists;
    if (/invalid login/i.test(m)) return MSG.invalid_credentials;
    if (/not confirmed/i.test(m)) return MSG.email_not_confirmed;
    if (/rate limit/i.test(m)) return MSG.over_email_send_rate_limit;
    return m ? 'Napaka: ' + m : 'Strežnik ni odgovoril (' + (status || '?') + ').';
  }

  async function req(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
    const h = Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, headers);
    if (auth) {
      await ensureFresh();
      if (Acc.session) h.Authorization = 'Bearer ' + Acc.session.access_token;
    }
    let r;
    try { r = await fetch(URL0 + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { return { ok: false, status: 0, json: null }; }
    let json = null;
    try { const t = await r.text(); json = t ? JSON.parse(t) : null; } catch (e) {}
    return { ok: r.ok, status: r.status, json };
  }

  function setSession(j) {
    if (!j || !j.access_token) return false;
    Acc.session = {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in || 3600) * 1000,
      user: { id: j.user.id, email: j.user.email, name: (j.user.user_metadata || {}).name || '' },
    };
    ls.set(LS_AUTH, Acc.session);
    return true;
  }
  let refreshing = null;
  async function ensureFresh() {
    const s = Acc.session;
    if (!s || !s.refresh_token || s.expires_at - Date.now() > 60000) return;
    if (!refreshing) {
      refreshing = (async () => {
        let r;
        try { r = await fetch(URL0 + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) }); }
        catch (e) { return; }
        const j = await r.json().catch(() => null);
        if (r.ok && j) setSession(j);
        else if (r.status === 400 || r.status === 401) { Acc.session = null; ls.set(LS_AUTH, null); emit(); }
      })().finally(() => { refreshing = null; });
    }
    await refreshing;
  }

  const redirect = () => CFG.authRedirect ? '?redirect_to=' + encodeURIComponent(CFG.authRedirect) : '';

  Acc.signUp = async (email, password, name, avatar) => {
    if (!Acc.configured) return { ok: false, error: 'Računi še niso nastavljeni.' };
    const r = await req('/auth/v1/signup' + redirect(), { method: 'POST', body: { email, password, data: { name } } });
    if (!r.ok) return { ok: false, error: errText(r.json, r.status) };
    Acc.pending = { name, avatar };
    ls.set('vr-pending', { email, name, avatar });
    if (setSession(r.json)) { await Acc.load({ name, avatar }); emit(); return { ok: true }; }
    // če je potrjevanje vklopljeno, Supabase za obstoječ e-naslov vrne uporabnika brez identitet
    if (r.json && r.json.identities && r.json.identities.length === 0) return { ok: false, error: MSG.user_already_exists };
    return { ok: true, needsConfirm: true };
  };

  Acc.signIn = async (email, password) => {
    if (!Acc.configured) return { ok: false, error: 'Računi še niso nastavljeni.' };
    const r = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    if (!r.ok || !setSession(r.json)) return { ok: false, error: errText(r.json, r.status) };
    const pend = ls.get('vr-pending');
    await Acc.load(pend && pend.email === email ? { name: pend.name, avatar: pend.avatar } : null);
    ls.set('vr-pending', null);
    emit();
    return { ok: true };
  };

  Acc.reset = async email => {
    if (!Acc.configured) return { ok: false, error: 'Računi še niso nastavljeni.' };
    const r = await req('/auth/v1/recover' + redirect(), { method: 'POST', body: { email } });
    return r.ok ? { ok: true } : { ok: false, error: errText(r.json, r.status) };
  };

  Acc.signOut = async () => {
    const s = Acc.session;
    Acc.session = null; Acc.profile = null;
    ls.set(LS_AUTH, null); ls.set(LS_PROF, null);
    emit();
    if (s) { try { await fetch(URL0 + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }); } catch (e) {} }
  };

  const blank = () => ({ name: '', avatar: null, points: 0, lifetime: 0, data: { recents: [], routeCounts: {}, favs: [], tickets: [], history: [], purchases: 0 } });

  /* Prenese profil (ali ga ustvari ob prvi prijavi) */
  Acc.load = async seed => {
    if (!Acc.loggedIn) return null;
    Acc.syncing = true; emit();
    const uid = Acc.user.id;
    const r = await req('/rest/v1/profiles?id=eq.' + uid + '&select=*', { auth: true });
    Acc.syncing = false;
    if (!r.ok) {
      if (r.status === 401) { Acc.session = null; ls.set(LS_AUTH, null); }
      Acc.error = r.status ? 'Sinhronizacija ni uspela (' + r.status + ').' : 'Ni povezave – podatki bodo shranjeni, ko bo internet spet na voljo.';
      emit(); return Acc.profile;
    }
    Acc.error = null;
    let p = r.json && r.json[0];
    if (!p) {
      p = Object.assign(blank(), { name: (seed && seed.name) || Acc.user.name || Acc.user.email.split('@')[0], avatar: (seed && seed.avatar) || null });
      Acc.profile = p; await push(true);
    } else {
      p.data = Object.assign(blank().data, p.data || {});
      Acc.profile = p;
    }
    Acc.lastSync = Date.now();
    ls.set(LS_PROF, Acc.profile);
    emit();
    return Acc.profile;
  };

  let pushT = null, dirty = false;
  async function push(now) {
    if (!Acc.loggedIn || !Acc.profile) return;
    const p = Acc.profile;
    const body = { id: Acc.user.id, name: p.name, avatar: p.avatar, points: p.points | 0, lifetime: p.lifetime | 0, data: p.data, updated_at: new Date().toISOString() };
    const r = await req('/rest/v1/profiles', { method: 'POST', auth: true, body, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    if (r.ok) { dirty = false; Acc.error = null; Acc.lastSync = Date.now(); }
    else { dirty = true; Acc.error = r.status ? 'Shranjevanje ni uspelo (' + r.status + ').' : 'Ni povezave – shranim, ko bo internet na voljo.'; }
    if (!now) emit();
  }
  /* Lokalna sprememba profila; v bazo se zapiše z zamikom */
  Acc.save = mutate => {
    if (!Acc.profile) return;
    if (mutate) mutate(Acc.profile);
    ls.set(LS_PROF, Acc.profile);
    dirty = true;
    clearTimeout(pushT);
    pushT = setTimeout(() => push(), 800);
    emit();
  };
  window.addEventListener('online', () => { if (dirty) push(); });

  window.Acc = Acc;
})();
