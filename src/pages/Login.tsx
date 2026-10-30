import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase.ts';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session)
      setMessage('Compte créé. Confirme ton adresse e-mail, puis connecte-toi.');
    setBusy(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-navy-950 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-navy-950">Resale Bot</h1>
        <div>
          <label className="label" htmlFor="email">Adresse e-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pwd">Mot de passe</label>
          <input id="pwd" className="input" type="password" minLength={8} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {message && <p className="text-sm text-warn">{message}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
        </button>
        <button type="button" className="btn btn-ghost w-full"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Créer un compte' : "J'ai déjà un compte"}
        </button>
      </form>
    </div>
  );
}
