import { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('roadsaarthi-token');
      if (token) {
        try {
          API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const res = await API.get('/auth/me');
          setUser(res.data.data);
          localStorage.setItem('roadsaarthi-user-role', res.data.data.role);
        } catch (error) {
          console.error('Failed to load user', error);
          localStorage.removeItem('roadsaarthi-token');
          delete API.defaults.headers.common['Authorization'];
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('roadsaarthi-token', res.data.token);
    localStorage.setItem('roadsaarthi-user-role', res.data.data.role);
    API.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.data);
  };

  const register = async (name, email, password, role, officerId) => {
    const res = await API.post('/auth/register', { name, email, password, role, officerId });
    localStorage.setItem('roadsaarthi-token', res.data.token);
    localStorage.setItem('roadsaarthi-user-role', res.data.data.role);
    API.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.data);
  };

  const logout = () => {
    localStorage.removeItem('roadsaarthi-token');
    localStorage.removeItem('roadsaarthi-user-role');
    delete API.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
