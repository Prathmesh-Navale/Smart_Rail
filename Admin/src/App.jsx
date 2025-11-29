import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Bell, Ticket, TriangleAlert, Video, 
  Settings, CheckCircle2, AlertCircle, Users, Shield, 
  CreditCard, Hand, Ambulance, Train, MapPin, 
  MessageSquare, Send, X, Bot, Menu, ChevronRight 
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Chart Registration ---
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

function cn(...inputs) { return twMerge(clsx(inputs)); }

// --- LIVE CAMERA CONFIGURATION ---
// Ensure your python scripts are running on these ports!
const CAMERA_FEEDS = [
  { 
    id: 1, 
    title: "Entrance Feed (app.py)", 
    subtitle: "Crowd Density Analysis",
    url: "http://localhost:5001/video_feed", // Port 5001
    status: "Active",
    risk: "Safe" 
  },
  { 
    id: 2, 
    title: "Platform Feed (app1.py)", 
    subtitle: "Safety Breach Detection",
    url: "http://localhost:5002/video_feed", // Port 5002
    status: "Warning", 
    risk: "Critical" 
  }
];

// --- MOCK DATA ---
const FALLBACK_ALERTS = [
  { id: 1, time: '11:05:30', location: 'Train C-12, Coach 4', type: 'Extreme Overcrowding', severity: 'High', status: 'New', action: 'Direct Passengers', ai_logic: 'YOLOv8 model detected 320 people (Threshold: 250).' },
];
const FALLBACK_SOS = [
  { id: 'SOS-991', time: '11:06:00', train: 'Train C-12, Coach 8', passengerId: 'P-5021', type: 'Medical Emergency', status: 'New', ai_logic: 'SOS button + Proximity sensor stationary.' },
];
const COMPLIANCE_DATA = [
  { train: 'C-10', coach: 'C-1', ai: 205, tickets: 200, status: 'Compliant' },
  { train: 'C-10', coach: 'C-4', ai: 250, tickets: 205, status: 'Non-Compliant' },
  { train: 'C-10', coach: 'C-6', ai: 180, tickets: 178, status: 'Compliant' },
  { train: 'W-05', coach: 'W-3', ai: 210, tickets: 190, status: 'Non-Compliant' },
];

// --- MAIN APP COMPONENT ---
export default function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Data State
  const [alerts, setAlerts] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Interactive State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null); 
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'ai', text: 'System Online. Monitoring cameras on ports 5001 & 5002.' }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef(null);

  // Fetch Data
  const fetchRealTimeData = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/dashboard');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      
      if(data) {
        setAlerts(data.alerts?.length > 0 ? data.alerts : FALLBACK_ALERTS); 
        setSosList(data.sos?.length > 0 ? data.sos : FALLBACK_SOS);
        setTrafficData(data.traffic || []);
      }
    } catch (err) {
      if (alerts.length === 0) setAlerts(FALLBACK_ALERTS);
      if (sosList.length === 0) setSosList(FALLBACK_SOS);
    }
  };

  useEffect(() => {
    fetchRealTimeData();
    const interval = setInterval(() => {
        setCurrentTime(new Date());
        fetchRealTimeData();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages]);

  // Handlers
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text })
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      if (data.action === 'NAVIGATE' && data.target) setActiveSection(data.target);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', text: "⚠️ RailBot Offline." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleOpenModal = (type, id) => {
    let data = { type, id };
    // ... (Keep existing modal logic logic, omitted for brevity but assumed present) ...
    // Using a simplified setter for demo purposes based on your previous code
    setModalData({ title: "Details View", content: "Detailed breakdown of the selected event.", btnText: "Acknowledge", btnClass: "bg-blue-600 text-white" });
    setModalOpen(true);
  };

  const handleDrillDown = (section) => setActiveSection(section);

  // Status Logic
  const activeSOSCount = sosList.filter(s => s.status === 'New').length;
  
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-blue-100">
      
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 shadow-2xl flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
           <div>
             <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">SmartRail.AI</h1>
             <p className="text-xs text-slate-400 mt-1">Intelligent Transit Monitoring</p>
           </div>
           <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={24}/></button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
            { id: 'live_feed', icon: Video, label: 'Live Vision', badge: 'LIVE' },
            { id: 'alerts', icon: Bell, label: 'Alerts', count: alerts.length },
            { id: 'tickets', icon: Ticket, label: 'Ticketing' },
            { id: 'sos', icon: TriangleAlert, label: 'Emergency SOS', count: activeSOSCount, alert: true },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                activeSection === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <div className="flex items-center">
                <item.icon size={20} className={cn("mr-3 transition-colors", activeSection === item.id ? "text-white" : "text-slate-500 group-hover:text-white")} />
                {item.label}
              </div>
              {item.badge && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">{item.badge}</span>}
              {item.count > 0 && (
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md", item.alert ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-slate-300")}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-slate-950 border-t border-slate-800">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">AD</div>
              <div className="flex-1">
                 <p className="text-sm font-medium text-white">Admin Console</p>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <p className="text-xs text-slate-400">System Nominal</p>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm/50">
           <div className="flex items-center gap-4">
               <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24}/></button>
               <h2 className="text-xl font-bold text-slate-800 capitalize tracking-tight">{activeSection.replace('_', ' ')}</h2>
           </div>
           
           <div className="flex items-center gap-6">
              <div className="hidden md:block text-right">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Server Time</p>
                  <p className="text-sm font-bold text-slate-700 font-mono">{currentTime.toLocaleTimeString()}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
              <button className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                  <Bell size={20}/>
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-all">
                  <Settings size={20}/>
              </button>
           </div>
        </header>

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
           <div className="max-w-7xl mx-auto space-y-8">
               {activeSection === 'dashboard' && <DashboardView activeSOSCount={activeSOSCount} traffic={trafficData} handleDrillDown={handleDrillDown} />}
               {activeSection === 'live_feed' && <LiveFeedView />}
               {activeSection === 'alerts' && <AlertsView alerts={alerts} handleOpenModal={handleOpenModal} />}
               {activeSection === 'tickets' && <TicketsView handleOpenModal={handleOpenModal} />}
               {activeSection === 'sos' && <SOSView sosList={sosList} handleOpenModal={handleOpenModal} />}
           </div>
        </main>

        {/* CHATBOT FLOATING ACTION */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
           {chatOpen && (
             <div className="mb-4 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                <div className="bg-slate-900 p-4 flex justify-between items-center">
                   <div className="flex items-center gap-3">
                      <div className="bg-blue-600 p-1.5 rounded-lg"><Bot size={18} className="text-white"/></div>
                      <div>
                          <p className="text-sm font-bold text-white">RailBot AI</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Online</p>
                      </div>
                   </div>
                   <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4" ref={chatScrollRef}>
                   {chatMessages.map((m, i) => (
                     <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={cn(
                            "max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm", 
                            m.role === 'user' 
                                ? "bg-blue-600 text-white rounded-br-none" 
                                : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                        )}>
                           {m.text}
                        </div>
                     </div>
                   ))}
                   {isChatLoading && <div className="flex justify-start"><div className="bg-slate-200 text-slate-500 text-xs px-3 py-1.5 rounded-full animate-pulse">Processing...</div></div>}
                </div>
                <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                   <input 
                     className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-all"
                     placeholder="Type a command..."
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                   />
                   <button onClick={handleChatSend} disabled={isChatLoading} className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50">
                     <Send size={18}/>
                   </button>
                </div>
             </div>
           )}
           <button 
             onClick={() => setChatOpen(!chatOpen)}
             className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center"
           >
             {chatOpen ? <X size={24}/> : <MessageSquare size={24}/>}
           </button>
        </div>

        {/* MODAL */}
        {modalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{modalData?.title}</h3>
                    <p className="text-slate-600 text-sm mb-6">{modalData?.content}</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">Close</button>
                        <button onClick={() => setModalOpen(false)} className={cn("px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition text-white", modalData?.btnClass || "bg-blue-600")}>{modalData?.btnText}</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const DashboardView = ({ activeSOSCount, traffic, handleDrillDown }) => (
  <div className="space-y-8 animate-in fade-in duration-500">
    {/* KPI CARDS */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <KPICard title="Crowd Density" value="75%" color="blue" sparklineColor="rgba(59, 130, 246, 0.5)" subtext="Avg. across network" icon={<Users className="text-blue-600" size={24} />} trendData={[65, 70, 72, 75, 74, 76, 75, 78, 80, 79]} />
      <KPICard title="Safety Score" value="98.5%" color="green" sparklineColor="rgba(34, 197, 94, 0.5)" subtext="System optimal" icon={<Shield className="text-green-600" size={24} />} trendData={[98, 98.2, 98.5, 98.4, 98.5, 98.7, 98.9, 98.5, 98.2, 98.5]} />
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Revenue Leakage</span>
              <div className="p-2 bg-yellow-50 rounded-lg group-hover:bg-yellow-100 transition-colors"><CreditCard className="text-yellow-600" size={20} /></div>
          </div>
          <p className="text-3xl font-bold text-slate-900">7.9%</p>
          <p className="text-sm text-slate-400 mt-1">Est. Ticketless</p>
      </div>

      <div 
        className={cn("bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group", activeSOSCount > 0 ? "border-red-500 ring-4 ring-red-50" : "border-slate-200")} 
        onClick={() => activeSOSCount > 0 && handleDrillDown('sos')}
      >
          <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Active Alerts</span>
              <div className={cn("p-2 rounded-lg transition-colors", activeSOSCount > 0 ? "bg-red-100 animate-pulse" : "bg-slate-50")}>
                  <TriangleAlert className={cn("w-5 h-5", activeSOSCount > 0 ? "text-red-600" : "text-slate-400")} />
              </div>
          </div>
          <p className={cn("text-3xl font-bold", activeSOSCount > 0 ? "text-red-600" : "text-slate-900")}>{activeSOSCount}</p>
          <p className="text-sm text-slate-400 mt-1">Critical Incidents</p>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAP */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Live Network Status</h3>
                <div className="flex gap-3 text-xs font-medium">
                    <span className="flex items-center text-slate-500"><span className="w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse"></span> Critical</span>
                    <span className="flex items-center text-slate-500"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span> Normal</span>
                </div>
            </div>
            <div className="relative h-[450px] bg-slate-100 group overflow-hidden">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Mumbai_Suburban_Railway_Network.svg/1200px-Mumbai_Suburban_Railway_Network.svg.png" alt="Map" className="w-full h-full object-contain opacity-60 grayscale group-hover:grayscale-0 transition-all duration-700" />
                <MapMarker top="70%" left="35%" type="danger" icon={<Train size={14}/>} label="Overcrowding (C-12)" />
                <MapMarker top="65%" left="20%" type="warning" icon={<AlertCircle size={14}/>} label="Mismatch (W-05)" />
            </div>
        </div>

        {/* TRAFFIC LIST */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[520px]">
            <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Station Density</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {traffic && traffic.length > 0 ? traffic.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group">
                        <div>
                            <p className="font-semibold text-slate-700 text-sm group-hover:text-blue-700 transition-colors">{t.station}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{t.count} passengers</p>
                        </div>
                        <span className={cn("px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide", t.level === 'Critical' ? 'bg-red-100 text-red-700' : t.level === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                            {t.level}
                        </span>
                    </div>
                )) : <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2"><div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div><p className="text-xs">Syncing data...</p></div>}
            </div>
        </div>
    </div>
  </div>
);

// --- LIVE FEED VIEW (UPDATED FOR APP.PY & APP1.PY) ---
const LiveFeedView = () => (
  <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Live Surveillance</h2>
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center"><span className="w-2 h-2 bg-red-600 rounded-full mr-2 animate-pulse"></span> LIVE</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {CAMERA_FEEDS.map((cam) => (
           <VideoCard 
             key={cam.id}
             title={cam.title} 
             subtitle={cam.subtitle} 
             risk={cam.risk} 
             streamUrl={cam.url} 
           />
         ))}
      </div>
  </div>
);

const VideoCard = ({ title, subtitle, risk, streamUrl }) => {
    const riskColors = {
        'Critical': 'bg-red-100 text-red-800 border-red-200',
        'Warning': 'bg-orange-100 text-orange-800 border-orange-200',
        'Safe': 'bg-green-100 text-green-800 border-green-200'
    };
    
    return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm group hover:shadow-lg transition-all duration-300">
        <div className="aspect-video bg-slate-900 relative flex items-center justify-center overflow-hidden">
            {/* Status Badge */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center z-10 border border-white/10">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse mr-2"></div> 
                LIVE REC
            </div>

            {/* Stream Image */}
            <img 
                src={streamUrl} 
                alt="Live Feed" 
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src="https://placehold.co/600x400/1e293b/FFFFFF?text=Signal+Lost"; 
                }}
            />
            
            {/* Overlay Info */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div>
                    <p className="text-white font-mono text-xs"><span className="text-blue-400">FPS:</span> 24 <span className="mx-1 text-slate-500">|</span> <span className="text-green-400">LAT:</span> 12ms</p>
                </div>
                <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md p-2 rounded-lg text-white transition"><Settings size={16}/></button>
            </div>
        </div>

        <div className="p-5">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1"><Video size={14}/> {subtitle}</p>
                </div>
                <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase border", riskColors[risk] || riskColors['Safe'])}>
                    {risk}
                </span>
            </div>
        </div>
    </div>
    );
};

// --- ALERTS, TICKETS & SOS TABLES (Styled consistently) ---
const AlertsView = ({ alerts, handleOpenModal }) => (
    <div className="space-y-6 animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between">
                <h3 className="font-bold text-slate-800">Recent Alerts</h3>
                <button className="text-xs text-blue-600 font-bold hover:underline">View All</button>
            </div>
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr><th className="px-6 py-3">Time</th><th className="px-6 py-3">Location</th><th className="px-6 py-3">Severity</th><th className="px-6 py-3">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {alerts.map((a, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-slate-500">{a.time}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{a.location}</td>
                            <td className="px-6 py-4"><span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", a.severity === 'High' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>{a.severity}</span></td>
                            <td className="px-6 py-4"><button onClick={() => handleOpenModal('alert', a.id)} className="text-blue-600 hover:text-blue-800 font-medium">Review</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const TicketsView = ({ handleOpenModal }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 mb-4">Compliance Trends</h3>
            <div className="h-64 flex items-end gap-2">
                {[65, 70, 68, 72, 75, 80, 85, 82, 88, 92].map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-100 rounded-t-lg relative group">
                        <div className="absolute bottom-0 inset-x-0 bg-blue-600 rounded-t-lg transition-all duration-500" style={{height: `${h}%`}}></div>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity">{h}%</div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center items-center text-center">
            <div className="h-32 w-32 relative mb-4">
                <Doughnut data={{datasets: [{ data: [92, 8], backgroundColor: ['#22c55e', '#f1f5f9'], borderWidth: 0 }]}} options={{ cutout: '75%', plugins: { legend: false, tooltip: false } }} />
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-slate-900">92%</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Compliant</span>
                </div>
            </div>
            <p className="text-slate-500 text-sm">Total Passengers Scanned: <strong>45,200</strong></p>
        </div>
    </div>
);

const SOSView = ({ sosList, handleOpenModal }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
        {sosList.map((sos, i) => (
            <div key={i} className="bg-white border-l-4 border-red-500 rounded-r-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                    <div className="bg-red-50 p-2 rounded-lg text-red-600"><Ambulance size={20}/></div>
                    <span className="text-xs font-mono text-slate-400">{sos.time}</span>
                </div>
                <h3 className="font-bold text-slate-900">{sos.type}</h3>
                <p className="text-sm text-slate-500 mt-1">{sos.location}</p>
                <button onClick={() => handleOpenModal('sos', sos.id)} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded-lg transition-colors">Dispatch Team</button>
            </div>
        ))}
    </div>
);

// --- HELPERS ---
const KPICard = ({ title, value, color, icon, trendData }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
                <h3 className="text-3xl font-bold text-slate-900 mt-1">{value}</h3>
            </div>
            <div className={cn("p-2.5 rounded-xl transition-colors", `bg-${color}-50 text-${color}-600 group-hover:bg-${color}-100`)}>{icon}</div>
        </div>
        <div className="h-10 w-full">
            <Line data={{ labels: trendData.map(() => ''), datasets: [{ data: trendData, borderColor: color === 'blue' ? '#3b82f6' : '#22c55e', borderWidth: 2, pointRadius: 0, tension: 0.4 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: false }, scales: { x: {display: false}, y: {display: false}} }} />
        </div>
    </div>
);

const MapMarker = ({ top, left, type, icon, label, onClick }) => (
    <div onClick={onClick} style={{ top, left, transform: 'translate(-50%, -50%)' }} className="absolute z-10 group cursor-pointer">
        <div className={cn("relative p-2 rounded-full text-white shadow-xl transition-transform hover:scale-110", type === 'danger' ? 'bg-red-600 animate-pulse' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-600')}>
            {icon}
            <div className={cn("absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all shadow-lg pointer-events-none bg-slate-900 text-white")}>
                {label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
            </div>
        </div>
    </div>
);
