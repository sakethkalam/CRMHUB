import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

const TOKEN_KEY = 'crm_access_token';

// Use env var for baseURL so it works in any environment
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true, // Send httpOnly cookie when on same domain
});

// Attach stored token as Authorization header on every request
// (fallback for cross-origin environments where cookies are blocked)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-logout on 401 — clear user state and stored token
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(responseInterceptor);
  }, []);

  // On initial load, verify session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const loginRes = await api.post('/users/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    // Store token for cross-origin environments (cookie fallback)
    if (loginRes.data?.access_token) {
      localStorage.setItem(TOKEN_KEY, loginRes.data.access_token);
    }

    const response = await api.get('/users/me');
    setUser(response.data);
  };

  const logout = async () => {
    try {
      await api.post('/users/logout');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
