import { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkUserLoggedIn = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await axiosInstance.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.data);
      }
    } catch (err) {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axiosInstance.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token, user: userData } = res.data.data;
        localStorage.setItem('token', token);
        setUser(userData);
        toast.success(`Welcome back, ${userData.name}!`);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please verify credentials.';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await axiosInstance.post('/auth/register', { name, email, password });
      if (res.data.success) {
        const { token, user: userData } = res.data.data;
        localStorage.setItem('token', token);
        setUser(userData);
        toast.success(`Account created successfully! Welcome, ${userData.name}!`);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      toast.error(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } catch (err) {
      // Ignored
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkUserLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
