'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Loader2, Plus, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

export default function EventGalleryPage() {
  const { id } = useParams();
  const [photos, setPhotos] = useState<any[]>([]);
  const [eventName, setEventName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const eventRes = await fetch(`http://localhost:5000/api/events`);
        const allEvents = await eventRes.json();
        const currentEvent = allEvents.find((e: any) => e.id === id);
        if (currentEvent) {
          setEventName(currentEvent.name);
          setPassword(currentEvent.password);
        }

        const photoRes = await fetch(`http://localhost:5000/api/events/${id}/photos`);
        const photoData = await photoRes.json();
        setPhotos(photoData);
      } catch (error) {
        console.error("Failed to load gallery", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchGallery();
  }, [id]);

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch(`http://localhost:5000/api/photos/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBuffer: base64.split(',')[1],
            fileName: file.name,
            eventId: id,
            contentType: file.type
          }),
        });

        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
        const newPhoto = await res.json();
        setPhotos((prev) => [newPhoto, ...prev]);
      }
    } catch (err: any) {
      alert("Upload error: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this permanently?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/photos/${photoId}`, { method: 'DELETE' });
      if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Section */}
        <header className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-400">
              <ArrowLeft size={28} />
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-tight">
                {eventName || 'Loading...'}
              </h1>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
                <p className="text-[11px] text-indigo-400 font-mono uppercase tracking-[0.2em]">ID: {id}</p>
                <p className="text-[11px] text-emerald-400 font-mono uppercase tracking-[0.2em]">PASS: {password}</p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400">
              <ImageIcon size={16} />
              <span className="text-sm font-bold uppercase tracking-widest">{photos.length} Assets Found</span>
            </div>
            
            <div className="flex items-center gap-4">
              <input type="file" multiple accept="image/*" hidden ref={fileInputRef} onChange={handleManualUpload} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 px-6 py-3 rounded-xl font-black text-xs tracking-widest transition-all shadow-lg shadow-indigo-500/20"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                {uploading ? "UPLOADING..." : "ADD PHOTOS"}
              </button>
            </div>
          </div>
        </header>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-4">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
            <p className="text-[10px] font-mono tracking-[0.5em] text-slate-500">SYNCING MEMORIES...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-32 border-2 border-dashed border-slate-900 rounded-[2.5rem] bg-slate-900/20">
            <ImageIcon size={48} className="mx-auto mb-4 text-slate-800" />
            <p className="text-slate-500 font-medium italic">Your gallery is currently empty.</p>
            <p className="text-[10px] text-slate-600 uppercase mt-2 tracking-widest">Upload files or use the bridge engine</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
            {photos.map((item) => (
              <div key={item.id} className="group relative aspect-[4/5] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-500/50 transition-all duration-500">
                {item.url.toLowerCase().endsWith('.mp4') ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                )}

                {/* Hover UI */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <button 
                    onClick={(e) => { e.preventDefault(); deletePhoto(item.id); }}
                    className="absolute top-4 left-4 p-2.5 bg-red-500/10 hover:bg-red-500 backdrop-blur-md text-white rounded-xl transition-all border border-red-500/20"
                  >
                    <Trash2 size={18} />
                  </button>
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[10px] font-mono text-indigo-300 uppercase tracking-tighter truncate opacity-70">
                      {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}