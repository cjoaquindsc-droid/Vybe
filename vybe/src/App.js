import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si el usuario está logueado
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: '50px' }}>Cargando...</div>;
  }

  if (!user) {
    // Usuario NO está logueado, mostrar Login
    return <Login onLoginSuccess={() => setUser(auth.currentUser)} />;
  }

  // Usuario ESTÁ logueado, mostrar dashboard
  return (
    <div className="App">
      <header className="App-header">
        <h1>Bienvenido a VYBE, {user.email}</h1>
        <button onClick={() => auth.signOut()}>Logout</button>
      </header>
    </div>
  );
}

export default App;