import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { Lobby } from './components/Lobby';
import { RoomView } from './components/RoomView';
import { CoinStore } from './components/CoinStore';
import { Leaderboard } from './components/Leaderboard';
import { Login } from './components/Login';
import { SettingsView } from './components/SettingsView';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';

export default function App() {
  const { connect, view, setFirebaseUser, setAuthReady, isAuthReady, setCredentials, firebaseUser } = useGameStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        // Hydrate username and coins
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCredentials(data.username || user.displayName, data.coins ?? 10000);
          } else {
            setCredentials(user.displayName || "Jogador", 10000);
          }
        } catch (e) {
          console.error("Error fetching user data", e);
          setCredentials(user.displayName || "Jogador", 10000);
        }
        connect();
      }
      
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [connect, setFirebaseUser, setAuthReady, setCredentials]);

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0a1f] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="font-['Anton'] tracking-widest uppercase text-pink-500 text-xl animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Login />;
  }

  let Content;
  switch (view) {
    case 'store':
      Content = <CoinStore />;
      break;
    case 'room':
      Content = <RoomView />;
      break;
    case 'leaderboard':
      Content = <Leaderboard />;
      break;
    case 'settings':
      Content = <SettingsView />;
      break;
    case 'lobby':
    default:
      Content = <Lobby />;
      break;
  }

  return (
    <div className="w-full h-full bg-[#0c0a1f] min-h-screen relative overflow-hidden">
      <div className="bg-mesh fixed inset-0"></div>
      <div className="relative z-10 w-full h-full">
        {Content}
      </div>
    </div>
  );
}
