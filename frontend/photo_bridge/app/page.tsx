'use client';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Link from 'next/link';

// Connect to the backend bridge engine
// const socket = io('http://localhost:5000');

export default function PhotographerDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  
  // Form States
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');
  const [contact, setContact] = useState('');
  
  // UI Status States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploadRaw, setUploadRaw] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  // Real-time Activity States
  const [logs, setLogs] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  useEffect(() => {
    fetch('https://auto-upload-wedding-photography.onrender.com/api/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(() => setError("⚠️ Cannot connect to Bridge Engine. Ensure backend is running."));

    // socket.on('upload-start', (data) => setIsUploading(data.name));
    
    // socket.on('upload-success', (data) => {
    //   setIsUploading(null);
    //   setLogs((prev) => [{...data, status: 'success'}, ...prev].slice(0, 10));
    // });

    // socket.on('upload-error', (data) => {
    //   setIsUploading(null);
    //   setLogs((prev) => [{...data, status: 'error'}, ...prev].slice(0, 10));
    // });

    // return () => {
    //   socket.off('upload-start');
    //   socket.off('upload-success');
    //   socket.off('upload-error');
    // };
  }, []);

  const createEvent = async () => {
    setError('');
    setSuccessMsg('');
    setGeneratedPassword(null);

    if (!newName || !newPath || !contact) return setError("❌ Please fill in all fields.");
    if (contact.length !== 10) return setError("❌ Contact must be exactly 10 digits.");

    try {
      const res = await fetch('https://auto-upload-wedding-photography.onrender.com/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, folderPath: newPath, contact: contact }),
      });
      
      if (!res.ok) throw new Error();

      const data = await res.json();
      setEvents([data, ...events]);
      setGeneratedPassword(data.password);
      setNewName(''); 
      setNewPath(''); 
      setContact('');
      setSuccessMsg(`✅ Event "${data.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch {
      setError("❌ Server error: Could not create event.");
    }
  };

  // const startSync = async () => {
  //   if (!selectedEvent) return setError("❌ Select an event first.");
  //   setLoading(true);
  //   try {
  //     await fetch('https://auto-upload-wedding-photography.onrender.com/api/start', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ 
  //         folderPath: selectedEvent.folder_path, 
  //         eventId: selectedEvent.id, 
  //         uploadRaw 
  //       }),
  //     });
  //     setIsSyncing(true);
  //     setLogs([]); 
  //   } catch { 
  //     setError("❌ Failed to start bridge."); 
  //   } finally { 
  //     setLoading(false); 
  //   }
  // };

  // const stopSync = async () => {
  //   setLoading(true);
  //   try {
  //     const res = await fetch('https://auto-upload-wedding-photography.onrender.com/api/stop', { method: 'POST' });
  //     if (res.ok) {
  //       setIsSyncing(false);
  //       setIsUploading(null);
  //     }
  //   } catch { 
  //     setError("❌ Failed to stop engine."); 
  //   } finally { 
  //     setLoading(false); 
  //   }
  // };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-12 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* FIXED RESPONSIVE HEADER */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black text-white italic tracking-tighter uppercase">
              24 FRAMES
            </h1>
            <div className={`mt-1 md:hidden px-2 py-0.5 rounded-full text-[8px] font-bold border w-fit ${isSyncing ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              {isSyncing ? '● LIVE' : '○ STANDBY'}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <Link href="/dashboard">
              <button className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] md:text-xs px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20 cursor-pointer whitespace-nowrap">
                DASHBOARD
              </button>
            </Link>
            
            <div className={`hidden md:block px-3 py-1 rounded-full text-[10px] font-bold border transition-all duration-500 ${isSyncing ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              {isSyncing ? '● LIVE ENGINE ACTIVE' : '○ SYSTEM STANDBY'}
            </div>
          </div>
        </header>

        {/* NOTIFICATIONS */}
        <div className="space-y-4">
          {(error || successMsg) && (
            <div className={`p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 ${error ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {error || successMsg}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SIDEBAR */}
          <div className="space-y-6">
            <section className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-indigo-500 rounded-full"></span>
                Register Wedding
              </h2>
              <div className="space-y-3">
                <input value={newName} placeholder="Event Name" className="bg-slate-800/50 border border-slate-700 p-3 w-full rounded-2xl text-sm outline-none focus:border-indigo-500 transition" onChange={e => setNewName(e.target.value)} />
                <input value={contact} placeholder="Client Phone Number" className="bg-slate-800/50 border border-slate-700 p-3 w-full rounded-2xl text-sm outline-none focus:border-indigo-500 transition" onChange={e => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} />
                <input value={newPath} placeholder="Folder Path" className="bg-slate-800/50 border border-slate-700 p-3 w-full rounded-2xl text-[10px] font-mono outline-none focus:border-indigo-500 transition" onChange={e => setNewPath(e.target.value)} />
                <button onClick={createEvent} className="bg-indigo-600 hover:bg-indigo-500 text-white py-3 w-full rounded-2xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/20">
                  Create Event
                </button>
                {generatedPassword && (
                  <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/40 rounded-2xl">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Access Password</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-black text-white tracking-widest">{generatedPassword}</span>
                      <button onClick={() => navigator.clipboard.writeText(generatedPassword)} className="text-[9px] bg-indigo-500/20 px-2 py-1 rounded text-indigo-300">COPY</button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* <section className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-emerald-500 rounded-full"></span>
                Live Control
              </h2>
              <select disabled={isSyncing} className="bg-slate-800/50 border border-slate-700 p-3 w-full rounded-2xl text-sm mb-2 outline-none text-slate-200" onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value))}>
                <option value="">-- Select Event --</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
              <div className="flex items-center gap-2 mb-6 ml-1 mt-2">
                <input type="checkbox" id="raw" checked={uploadRaw} onChange={e => setUploadRaw(e.target.checked)} disabled={isSyncing} className="accent-emerald-500 h-4 w-4" />
                <label htmlFor="raw" className="text-[11px] font-semibold text-slate-400">Upload RAW clips</label> 
              </div>
              {!isSyncing ? (
                <button onClick={startSync} disabled={loading || !selectedEvent} className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 w-full rounded-2xl font-bold text-sm transition-all shadow-lg disabled:bg-slate-800">
                  {loading ? "CONNECTING..." : "START SYNC"}
                </button>
              ) : (
                <button onClick={stopSync} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 w-full rounded-2xl font-bold border border-red-500/50 text-sm transition-all">
                  STOP ENGINE
                </button>
              )}
            </section> */}
          </div>

          {/* MAIN CONTENT */}
          <div className="lg:col-span-2 space-y-4">
            {isUploading && (
              <div className="bg-indigo-600/20 border border-indigo-500/50 p-5 rounded-3xl animate-pulse shadow-lg">
                <p className="text-[10px] font-bold text-indigo-400 mb-3 uppercase tracking-widest">Uploading to Cloud ↑</p>
                <p className="text-xs font-mono text-white truncate bg-slate-900/50 p-2 rounded-lg">{isUploading}</p>
              </div>
            )}
            <section className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 min-h-[400px] flex flex-col shadow-xl">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                Live Activity Log
              </h2>
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {logs.length === 0 && <p className="text-center py-20 text-xs font-mono opacity-20 tracking-widest italic">AWAITING ACTIVITY...</p>}
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-slate-800/40 border border-slate-700/30 rounded-2xl">
                    <span className="text-[11px] font-mono text-slate-300 truncate">{log.name}</span>
                    <span className="text-[9px] font-mono text-slate-600">{log.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER STATS */}
        <footer className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-900">
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Total Database</p>
            <p className="text-xl font-bold text-indigo-400">{events.length} Events</p>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Session Live</p>
            <p className="text-xl font-bold text-emerald-400">{logs.filter(l => l.status === 'success').length} <span className="text-xs font-normal opacity-50 uppercase">Photos</span></p>
          </div>
        </footer>
      </div>
    </div>
  );
}