import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0f19] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 blur-[100px] rounded-full"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-500/10 blur-[100px] rounded-full"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-[2.5rem] p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-3 shadow-lg">
            <Sparkles size={24} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Create Account</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">Audit, Optimize & Invest your money with Claude</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Full Name</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><User size={16} /></span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-white outline-none focus:border-indigo-500 placeholder:text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Mail size={16} /></span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-white outline-none focus:border-indigo-500 placeholder:text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Lock size={16} /></span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold text-white outline-none focus:border-indigo-500 placeholder:text-slate-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-6 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-all uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Register Account'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center font-medium mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold ml-1 transition-colors">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
