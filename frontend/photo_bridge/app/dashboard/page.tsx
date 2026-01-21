'use client';
import { useState, useEffect } from 'react';
import { Trash2, Upload, Loader2, Save, Settings2, Plus, X as CloseIcon, Home, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

export default function AdminBridgeManager() {
  const [banners, setBanners] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [status, setStatus] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
  const [processingSlot, setProcessingSlot] = useState<number | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    fetch('https://auto-upload-wedding-photography.onrender.com/api/events').then(res => res.json()).then(setEvents);
    fetch('https://auto-upload-wedding-photography.onrender.com/api/banners').then(res => res.json()).then(setBanners);
    fetch('https://auto-upload-wedding-photography.onrender.com/api/pricing').then(res => res.json()).then(setPricing);
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleBannerChange = async (e: any, index: number, bannerId?: string) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcessingSlot(index);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('https://auto-upload-wedding-photography.onrender.com/api/banners/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBuffer: base64Data,
            fileName: file.name,
            contentType: file.type,
            index,
            bannerId
          })
        });
        if (res.ok) {
          notify("Banner updated successfully");
          refreshData();
        }
      } catch (error) {
        notify("Upload failed", "error");
      } finally {
        setProcessingSlot(null);
      }
    };
  };

  const deleteEvent = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation
    if (!confirm("Delete this event?")) return;
    await fetch(`https://auto-upload-wedding-photography.onrender.com/api/events/${id}`, { method: 'DELETE' });
    notify("Event deleted");
    refreshData();
  };

  const savePricing = async (pkg: any) => {
    try {
      const res = await fetch(`https://auto-upload-wedding-photography.onrender.com/api/pricing/${pkg.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg)
      });
      if (res.ok) {
        notify("Pricing updated successfully");
        refreshData();
      } else {
        notify("Failed to update pricing", "error");
      }
    } catch (error) {
      notify("Error saving pricing", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-10 font-sans">
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-6 left-1/2 z-[200] px-6 py-3 rounded-full font-bold text-[10px] tracking-widest shadow-2xl border flex items-center gap-2 ${
              status.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/50 text-red-400'
            }`}
          >
            {status.type === 'success' ? '✓' : '✕'} {status.msg.toUpperCase()}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* RESPONSIVE HEADER - NO ABSOLUTE POSITIONING */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter text-indigo-500">ADMIN CONTROL</h1>
          <p className="text-[10px] text-slate-500 font-bold tracking-[0.3em] uppercase">24 Frames Management</p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/" className="flex-1 md:flex-none">
            <button className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-xl px-4 py-2.5 text-[10px] font-black tracking-widest transition-all">
              <Home size={14} /> HOME
            </button>
          </Link>
          <Link href="/dashboard/portfolio" className="flex-1 md:flex-none">
            <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-[10px] font-black tracking-widest transition-all shadow-lg shadow-blue-600/20">
              <Briefcase size={14} /> PORTFOLIO
            </button>
          </Link>
        </div>
      </header>

      {/* BANNER SECTION */}
      <div className="mb-12">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Upload size={14} /> Homepage Banner Slots
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => {
            const banner = banners.find(b => b.display_order === idx);
            const isUploading = processingSlot === idx;

            return (
              <div key={idx} className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Slot {idx}</span>
                  {isUploading && (
                    <span className="text-[10px] font-bold text-indigo-400 animate-pulse flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" /> WORKING...
                    </span>
                  )}
                </div>
                <div className={`aspect-video bg-slate-900 border ${isUploading ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-800'} rounded-2xl overflow-hidden relative group`}>
                  {banner ? (
                    <img 
                      src={`${banner.media_url}?t=${new Date().getTime()}`} 
                      className={`w-full h-full object-cover transition-all duration-500 ${isUploading ? 'opacity-20 scale-95 blur-sm' : 'opacity-100'}`} 
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-700 text-[10px] font-bold uppercase tracking-widest">Empty</div>
                  )}
                  {!isUploading && (
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300 backdrop-blur-sm">
                      <Upload size={20} className="text-white mb-2" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Replace</span>
                      <input type="file" hidden accept="image/*" onChange={(e) => handleBannerChange(e, idx, banner?.id)} />
                    </label>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="text-indigo-500 animate-spin" size={32} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRICING SECTION */}
      <div className="mb-12">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
          <Settings2 size={14} /> Wedding Collections
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {pricing.map((pkg) => (
            <div key={pkg.id} className={`p-6 rounded-3xl border ${pkg.highlight ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900/30'}`}>
              <div className="space-y-4">
                <input 
                  className="bg-transparent text-lg font-black w-full outline-none border-b border-transparent focus:border-indigo-500/50"
                  defaultValue={pkg.name}
                  onChange={(e) => pkg.name = e.target.value}
                />
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-bold">₹</span>
                  <input 
                      className="bg-transparent text-2xl font-mono text-indigo-400 outline-none w-full"
                      defaultValue={pkg.price}
                      onChange={(e) => pkg.price = e.target.value}
                  />
                </div>
                <textarea 
                  className="bg-slate-800/50 p-4 rounded-xl w-full text-xs text-slate-400 h-24 outline-none resize-none border border-slate-700/50 focus:border-indigo-500/30"
                  defaultValue={pkg.description}
                  onChange={(e) => pkg.description = e.target.value}
                />
                
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Package Highlights</p>
                  {pkg.features.map((f: string, i: number) => (
                    <input 
                      key={i}
                      className="bg-slate-800/30 p-2.5 rounded-lg text-[11px] w-full outline-none border border-transparent focus:border-slate-700"
                      defaultValue={f}
                      onChange={(e) => {
                        const newFeatures = [...pkg.features];
                        newFeatures[i] = e.target.value;
                        pkg.features = newFeatures;
                      }}
                    />
                  ))}
                </div>

                <button 
                  onClick={() => savePricing(pkg)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Save size={14} /> SAVE CHANGES
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EVENT LIST */}
      <div className="space-y-4">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Wedding Events</h2>
        <div className="grid grid-cols-1 gap-3">
          {events.length === 0 ? (
             <div className="bg-slate-900/30 p-10 rounded-3xl border border-slate-800 border-dashed text-center">
               <p className="text-slate-600 italic text-sm">No events found in database.</p>
             </div>
          ) : (
            events.map(event => (
              <Link href={`/dashboard/${event.id}`} key={event.id} className="block group">
                <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl flex justify-between items-center border border-slate-800 group-hover:border-indigo-500/50 group-hover:bg-slate-900 transition-all">
                  <div className="truncate pr-4">
                    <p className="font-bold text-slate-200 group-hover:text-white transition-colors uppercase tracking-tight">{event.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{event.folder_path}</p>
                  </div>
                  <button 
                    onClick={(e) => deleteEvent(event.id, e)} 
                    className="shrink-0 text-slate-600 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}