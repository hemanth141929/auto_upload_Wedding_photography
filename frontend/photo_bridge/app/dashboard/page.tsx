'use client';
import { useState, useEffect } from 'react';
import { Trash2, Upload, Loader2 } from 'lucide-react';
import Link from 'next/link'
import { Save, Settings2, Plus, X as CloseIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AdminBridgeManager() {
  const [banners, setBanners] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
const [editingId, setEditingId] = useState<string | null>(null);
const [status, setStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  // Track which slot (1, 2, or 3) is currently uploading
  const [processingSlot, setProcessingSlot] = useState<number | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    fetch('http://localhost:5000/api/events').then(res => res.json()).then(setEvents);
    fetch('http://localhost:5000/api/banners').then(res => res.json()).then(setBanners);
    fetch('http://localhost:5000/api/pricing').then(res => res.json()).then(setPricing);
};

const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000); // Auto-hide after 3 seconds
};

const savePricing = async (pkg: any) => {
    try {
        const res = await fetch(`http://localhost:5000/api/pricing/${pkg.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pkg)
        });
        
        if (res.ok) {
            notify(`Successfully updated ${pkg.name}`);
            refreshData();
        } else {
            throw new Error();
        }
    } catch (error) {
        notify("Failed to update package", "error");
    }
};
  const handleBannerChange = async (e: any, index: number, bannerId?: string) => {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingSlot(index); // Set status to uploading for this slot

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        
        const res = await fetch('http://localhost:5000/api/banners/upload', {
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
          refreshData();
        }
      } catch (error) {
        console.error("Upload failed", error);
      } finally {
        setProcessingSlot(null); // Clear status
      }
    };
  };

  

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await fetch(`http://localhost:5000/api/events/${id}`, { method: 'DELETE' });
    refreshData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-10 font-sans">
      <AnimatePresence>
      {status && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className={`fixed top-10 left-1/2 z-[200] px-6 py-3 rounded-full font-bold text-xs tracking-widest shadow-2xl border ${
            status.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}
        >
          {status.type === 'success' ? '✓ ' : '✕ '} {status.msg.toUpperCase()}
        </motion.div>
      )}
    </AnimatePresence>
      
      <h1 className="text-xl font-bold mb-10 border-b border-slate-800 pb-4">ADMIN PAGE</h1>
      <div >
            <Link href="dashboard/portfolio" className='w-25 text-xs absolute right-25 top-6 bg-blue-600 text-white rounded-md p-2 font-bold cursor-pointer'><button className='uppercase cursor-pointer'>
            portfolio management
            </button></Link>
          </div>
      
      {/* 3 PHOTO BANNER SLOTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[1, 2, 3].map((idx) => {
          const banner = banners.find(b => b.display_order === idx);
          const isUploading = processingSlot === idx;

          return (
            <div key={idx} className="flex flex-col gap-2">
               {/* Status Label Above Image */}
               <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Slot {idx}</span>
                {isUploading && (
                  <span className="text-[10px] font-bold text-indigo-400 animate-pulse flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> UPLOADING...
                  </span>
                )}
              </div>

              <div className={`aspect-video bg-slate-900 border ${isUploading ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-slate-800'} rounded-xl overflow-hidden relative group transition-all`}>
                {banner ? (
                  <img 
                    // Added timestamp to URL to force browser to refresh the "replaced" image
                    src={`${banner.media_url}?t=${new Date().getTime()}`} 
                    className={`w-full h-full object-cover transition-opacity duration-500 ${isUploading ? 'opacity-30' : 'opacity-100'}`} 
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-xs italic">
                    EMPTY SLOT
                  </div>
                )}

                {/* Overlay - Hidden while uploading */}
                {!isUploading && (
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity duration-300">
                    <Upload size={24} className="text-white mb-2" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">
                      {banner ? 'Replace Image' : 'Upload Image'}
                    </span>
                    <input type="file" hidden accept="image/*,video/*" onChange={(e) => handleBannerChange(e, idx, banner?.id)} />
                  </label>
                )}

                {/* Centered Loader icon inside the box while uploading */}
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

      <div className="mb-12">
  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
    <Settings2 size={14} /> Wedding Collections Management
  </h2>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {pricing.map((pkg) => (
      <div key={pkg.id} className={`p-6 rounded-2xl border ${pkg.highlight ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900/30'}`}>
        <div className="space-y-4">
          <input 
            className="bg-transparent text-lg font-bold w-full outline-none border-b border-transparent focus:border-slate-700"
            defaultValue={pkg.name}
            onChange={(e) => pkg.name = e.target.value}
          />
          <div className="flex items-center gap-2">
            <span className="text-slate-500">₹</span>
            <input 
                className="bg-transparent text-xl font-mono text-indigo-400 outline-none w-full"
                defaultValue={pkg.price}
                onChange={(e) => pkg.price = e.target.value}
            />
          </div>
          <textarea 
            className="bg-slate-800/50 p-3 rounded-lg w-full text-xs text-slate-400 h-20 outline-none resize-none"
            defaultValue={pkg.description}
            onChange={(e) => pkg.description = e.target.value}
          />
          
          {/* Features Editor */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Features</p>
            {pkg.features.map((f: string, i: number) => (
              <div key={i} className="flex gap-2">
                <input 
                  className="bg-slate-800/30 p-2 rounded text-[11px] w-full outline-none"
                  defaultValue={f}
                  onChange={(e) => {
                    const newFeatures = [...pkg.features];
                    newFeatures[i] = e.target.value;
                    pkg.features = newFeatures;
                  }}
                />
              </div>
            ))}
          </div>

          <button 
            onClick={() => savePricing(pkg)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Save size={14} /> Update Package
          </button>
        </div>
      </div>
    ))}
  </div>
</div>

      {/* EVENT LIST SECTION */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Events</h2>
        {events.length === 0 ? (
           <p className="text-slate-600 italic text-sm">No events registered.</p>
        ) : (
          events.map(event => (
            <Link href={`/dashboard/${event.id} `} key={event.id}>
            <div className="bg-slate-900/50 p-6 rounded-2xl flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-colors">
              <div>
                <p className="font-bold text-slate-200">{event.name}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">{event.folder_path}</p>
              </div>
              <button 
                onClick={() => deleteEvent(event.id)} 
                className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-2.5 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}