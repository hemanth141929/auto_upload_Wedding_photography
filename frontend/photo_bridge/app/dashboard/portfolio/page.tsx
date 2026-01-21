'use client';
import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Film, 
  Image as ImageIcon, 
  Loader2, 
  ArrowLeft,
  LayoutGrid,
  UploadCloud
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function PortfolioManagement() {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0); // Track how many files are mid-upload
  const [status, setStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('https://auto-upload-wedding-photography.onrender.com/api/portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (err) {
      console.error("Failed to fetch portfolio", err);
    }
  };

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    setUploadingCount(fileArray.length);

    // Process all files
    const uploadPromises = fileArray.map(async (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const res = await fetch('https://auto-upload-wedding-photography.onrender.com/api/portfolio/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileBuffer: base64Data,
                fileName: file.name,
                contentType: file.type,
                title: file.name.split('.')[0].toUpperCase() // Uses filename as title
              })
            });
            if (res.ok) resolve(true);
            else reject();
          } catch (error) {
            reject();
          }
        };
      });
    });

    try {
      await Promise.all(uploadPromises);
      notify(`Successfully uploaded ${fileArray.length} items`);
    } catch (error) {
      notify("Some uploads failed", "error");
    } finally {
      setUploadingCount(0);
      fetchPortfolio();
      e.target.value = ''; // Reset input
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Remove from portfolio?")) return;
    try {
      const res = await fetch(`https://auto-upload-wedding-photography.onrender.com/api/portfolio/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPortfolio();
        notify("Item deleted");
      }
    } catch (err) {
      notify("Delete failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans">
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-10 left-1/2 z-[200] px-6 py-3 rounded-full font-bold text-[10px] tracking-[0.2em] shadow-2xl border ${
              status.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                : 'bg-red-500/10 border-red-500/50 text-red-400'
            }`}
          >
            {status.msg.toUpperCase()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12">
          <div>
            <Link href="/dashboard" className="text-slate-500 hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest mb-4 transition-colors">
              <ArrowLeft size={14} /> Back
            </Link>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase flex items-center gap-3">
              <LayoutGrid className="text-indigo-500" /> Portfolio
            </h1>
          </div>
          {uploadingCount > 0 && (
            <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 px-4 py-2 rounded-2xl">
              <Loader2 className="animate-spin text-indigo-500" size={16} />
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                Uploading {uploadingCount} items...
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          
          {/* --- MULTI-UPLOAD CARD --- */}
          <label className={`aspect-square bg-slate-900 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center group transition-all duration-500 cursor-pointer relative overflow-hidden ${uploadingCount > 0 ? 'border-indigo-500' : 'border-slate-800 hover:border-indigo-500/50'}`}>
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                {uploadingCount > 0 ? <UploadCloud className="animate-bounce" size={24} /> : <Plus size={28} />}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] block text-white">
                  Upload
                </span>
                <span className="text-[8px] text-slate-500 uppercase tracking-widest block">
                  Select files
                </span>
              </div>
            </div>
            
            <input 
              type="file" 
              hidden 
              multiple 
              accept="image/*,video/*" 
              onChange={handleUpload} 
              disabled={uploadingCount > 0} 
            />
          </label>

          {/* --- GALLERY ITEMS --- */}
          {portfolio.map((item) => (
            <motion.div 
              layout
              key={item.id} 
              className="aspect-square bg-slate-900 rounded-3xl overflow-hidden relative group border border-slate-800"
            >
              {item.media_type === 'video' ? (
                <video 
                  src={item.media_url} 
                  className="w-full h-full object-cover" 
                  muted 
                  loop 
                  onMouseOver={e => e.currentTarget.play()} 
                  onMouseOut={e => e.currentTarget.pause()} 
                />
              ) : (
                <img 
                  src={item.media_url} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                />
              )}
              
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
                <button 
                  onClick={() => deleteItem(item.id)}
                  className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-2xl transition-all shadow-xl"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/5">
                {item.media_type === 'video' ? <Film size={12} className="text-indigo-400" /> : <ImageIcon size={12} className="text-slate-400" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}