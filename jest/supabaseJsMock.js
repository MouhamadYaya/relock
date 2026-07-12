// Mock de @supabase/supabase-js pour Jest (le vrai paquet est ESM, non transpilé).
const ok = async () => ({ data: {}, error: null })
function createClient() {
  return {
    auth: {
      signInWithPassword: ok,
      signUp: ok,
      signOut: ok,
      getSession: ok,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({}),
  }
}
module.exports = { createClient }
