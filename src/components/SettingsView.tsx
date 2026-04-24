import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ArrowLeft, User, Mail, Volume2, VolumeX, LogOut, Save, Camera } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

export function SettingsView() {
  const { player, firebaseUser, setView, soundEnabled, setSoundEnabled, setCredentials } = useGameStore();
  const [username, setUsername] = useState(player?.username || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  if (!firebaseUser) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username === player?.username) return;

    if (!/^[a-zA-Z0-9_\-]+$/.test(username)) {
      setMessage({ type: 'error', text: 'Usuário deve conter apenas letras, números e underlines.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // 1. Update Auth Profile
      await updateProfile(firebaseUser, { displayName: username });
      
      // 2. Update Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userRef, { username });
      
      // 3. Update Local Store & Socket
      setCredentials(username);
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('lobby');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-y-auto">
      <div className="p-4 md:p-6 flex items-center justify-between sticky top-0 bg-[#0c0a1f]/80 backdrop-blur z-20">
        <button 
          onClick={() => setView('lobby')}
          className="p-2 glass rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={24} className="text-white" />
        </button>
        <span className="font-['Anton'] text-xl tracking-widest uppercase text-white">Configurações</span>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 w-full max-w-xl mx-auto p-4 md:p-6 flex flex-col gap-8">
        
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden flex flex-col items-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-transparent"></div>
          
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-1 mb-4 relative group cursor-pointer">
            <div className="w-full h-full bg-[#1a1836] rounded-full flex items-center justify-center overflow-hidden relative">
               <User size={40} className="text-white/50" />
               <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <Camera size={24} className="text-white" />
               </div>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white">{player?.username}</h2>
          <p className="text-white/50 text-sm mt-1">{firebaseUser.email}</p>
        </div>

        {/* Global Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">Jogo</h3>
          
          <div className="glass-panel p-2 rounded-2xl">
            <button 
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) { // Only play if turned on
                  import('../lib/sounds').then(({ playSound }) => playSound('click'));
                }
              }}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${soundEnabled ? 'bg-pink-500/20 text-pink-400' : 'bg-white/10 text-white/50'}`}>
                  {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </div>
                <span className="font-bold text-white">Efeitos Sonoros</span>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${soundEnabled ? 'bg-pink-500' : 'bg-white/20'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </div>
            </button>
          </div>
        </div>

        {/* Edit Profile Form */}
        <div className="flex flex-col gap-4">
          <h3 className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">Sua Conta</h3>
          
          <form onSubmit={handleSave} className="glass-panel p-6 rounded-3xl flex flex-col gap-4">
            {message && (
              <div className={`text-sm px-4 py-3 rounded-xl border ${message.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 'bg-red-500/20 border-red-500/50 text-red-200'}`}>
                {message.text}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">Nome de Usuário</label>
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all"
                  placeholder="Seu Apelido"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-white/50 font-bold ml-2">E-mail</label>
              <div className="relative opacity-50 cursor-not-allowed">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="email" 
                  value={firebaseUser.email || ''}
                  disabled
                  className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white cursor-not-allowed"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSaving || username === player?.username}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold uppercase tracking-widest rounded-2xl py-4 mt-2 shadow-[0_10px_20px_rgba(236,72,153,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 font-bold uppercase tracking-widest rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors mb-8"
        >
          <LogOut size={18} />
          Sair da Conta
        </button>

      </div>
    </div>
  );
}
