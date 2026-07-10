import React, { useState, useEffect } from 'react';
import { Users, Edit, Trash2, Plus, RefreshCw, X, Save, Eye, Mail } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';
import plantConfig from '../config/plant_config.json';

export default function ClientManagement() {
 const [clients, setClients] = useState([]);
 const [loading, setLoading] = useState(true);
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingClient, setEditingClient] = useState(null);
 const [clientToDelete, setClientToDelete] = useState(null);
 const [formData, setFormData] = useState({
 company_name: '',
 username: '',
 password: '',
 contact_name: '',
 contact_email: '',
 contact_phone: '',
 allowed_plant_ids: [],
 pcb_limits: {
 phMin: 6.5,
 phMax: 8.5,
 turbidityMax: 10,
 conductivityMax: 1000,
 bodMax: 30,
 codMax: 250
 }
 });

 const availablePlants = Object.keys(plantConfig);

 const fetchClients = async () => {
 try {
 const token = localStorage.getItem('dt_token');
 const res = await fetch('/api/admin/clients', {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 if (res.ok) {
 const data = await res.json();
 // Parse JSON strings to objects safely
 const parsed = data.map(c => {
 let allowed = [];
 try {
 allowed = typeof c.allowed_plant_ids === 'string' ? JSON.parse(c.allowed_plant_ids) : (c.allowed_plant_ids || []);
 } catch(e) { allowed = []; }
 
 let pcb = { phMin: 6.5, phMax: 8.5, turbidityMax: 10, conductivityMax: 1000, bodMax: 30, codMax: 250 };
 try {
 if (c.pcb_limits) pcb = typeof c.pcb_limits === 'string' ? JSON.parse(c.pcb_limits) : c.pcb_limits;
 } catch(e) {}
 
 return {
 ...c,
 allowed_plant_ids: Array.isArray(allowed) ? allowed : [],
 pcb_limits: pcb
 };
 });
 setClients(parsed);
 }
 } catch (e) {
 console.error(e);
 toast.error("Failed to fetch clients");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchClients();
 }, []);

 const openAddModal = () => {
 setEditingClient(null);
 setFormData({
 company_name: '',
 username: '',
 password: '',
 contact_name: '',
 contact_email: '',
 contact_phone: '',
 allowed_plant_ids: [],
 pcb_limits: { phMin: 6.5, phMax: 8.5, turbidityMax: 10, conductivityMax: 1000, bodMax: 30, codMax: 250 }
 });
 setIsModalOpen(true);
 };

 const openEditModal = (client) => {
 setEditingClient(client);
 setFormData({
 company_name: client.company_name,
 username: client.username,
 password: '', // blank on edit
 contact_name: client.contact_name || '',
 contact_email: client.contact_email || '',
 contact_phone: client.contact_phone || '',
 allowed_plant_ids: client.allowed_plant_ids,
 pcb_limits: client.pcb_limits
 });
 setIsModalOpen(true);
 };

 const saveClient = async () => {
 if (!formData.company_name || !formData.username) {
 toast.error("Company name and username are required");
 return;
 }
 if (!editingClient && !formData.password) {
 toast.error("Password required for new clients");
 return;
 }

 try {
 const token = localStorage.getItem('dt_token');
 const url = editingClient ? `/api/admin/clients/${editingClient.user_id}` : `/api/admin/clients`;
 const method = editingClient ? 'PUT' : 'POST';

 const res = await fetch(url, {
 method,
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify(formData)
 });

 if (res.ok) {
 toast.success(editingClient ? "Client updated" : "Client created! Credentials emailed.");
 setIsModalOpen(false);
 fetchClients();
 } else {
 const error = await res.json();
 toast.error(error.error || "Failed to save client");
 }
 } catch (e) {
 toast.error("Network error");
 }
 };

 const deleteClient = (client) => {
 setClientToDelete(client);
 };

 const executeDelete = async () => {
 if (!clientToDelete) return;
 try {
 const token = localStorage.getItem('dt_token');
 const res = await fetch(`/api/admin/clients/${clientToDelete.user_id}`, {
 method: 'DELETE',
 headers: { 'Authorization': `Bearer ${token}` }
 });
 if (res.ok) {
 toast.success(`Access revoked for ${clientToDelete.company_name}`);
 setClientToDelete(null);
 fetchClients();
 } else {
 const error = await res.json();
 toast.error(error.error || "Failed to delete client");
 }
 } catch (e) {
 toast.error("Network error");
 }
 };

 const previewClient = async (id) => {
 try {
 const token = localStorage.getItem('dt_token');
 const res = await fetch(`/api/admin/preview-token/${id}`, {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 if (res.ok) {
 const data = await res.json();
 window.open(`/login?previewToken=${data.token}`, '_blank');
 } else {
 toast.error("Failed to generate preview token");
 }
 } catch (e) {
 toast.error("Network error");
 }
 };

 const handlePlantToggle = (plant) => {
 setFormData(prev => {
 const set = new Set(prev.allowed_plant_ids);
 if (set.has(plant)) set.delete(plant);
 else set.add(plant);
 return { ...prev, allowed_plant_ids: Array.from(set) };
 });
 };

 return (
 <div className="flex flex-col h-full bg-theme-main text-theme-text p-6 rounded-xl border border-theme-border">
 
 <div className="flex justify-between items-center mb-6">
 <div>
 <h2 className="text-2xl font-black text-theme-text flex items-center gap-3">
 <Users className="text-cyan-700 dark:text-cyan-400" /> Client Management
 </h2>
 <p className="text-theme-muted text-sm mt-1">Manage client portals, access rights, and custom PCB compliance limits.</p>
 </div>
 <button 
 onClick={openAddModal}
 className="bg-cyan-600 hover:bg-cyan-500 text-theme-text px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
 >
 <Plus size={18} /> Add New Client
 </button>
 </div>

 <div className="flex-1 overflow-auto bg-theme-panel rounded-lg border border-theme-border">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-slate-100 dark:bg-slate-80050 text-xs text-theme-muted uppercase tracking-widest border-b border-theme-border">
 <th className="p-4 font-bold">Company</th>
 <th className="p-4 font-bold">Username</th>
 <th className="p-4 font-bold">Status</th>
 <th className="p-4 font-bold">Assigned Plants</th>
 <th className="p-4 font-bold">PCB Limits</th>
 <th className="p-4 font-bold text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {loading ? (
 <tr><td colSpan="4" className="text-center p-8 text-theme-muted"><RefreshCw className="animate-spin inline mr-2" /> Loading...</td></tr>
 ) : clients.map(client => (
 <tr key={client.user_id} className="border-b border-theme-border/50 hover:bg-slate-100 dark:bg-slate-80020 transition-colors">
 <td className="p-4 font-bold text-theme-text">{client.company_name}</td>
 <td className="p-4 text-theme-muted">{client.username}</td>
 <td className="p-4">
 {client.allowed_plant_ids.length > 0 ? (
 <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">Active</span>
 ) : (
 <span className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/50 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">Pending</span>
 )}
 </td>
 <td className="p-4">
 <div className="flex flex-wrap gap-1">
 {client.allowed_plant_ids.map(p => (
 <span key={p} className="bg-slate-100 dark:bg-slate-800 text-xs text-theme-text px-2 py-1 rounded border border-theme-border">{p}</span>
 ))}
 </div>
 </td>
 <td className="p-4 text-xs text-theme-muted">
 <div className="flex flex-col gap-0.5">
 <span><strong className="text-theme-text">pH:</strong> {client.pcb_limits.phMin}-{client.pcb_limits.phMax}</span>
 <span><strong className="text-theme-text">COD:</strong> &lt;{client.pcb_limits.codMax} mg/L</span>
 </div>
 </td>
 <td className="p-4 flex items-center justify-end gap-2">
 <button onClick={() => previewClient(client.user_id)} className="p-2 text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 rounded" title="Preview Client Dashboard">
 <Eye size={18} />
 </button>
 <button onClick={() => openEditModal(client)} className="p-2 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 rounded" title="Edit Client">
 <Edit size={18} />
 </button>
 <button onClick={() => deleteClient(client)} className="p-2 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 rounded" title="Deactivate">
 <Trash2 size={18} />
 </button>
 </td>
 </tr>
 ))}
 {!loading && clients.length === 0 && (
 <tr><td colSpan="6" className="text-center p-8 text-theme-muted">No clients found.</td></tr>
 )}
 </tbody>
 </table>
 </div>

 {/* Modal */}
 {isModalOpen && (
 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
 <div className="bg-theme-panel border border-theme-border rounded-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
 
 <div className="flex justify-between items-center p-4 border-b border-theme-border">
 <h3 className="font-bold text-lg text-theme-text">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
 <button onClick={() => setIsModalOpen(false)} className="text-theme-muted hover:text-theme-text"><X size={20} /></button>
 </div>

 <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
 
 {/* Left Column: Account Details */}
 <div className="space-y-4">
 <h4 className="text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-widest text-xs border-b border-theme-border pb-2">Account Details</h4>
 
 <div>
 <label className="block text-xs text-theme-muted mb-1">Company Name</label>
 <input type="text" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none" />
 </div>
 
 <div>
 <label className="block text-xs text-theme-muted mb-1">Username</label>
 <input type="text" value={formData.username} disabled={!!editingClient} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none disabled:opacity-50" />
 </div>
 
 {!editingClient && (
 <div>
 <label className="block text-xs text-theme-muted mb-1">Temporary Password</label>
 <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none" />
 <p className="text-[10px] text-theme-muted mt-1 flex items-center gap-1"><Mail size={10} /> Credentials will be emailed automatically.</p>
 </div>
 )}
 
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs text-theme-muted mb-1">Contact Name</label>
 <input type="text" value={formData.contact_name} onChange={e => setFormData({...formData, contact_name: e.target.value})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">Contact Phone (WhatsApp)</label>
 <input type="text" value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} placeholder="+1234567890" className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none" />
 </div>
 </div>

 <div>
 <label className="block text-xs text-theme-muted mb-1">Contact Email</label>
 <input type="email" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text focus:border-cyan-500 outline-none" />
 </div>

 <h4 className="text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-widest text-xs border-b border-theme-border pb-2 mt-6">Assigned Plants</h4>
 <div className="flex flex-wrap gap-2">
 {availablePlants.map(p => (
 <button 
 key={p} 
 onClick={() => handlePlantToggle(p)}
 className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${formData.allowed_plant_ids.includes(p) ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-100 dark:bg-slate-800 border-theme-border text-theme-muted hover:border-slate-500'}`}
 >
 {p}
 </button>
 ))}
 </div>
 </div>

 {/* Right Column: PCB Limits */}
 <div className="space-y-4">
 <h4 className="text-amber-700 dark:text-amber-400 font-bold uppercase tracking-widest text-xs border-b border-theme-border pb-2">PCB Compliance Limits</h4>
 <p className="text-xs text-theme-muted mb-4">Set the specific pollution control board limits for this client. These drive the status banners on their dashboard.</p>
 
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs text-theme-muted mb-1">pH Min</label>
 <input type="number" step="0.1" value={formData.pcb_limits.phMin} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, phMin: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">pH Max</label>
 <input type="number" step="0.1" value={formData.pcb_limits.phMax} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, phMax: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">Turbidity Max (NTU)</label>
 <input type="number" value={formData.pcb_limits.turbidityMax} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, turbidityMax: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">Conductivity Max</label>
 <input type="number" value={formData.pcb_limits.conductivityMax} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, conductivityMax: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">BOD Max (mg/L)</label>
 <input type="number" value={formData.pcb_limits.bodMax} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, bodMax: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 <div>
 <label className="block text-xs text-theme-muted mb-1">COD Max (mg/L)</label>
 <input type="number" value={formData.pcb_limits.codMax} onChange={e => setFormData({...formData, pcb_limits: {...formData.pcb_limits, codMax: parseFloat(e.target.value)}})} className="w-full bg-theme-panel border border-theme-border rounded p-2 text-sm text-theme-text" />
 </div>
 </div>
 </div>

 </div>

 <div className="p-4 border-t border-theme-border flex justify-end gap-3 bg-theme-panel">
 <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded font-bold text-theme-muted hover:text-theme-text transition-colors">Cancel</button>
 <button onClick={saveClient} className="bg-cyan-600 hover:bg-cyan-500 text-theme-text px-6 py-2 rounded font-bold flex items-center gap-2 transition-all">
 <Save size={16} /> Save Client
 </button>
 </div>

 </div>
 </div>
 )}

 {/* Delete Confirmation Modal */}
 {clientToDelete && (
 <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
 <div className="bg-theme-panel border border-rose-900/50 rounded-xl max-w-sm w-full p-6 shadow-[0_0_30px_rgba(225,29,72,0.15)] animate-in zoom-in-95 duration-200 premium-card">
 <h3 className="font-bold text-lg text-rose-700 dark:text-rose-500 mb-2 flex items-center gap-2">
 <Trash2 size={20} />
 Confirm Revocation
 </h3>
 <p className="text-theme-text text-sm mb-6 leading-relaxed">
 Are you sure you want to revoke portal access for <strong className="text-theme-text">{clientToDelete.company_name}</strong>? This will immediately disconnect their data feeds. This action cannot be undone.
 </p>
 <div className="flex justify-end gap-3">
 <button onClick={() => setClientToDelete(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-theme-text transition-colors rounded text-sm font-bold">
 Cancel
 </button>
 <button onClick={executeDelete} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-theme-text transition-colors rounded text-sm font-bold shadow-lg shadow-rose-900/50">
 Revoke Access
 </button>
 </div>
 </div>
 </div>
 )}

 </div>
 );
}
