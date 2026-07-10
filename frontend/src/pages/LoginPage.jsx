import React, { useState, useEffect } from 'react';
import { Shield, AtSign, Eye, EyeOff, MessageCircle, Bell, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function LoginPage() {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [error, setError] = useState(null);
 const [loading, setLoading] = useState(false);
 const navigate = useNavigate();
 const { authenticate } = useAppStore();

 useEffect(() => {
 const params = new URLSearchParams(window.location.search);
 const previewToken = params.get('previewToken');
 if (previewToken) {
 setLoading(true);
 localStorage.setItem('dt_token', previewToken);
 authenticate(previewToken).then(() => {
 navigate('/client-dashboard');
 }).catch(err => {
 setError("Invalid preview token");
 setLoading(false);
 });
 }
 }, [authenticate, navigate]);

 const handleLogin = async (e) => {
 e.preventDefault();
 setError(null);
 setLoading(true);

 try {
 const response = await fetch('/api/login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ username, password })
 });

 if (!response.ok) {
 let errorMsg = 'Login failed (Backend may be offline)';
 try {
 const data = await response.json();
 errorMsg = data.error || errorMsg;
 } catch (e) {
 // If response isn't JSON (e.g. 502/504 gateway timeout HTML), keep the fallback message
 }
 throw new Error(errorMsg);
 }

 const data = await response.json();

 // Save token and fetch user profile
 localStorage.setItem('dt_token', data.token);
 await authenticate(data.token);
 
 // Navigate to dashboard
 navigate('/command-center');
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="min-h-screen bg-transparent flex flex-col font-sans select-none overflow-hidden">
 {/* Top Header */}
 <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-theme-border/80 bg-theme-panel">
 <div className="flex items-center gap-2">
 {/* Logo */}
 <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shrink-0">
 <span className="text-theme-text text-[10px] font-black">PS</span>
 </div>
 <span className="text-theme-text font-bold text-sm tracking-wide">Permasense</span>
 </div>
 
 <div className="absolute left-1/2 -translate-x-1/2 text-theme-text font-semibold text-sm">
 Permasense Digital Twin
 </div>

 <div className="flex items-center gap-4">
 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-theme-text hover:text-theme-text cursor-pointer transition-colors">
 <MessageCircle size={15} />
 </div>
 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-theme-text hover:text-theme-text cursor-pointer transition-colors">
 <Bell size={15} />
 </div>
 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-theme-text hover:text-theme-text cursor-pointer transition-colors">
 <User size={15} />
 </div>
 </div>
 </header>

 {/* Main Login Area */}
 <div className="flex-1 flex items-center justify-center p-4">
 <div className="w-full max-w-[420px] bg-[#d7dcde] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-10 relative">
 
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-theme-text">Sign in</h1>
 <p className="text-sm text-theme-muted mt-1">Please log in to continue</p>
 </div>

 {error && (
 <div className="mb-4 bg-red-100 border border-red-300 text-red-600 rounded p-2 text-sm text-center">
 {error}
 </div>
 )}

 <form onSubmit={handleLogin} className="flex flex-col gap-5">
 
 <div className="flex flex-col gap-1.5">
 <label className="text-xs font-bold text-theme-text">
 Email <span className="text-red-700 dark:text-red-500">*</span>
 </label>
 <div className="relative">
 <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
 <input 
 type="text" 
 value={username}
 onChange={(e) => setUsername(e.target.value)}
 className="w-full bg-transparent border border-slate-300 rounded-full py-2.5 pl-10 pr-4 text-theme-text text-sm focus:outline-none focus:border-[#b0208a] focus:bg-theme-panel transition-colors placeholder:text-theme-muted"
 placeholder="Enter your Email"
 required
 />
 </div>
 </div>

 <div className="flex flex-col gap-1.5">
 <label className="text-xs font-bold text-theme-text">
 Password <span className="text-red-700 dark:text-red-500">*</span>
 </label>
 <div className="relative">
 <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
 <input 
 type={showPassword ? "text" : "password"} 
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 className="w-full bg-transparent border border-slate-300 rounded-full py-2.5 pl-10 pr-10 text-theme-text text-sm focus:outline-none focus:border-[#b0208a] focus:bg-theme-panel transition-colors placeholder:text-theme-muted"
 placeholder="Enter your password"
 required
 />
 <button 
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-muted"
 >
 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
 </button>
 </div>
 </div>

 <button 
 type="submit" 
 disabled={loading}
 className="mt-2 w-full bg-[#bd1e89] hover:bg-[#a61777] disabled:bg-slate-400 text-theme-text font-medium py-2.5 rounded-full transition-colors text-sm shadow-md"
 >
 {loading ? 'Signing in...' : 'Sign in'}
 </button>
 </form>

 <div className="my-6 flex items-center justify-center gap-2">
 <div className="h-px bg-slate-300 flex-1"></div>
 <span className="text-[11px] text-theme-muted px-2 uppercase tracking-wide">Or continue with</span>
 <div className="h-px bg-slate-300 flex-1"></div>
 </div>

 <button className="w-full bg-transparent border border-slate-300 hover:bg-theme-panel text-theme-muted font-medium py-2.5 rounded-full transition-colors text-sm flex items-center justify-center gap-2">
 <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
 <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
 <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
 <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.369 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
 <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
 <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.109 -17.884 43.989 -14.754 43.989 Z"/>
 </g>
 </svg>
 Google
 </button>

 <div className="mt-8 text-center">
 <span className="text-xs text-theme-muted">Don't have an Account? </span>
 <button className="text-xs text-theme-text font-bold hover:underline">Sign up</button>
 </div>

 </div>
 </div>
 </div>
 );
}

