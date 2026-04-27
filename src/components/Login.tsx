import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useGameStore } from '../store/gameStore';

export function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { setCredentials } = useGameStore();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegistering && !username) return;
    
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        // Simple client-side check for alphanumeric username
        if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
          throw new Error('Usuário deve conter apenas letras, números e underlines.');
        }
        
        const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) {
           throw new Error('Esse nome de usuário já está em uso.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update Firebase Auth Profile
        await updateProfile(user, { displayName: username });
        
        // Save to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          username,
          email: user.email,
          createdAt: Date.now(),
          coins: 10000
        });

        setCredentials(username, 10000);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch username & coins
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
           const data = userDoc.data();
           setCredentials(data.username || user.displayName || `Jogador_${Math.floor(Math.random() * 1000)}`, data.coins ?? 10000);
        } else {
           setCredentials(user.displayName || `Jogador_${Math.floor(Math.random() * 1000)}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciais inválidas. Tente novamente.');
      } else {
        setError(err.message || 'Ocorreu um erro ao autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0c0a1f] text-white p-4">
      <div className="absolute inset-0 bg-gradient-to-tr from-[#581cff]/20 to-[#ff1c9d]/20 backdrop-blur-3xl z-0"></div>
      <div className="absolute inset-0 opacity-20 mix-blend-overlay z-0" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px'}}></div>
      
      <div className="w-full max-w-md p-8 glass-panel border border-white/20 rounded-3xl relative z-10 shadow-[0_0_50px_rgba(255,28,157,0.15)] flex flex-col items-center">
        
        <div className="w-20 h-20 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-2xl rotate-12 flex items-center justify-center mb-8 shadow-xl shadow-pink-500/20 shadow-inner border border-white/20">
           <div className="w-16 h-16 bg-[#0c0a1f] rounded-xl -rotate-12 flex items-center justify-center">
             <span className="font-['Anton'] text-2xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">LUDO</span>
           </div>
        </div>

        <h2 className="text-2xl font-black mb-6 uppercase tracking-widest">{isRegistering ? 'Criar Conta' : 'Acessar Conta'}</h2>
        
        {error && (
          <div className="w-full bg-red-500/20 border border-red-500/50 text-red-200 text-sm px-4 py-3 rounded-xl mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
              placeholder="seu@email.com"
              required
            />
          </div>

          {isRegistering && (
            <div className="flex flex-col gap-1.5 transition-all">
              <label className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">Login (Usuário)</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
                placeholder="nome_de_usuario"
                required={isRegistering}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold uppercase tracking-widest rounded-2xl py-4 mt-4 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {loading ? 'Aguarde...' : isRegistering ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-white/60">
          {isRegistering ? 'Já possui uma conta?' : 'Ainda não tem conta?'}
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }} 
            className="ml-2 text-pink-400 font-bold hover:text-pink-300 transition-colors uppercase tracking-wider text-xs"
          >
            {isRegistering ? 'Faça Login' : 'Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}
