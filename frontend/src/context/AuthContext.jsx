import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

// Create the Context
export const AuthContext = createContext();

// Create a dedicated Axios instance instead of polluting global defaults
export const api = axios.create({
  baseURL: 'http://localhost:8000', // Our FastAPI backend URL
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  // Initialize token from localStorage if it exists
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  
  // Loading state holds the UI while checking if the saved JWT is still valid
  const [loading, setLoading] = useState(true);

  // Setup Axios interceptors to automatically secure outgoing requests
  useEffect(() => {
    // Intercept outgoing requests and attach JWT
    const requestInterceptor = api.interceptors.request.use((config) => {
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Intercept incoming responses to automatically log out if 401 Unauthorized
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount or token change
    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  // Verify the JWT token on initial load
  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const response = await api.get('/users/me');
          setUser(response.data);
        } catch (error) {
          console.error("Token invalid or expired", error);
          logout(); // Flushes invalid token
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      // Must send credentials as form URL-encoded for FastAPI OAuth2 specification
      const params = new URLSearchParams();
      params.append('username', email); // FastAPI's spec explicitly uses 'username' keyword
      params.append('password', password);

      const response = await api.post('/users/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const newToken = response.data.access_token;
      setToken(newToken);
      localStorage.setItem('token', newToken); 
      
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
