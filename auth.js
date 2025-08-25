/*
  auth.js
  - Gerencia sessão simples no localStorage
  - user = { role: 'jogador'|'espectador', name, age?, classroom? }
*/

(function () {
  const STORAGE_KEY = 'interclasse:user';

  function getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('[ERRO] Falha ao ler usuário', err);
      return null;
    }
  }

  function setUser(user) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (err) {
      console.error('[ERRO] Falha ao salvar usuário', err);
      throw err;
    }
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function requireAuth(redirectTo = 'login.html') {
    const u = getUser();
    if (!u) {
      window.location.replace(redirectTo);
      return null;
    }
    return u;
  }

  window.Auth = { getUser, setUser, clearUser, requireAuth };
})();


