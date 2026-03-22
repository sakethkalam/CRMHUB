import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Use env var for baseURL so it works in any environment
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true, // Send httpOnly cookie automatically with every request
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-logout on 401 — clear user state (cookie is already invalid server-side)
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          setUser(null);
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(responseInterceptor);
  }, []);

  // On initial load, verify session by calling /users/me
  // The cookie is sent automatically — no localStorage needed
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/users/me');
        setUser(response.data);
      } catch {
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

    // Server sets the httpOnly cookie — we don't touch tokens.
    // Errors are intentionally NOT caught here so Login.jsx can handle
    // specific error codes (e.g. 403 pending_approval).
    await api.post('/users/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const response = await api.get('/users/me');
    setUser(response.data);
  };

  const logout = async () => {
    try {
      await api.post('/users/logout'); // Server clears the httpOnly cookie
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
