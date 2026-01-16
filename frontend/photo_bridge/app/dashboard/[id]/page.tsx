'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, Film, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function EventGalleryPage() {
  const { id } = useParams();
  const router = useRouter();
  const [photos, setPhotos] = useState<any[]>([]);
  const [eventName, setEventName] = useState('');
  const[password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        // 1. Fetch Event Details (to get the name)
        const eventRes = await fetch(`http://localhost:5000/api/events`);
        const allEvents = await eventRes.json();
        const currentEvent = allEvents.find((e: any) => e.id === id);
        if (currentEvent) setEventName(currentEvent.name);
        if (currentEvent) setPassword(currentEvent.password);

        // 2. Fetch Photos for this event
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
  const deletePhoto = async (photoId: string) => {
  if (!confirm("Are you sure you want to delete this image permanently?")) return;

  try {
    const res = await fetch(`http://localhost:5000/api/photos/${photoId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      // Remove from local state so UI updates immediately
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else {
      const err = await res.json();
      alert("Failed to delete: " + err.error);
    }
  } catch (error) {
    console.error("Delete request failed", error);
  }
};

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation Header */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="p-2 hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                {eventName || 'Event Gallery'}
              </h1>
              <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest">
                Event ID: {id}
              </p>
              <p className="text-[15px] text-indigo-400 font-mono uppercase tracking-widest">
                Event Password: {password}
              </p>
            </div>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400">
            {photos.length} Assets Found
          </div>
        </header>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-4 opacity-50">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-mono tracking-widest">LOADING ASSETS...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-40 border-2 border-dashed border-slate-900 rounded-3xl">
            <p className="text-slate-500 italic">No media has been uploaded for this event yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((item) => (
              <div key={item.id} className="group relative aspect-square bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/50 transition-all">
  
  {/* Existing Image/Video Rendering Code */}
  {item.url.toLowerCase().endsWith('.mp4') ? (
    <video src={item.url} className="w-full h-full object-cover" />
  ) : (
    <img src={item.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
  )}

  {/* NEW: Delete Button (Shows on Hover) */}
  <button 
    onClick={(e) => {
      e.preventDefault();
      deletePhoto(item.id);
    }}
    className="absolute top-2 left-2 p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl"
    title="Delete permanently"
  >
    <Trash2 size={16} />
  </button>

  {/* Existing Info Overlay */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
     <p className="text-[9px] font-mono text-slate-400 truncate">
       {new Date(item.created_at).toLocaleDateString()}
     </p>
  </div>
</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}