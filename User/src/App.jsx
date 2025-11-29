import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  Mic, 
  Send, 
  Ticket, 
  Wallet, 
  Train, 
  ShieldCheck, 
  Activity, 
  Menu, 
  Home, 
  AlertCircle, 
  X,
  Bluetooth,
  ArrowRight,
  MapPin,
  Calendar,
  User
} from 'lucide-react';

// --- CONFIGURATION & CONSTANTS ---

// Point this to your Node.js/MongoDB Server
const API_URL = "http://localhost:4000/api";

// Mock Data for "RAG" Database (Train Schedules & Rules)
const TRAIN_DB = [
  { id: 't1', name: 'Slow Local', route: 'CST-Kalyan', next: '10:45 AM', platform: '1' },
  { id: 't2', name: 'Fast Local', route: 'Churchgate-Virar', next: '10:50 AM', platform: '4' },
  { id: 't3', name: 'AC Local', route: 'CST-Thane', next: '11:15 AM', platform: '2' },
  { id: 'rule1', topic: 'penalty', content: 'Ticketless travel calls for a fine of Rs. 260 + fare.' },
  { id: 'rule2', topic: 'senior', content: 'Senior citizens get 30% concession on first class.' },
];

const STATIONS = [
  { name: 'Churchgate', distance: 0 },
  { name: 'Mumbai Central', distance: 5 },
  { name: 'Dadar', distance: 10 },
  { name: 'Bandra', distance: 15 },
  { name: 'Andheri', distance: 22 },
  { name: 'Borivali', distance: 34 },
  { name: 'Virar', distance: 60 },
];

// --- BACKEND SIMULATION LAYER ---

const Backend = {
  // 1. Pricing Engine
  calculateFare: (source, destination, classType = 'second') => {
    const s1 = STATIONS.find(s => s.name === source);
    const s2 = STATIONS.find(s => s.name === destination);
    if (!s1 || !s2) return 0;
    const dist = Math.abs(s1.distance - s2.distance);
    let base = Math.max(5, dist * 0.8);
    if (classType === 'first') base *= 10;
    if (classType === 'ac') base *= 15;
    return Math.ceil(base);
  },

  // 2. BLE & QR Generator
  generateSecureTokens: () => {
    const qrData = `TKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const bleToken = `BLE-UUID-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    return { qrData, bleToken };
  },

  // 3. Payment Gateway Logic (Simulated)
  processPayment: async (amount, method, walletBalance) => {
    return new Promise((resolve, reject) => {
      if (method === 'wallet') {
        if (walletBalance >= amount) {
          setTimeout(() => resolve({ success: true, message: 'Wallet deducted' }), 500);
        } else {
          setTimeout(() => resolve({ success: false, message: 'Insufficient funds' }), 500);
        }
      } else {
        // External gateways are handled by the UI Modal flow, this checks validity
        resolve({ success: true, message: 'Initiating Gateway...' });
      }
    });
  },

  // 4. Agentic AI Logic
  processAgentRequest: (input, walletBalance) => {
    const lowerInput = input.toLowerCase();
    
    // Intent: Booking
    if (lowerInput.includes('book') || lowerInput.includes('ticket')) {
      const fromMatch = STATIONS.find(s => lowerInput.includes(s.name.toLowerCase()) && lowerInput.indexOf(s.name.toLowerCase()) < lowerInput.indexOf('to'));
      const toMatch = STATIONS.find(s => lowerInput.includes(s.name.toLowerCase()) && (lowerInput.includes('to ' + s.name.toLowerCase()) || !lowerInput.includes('from')));
      
      if (!fromMatch && !toMatch) {
         const found = STATIONS.filter(s => lowerInput.includes(s.name.toLowerCase()));
         if(found.length >= 2) {
             return { 
                 type: 'BOOK_INTENT', 
                 source: found[0].name, 
                 destination: found[1].name,
                 price: Backend.calculateFare(found[0].name, found[1].name),
                 walletBalance
             };
         }
      }

      if (fromMatch && toMatch) {
         return { 
             type: 'BOOK_INTENT', 
             source: fromMatch.name, 
             destination: toMatch.name,
             price: Backend.calculateFare(fromMatch.name, toMatch.name),
             walletBalance
         };
      }
      return { type: 'ERROR', message: "I heard you want to book, but I couldn't catch the stations. Try 'Book from Dadar to Virar'." };
    }

    if (lowerInput.includes('profile')) return { type: 'NAVIGATE', target: 'profile' };
    if (lowerInput.includes('wallet')) return { type: 'NAVIGATE', target: 'wallet' };
    
    // Intent: RAG Chat
    const keywords = lowerInput.split(' ');
    let bestMatch = null;
    let maxHits = 0;

    [...TRAIN_DB, ...STATIONS].forEach(doc => {
      let hits = 0;
      const text = JSON.stringify(doc).toLowerCase();
      keywords.forEach(k => {
        if (k.length > 3 && text.includes(k)) hits++;
      });
      if (hits > maxHits) {
        maxHits = hits;
        bestMatch = doc;
      }
    });

    if (maxHits > 0) {
      if (bestMatch.route) return { type: 'CHAT_RESPONSE', message: `Found in DB: Train ${bestMatch.name} runs ${bestMatch.route}. Next at ${bestMatch.next}.` };
      if (bestMatch.distance !== undefined) return { type: 'CHAT_RESPONSE', message: `Station info: ${bestMatch.name} is ${bestMatch.distance}km from origin.` };
      if (bestMatch.content) return { type: 'CHAT_RESPONSE', message: `Rule Book: ${bestMatch.content}` };
    }

    return { type: 'CHAT_RESPONSE', message: "I can only answer queries about the Mumbai Rail system based on my internal database." };
  }
};

// --- REACT COMPONENTS ---

const PaymentGateway = ({ config, onComplete, onCancel }) => {
  const [step, setStep] = useState('input');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState({});

  const handleCardNumber = (e) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
    if(errors.card) setErrors({...errors, card: null});
  };

  const handleExpiry = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 2) val = val.substring(0,2) + '/' + val.substring(2);
    setExpiry(val);
    if(errors.expiry) setErrors({...errors, expiry: null});
  };

  const handleCvv = (e) => {
      const val = e.target.value.replace(/\D/g, '').substring(0, 3);
      setCvv(val);
      if(errors.cvv) setErrors({...errors, cvv: null});
  };

  const validate = () => {
      const newErrors = {};
      if (config.method === 'upi') {
          const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
          if (!upiId) newErrors.upi = "UPI ID is required";
          else if (!upiRegex.test(upiId)) newErrors.upi = "Invalid UPI ID format (e.g. user@oksbi)";
      } else {
          const rawCard = cardNumber.replace(/\s/g, '');
          if (!rawCard) newErrors.card = "Card number is required";
          else if (rawCard.length !== 16) newErrors.card = "Invalid card number (16 digits required)";
          
          if (!expiry) newErrors.expiry = "Required";
          else if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiry)) newErrors.expiry = "Invalid (MM/YY)";
          else {
              const [mm, yy] = expiry.split('/').map(Number);
              const now = new Date();
              const currentYear = now.getFullYear() % 100;
              const currentMonth = now.getMonth() + 1;
              if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
                  newErrors.expiry = "Card expired";
              }
          }
          if (!cvv) newErrors.cvv = "Required";
          else if (cvv.length !== 3) newErrors.cvv = "Invalid CVV (3 digits)";
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const process = () => {
    if (!validate()) return;
    setStep('processing');
    setTimeout(() => {
        setStep('success');
        setTimeout(() => {
            onComplete();
        }, 1500);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
       <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-300">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-green-500/20 rounded-full">
                     <ShieldCheck className="w-5 h-5 text-green-400"/>
                 </div>
                 <span className="font-bold text-lg tracking-tight">Secure Payment</span>
             </div>
             <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                 <X className="w-5 h-5 opacity-70 hover:opacity-100"/>
             </button>
          </div>
          
          <div className="p-8">
             <div className="mb-8 text-center border-b border-gray-100 pb-6">
                <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-1">Total Amount</p>
                <div className="flex items-center justify-center gap-1 text-slate-900">
                    <span className="text-2xl font-medium">₹</span>
                    <span className="text-5xl font-bold tracking-tight">{config.amount}</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold mt-4 uppercase tracking-wide border border-blue-100">
                    {config.method === 'upi' ? <Smartphone className="w-3 h-3"/> : <CreditCard className="w-3 h-3"/>}
                    {config.method}
                </div>
             </div>

             {step === 'input' && (
                <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500">
                   {config.method === 'upi' ? (
                       <div className="group">
                          <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">UPI ID / VPA</label>
                          <input 
                            type="text" 
                            placeholder="username@bank" 
                            className={`w-full p-4 bg-slate-50 border-2 rounded-xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 ${errors.upi ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-100 focus:border-blue-500 focus:bg-white'}`}
                            value={upiId} 
                            onChange={e=> { setUpiId(e.target.value); if(errors.upi) setErrors({...errors, upi: null}); }} 
                          />
                          {errors.upi && <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-medium"><AlertCircle className="w-3 h-3"/> {errors.upi}</p>}
                       </div>
                   ) : (
                       <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Card Number</label>
                            <div className="relative">
                                <CreditCard className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="0000 0000 0000 0000" 
                                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 rounded-xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 ${errors.card ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-100 focus:border-blue-500 focus:bg-white'}`}
                                    value={cardNumber} 
                                    onChange={handleCardNumber} 
                                    maxLength={19}
                                />
                            </div>
                            {errors.card && <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-medium"><AlertCircle className="w-3 h-3"/> {errors.card}</p>}
                          </div>
                          <div className="flex gap-4">
                             <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Expiry</label>
                                <input 
                                    type="text" 
                                    placeholder="MM/YY" 
                                    className={`w-full p-4 bg-slate-50 border-2 rounded-xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 ${errors.expiry ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-100 focus:border-blue-500 focus:bg-white'}`}
                                    value={expiry}
                                    onChange={handleExpiry}
                                    maxLength={5}
                                />
                                {errors.expiry && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.expiry}</p>}
                             </div>
                             <div className="w-28">
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">CVV</label>
                                <input 
                                    type="password" 
                                    placeholder="123" 
                                    className={`w-full p-4 bg-slate-50 border-2 rounded-xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400 ${errors.cvv ? 'border-red-400 bg-red-50 focus:border-red-500' : 'border-slate-100 focus:border-blue-500 focus:bg-white'}`}
                                    value={cvv}
                                    onChange={handleCvv}
                                    maxLength={3}
                                />
                                {errors.cvv && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.cvv}</p>}
                             </div>
                          </div>
                       </div>
                   )}
                   <button onClick={process} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all shadow-xl shadow-slate-200 mt-4 flex items-center justify-center gap-2">
                       <span>Pay Securely</span>
                       <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
             )}

             {step === 'processing' && (
                <div className="py-12 flex flex-col items-center gap-6 animate-in fade-in">
                   <div className="relative">
                       <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
                       <div className="w-16 h-16 border-4 border-blue-600 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
                   </div>
                   <div className="text-center space-y-2">
                       <p className="text-lg font-bold text-slate-800">Processing Payment</p>
                       <p className="text-sm text-slate-500 animate-pulse">Connecting to bank server securely...</p>
                   </div>
                </div>
             )}

             {step === 'success' && (
                <div className="py-10 flex flex-col items-center gap-6 animate-in zoom-in duration-300">
                   <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-100">
                      <ShieldCheck className="w-10 h-10" />
                   </div>
                   <div className="text-center space-y-2">
                       <p className="text-2xl font-bold text-slate-900">Payment Successful</p>
                       <p className="text-sm text-slate-500 font-mono bg-slate-100 px-3 py-1 rounded-full inline-block">Ref: {Math.random().toString(36).substr(2,9).toUpperCase()}</p>
                   </div>
                </div>
             )}
          </div>
          <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
             <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                 <ShieldCheck className="w-3 h-3 text-green-500"/> 
                 256-bit SSL Encrypted & Secure
             </p>
          </div>
       </div>
    </div>
  );
};

const Header = ({ user, toggleMenu }) => (
  <header className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 shadow-lg sticky top-0 z-40 border-b border-white/10">
    <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Train className="w-6 h-6 text-white" />
        </div>
        <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Mumb-AI Rail</h1>
            <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">Smart Transit System</p>
        </div>
        </div>
        <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Wallet Balance</p>
            <p className="font-bold text-emerald-400 text-lg tabular-nums">₹{user?.wallet?.toLocaleString() || 0}</p>
        </div>
        <button onClick={toggleMenu} className="p-2.5 hover:bg-white/10 rounded-full transition-colors active:scale-90">
            <Menu className="w-6 h-6 text-slate-200" />
        </button>
        </div>
    </div>
  </header>
);

const Navigation = ({ setView, view }) => {
  const items = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'book', icon: Ticket, label: 'Book' },
    { id: 'assistant', icon: Mic, label: 'Assistant' },
    { id: 'wallet', icon: Wallet, label: 'Wallet' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 pb-safe z-40 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
      <div className="max-w-md mx-auto flex justify-around items-center h-[72px]">
        {items.map(item => {
          const isActive = view === item.id;
          return (
            <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`group flex flex-col items-center gap-1.5 w-full h-full justify-center transition-all duration-300 relative ${isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
                {isActive && (
                    <span className="absolute -top-[1px] w-12 h-1 bg-blue-600 rounded-b-full shadow-[0_4px_12px_-2px_rgba(37,99,235,0.5)]"></span>
                )}
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-50 -translate-y-1' : ''}`}>
                    <item.icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] font-bold tracking-wide transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-70 group-hover:opacity-100'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  );
};

const TicketCard = ({ ticket }) => {
  const [showQR, setShowQR] = useState(false);
  const isActive = new Date() < new Date(ticket.expiresAt);

  return (
    <div className={`group relative overflow-hidden rounded-3xl shadow-lg transition-all duration-500 hover:shadow-xl ${isActive ? 'bg-white ring-1 ring-slate-100' : 'bg-slate-100 opacity-80 grayscale-[0.8]'}`}>
      {!isActive && (
          <div className="absolute inset-0 z-20 bg-slate-900/5 backdrop-blur-[1px] flex items-center justify-center">
              <div className="bg-slate-800 text-white px-6 py-2 rounded-full font-bold text-sm shadow-xl transform -rotate-6 border border-white/20">
                  EXPIRED TICKET
              </div>
          </div>
      )}
      
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 flex justify-between items-center text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
        
        <div className="relative z-10 flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                <Train className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-widest text-xs opacity-90">UTS / MUMBAI</span>
        </div>
        <span className="relative z-10 text-[10px] font-mono bg-black/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 shadow-sm">
            #{ticket.tid.slice(-6).toUpperCase()}
        </span>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6 relative">
          <div className="flex-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Source</p>
            <p className="text-xl font-bold text-slate-800 leading-none">{ticket.source || ticket.meta?.source}</p>
          </div>
          
          <div className="flex flex-col items-center px-4 shrink-0">
            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full mb-2">{ticket.distance} km</span>
            <div className="w-16 h-[2px] bg-slate-200 relative">
              <div className="absolute -top-1 left-0 w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
              <div className="absolute -top-1 right-0 w-2 h-2 bg-slate-300 rounded-full"></div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 mt-2" />
          </div>

          <div className="flex-1 text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Destination</p>
            <p className="text-xl font-bold text-slate-800 leading-none">{ticket.destination || ticket.meta?.destination}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                <p className="text-slate-400 text-[10px] font-bold uppercase">Class</p>
            </div>
            <p className="font-bold text-slate-700 capitalize text-sm">{ticket.classType || ticket.meta?.classType}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-1">
                <User className="w-3 h-3 text-slate-400" />
                <p className="text-slate-400 text-[10px] font-bold uppercase">Passengers</p>
            </div>
            <p className="font-bold text-slate-700 text-sm">{ticket.count || ticket.meta?.count} Adult</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div 
            className="w-full relative group/qr cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-colors bg-blue-50/50" 
            onClick={() => setShowQR(!showQR)}
          >
              {showQR ? (
                <div className="bg-white flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
                  {ticket.qrDataUrl ? (
                      <div className="p-2 bg-white rounded-xl shadow-lg">
                          <img src={ticket.qrDataUrl} alt="QR" className="w-40 h-40 object-contain mix-blend-multiply" />
                      </div>
                  ) : (
                      <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium rounded-xl">No QR Data</div>
                  )}
                  <p className="text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-wide">Tap to hide</p>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3 text-blue-600 transition-transform duration-300 group-hover/qr:scale-105">
                  <div className="bg-white p-3 rounded-full shadow-md shadow-blue-100">
                      <QrCode className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold tracking-wide uppercase">Tap to Reveal QR</span>
                </div>
              )}
          </div>
          
          <div className="w-full flex items-center justify-between bg-emerald-50/80 px-4 py-3 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2.5">
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
                    <div className="bg-emerald-500 p-1 rounded-full relative z-10">
                        <Bluetooth className="w-3 h-3 text-white" />
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Bluetooth Beacon</span>
                    <span className="text-[10px] font-medium text-emerald-600">Broadcasting Ticket ID</span>
                </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white/50 px-2 py-1 rounded-md border border-emerald-100/50">
                {ticket.tid.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Assistant = ({ user, refreshUser, finalizeBooking }) => {
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hello! I am your Mumbai Rail Assistant. I can book tickets, check your wallet, or answer train queries.' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Voice not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) setInput(transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') setErrorMsg("Mic blocked. Check permissions.");
        else setErrorMsg(`Error: ${event.error}`);
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (e) {
        console.error("Start error:", e);
        setErrorMsg("Could not start microphone.");
        setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    setErrorMsg(null);

    const response = Backend.processAgentRequest(userMsg.content, user.wallet);
    
    setTimeout(() => {
      setIsProcessing(false);
      if (response.type === 'BOOK_INTENT') {
        if (user.wallet >= response.price) {
          setPendingBooking(response);
          setMessages(prev => [...prev, { role: 'system', content: `I found a route from ${response.source} to ${response.destination} for ₹${response.price}. Your wallet balance is ₹${user.wallet}. Should I confirm this booking?` }]);
        } else {
          setMessages(prev => [...prev, { role: 'system', content: `I found the route, but the fare is ₹${response.price} and you only have ₹${user.wallet}. Please initiate a manual booking to use UPI/Card.` }]);
        }
      } else if (response.type === 'NAVIGATE') {
        setMessages(prev => [...prev, { role: 'system', content: `Navigating to ${response.target}...` }]);
      } else if (response.type === 'CHAT_RESPONSE') {
        setMessages(prev => [...prev, { role: 'system', content: response.message }]);
      } else {
        setMessages(prev => [...prev, { role: 'system', content: response.message || "I didn't understand that." }]);
      }
    }, 1000); 
  };

  const confirmBooking = async () => {
    if (!pendingBooking) return;
    setIsProcessing(true);
    
    try {
        const payResult = await Backend.processPayment(pendingBooking.price, 'wallet', user.wallet);
        
        if (payResult.success) {
            await finalizeBooking({
                source: pendingBooking.source,
                destination: pendingBooking.destination,
                amount: pendingBooking.price,
                classType: 'second',
                count: 1,
                method: 'AI-Agent (Wallet)'
            });

            setMessages(prev => [...prev, { role: 'system', content: 'Ticket booked successfully! Amount deducted from wallet.' }]);
            setPendingBooking(null);
            refreshUser(); 
        } else {
            setMessages(prev => [...prev, { role: 'system', content: `Booking failed: ${payResult.message}` }]);
        }
    } catch (e) {
        console.error(e);
        setMessages(prev => [...prev, { role: 'system', content: 'Something went wrong.' }]);
    }
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            {m.role === 'system' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 shrink-0 self-end mb-1">
                    <Train className="w-4 h-4 text-indigo-600" />
                </div>
            )}
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm leading-relaxed ${
                m.role === 'user' 
                ? 'bg-slate-900 text-white rounded-br-none shadow-slate-200' 
                : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isProcessing && (
            <div className="flex items-center gap-2 ml-10">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
            </div>
        )}
        {errorMsg && (
            <div className="bg-red-50 text-red-600 text-xs px-4 py-3 rounded-xl mx-auto flex items-center gap-2 max-w-xs border border-red-100 animate-in fade-in">
                <AlertCircle className="w-4 h-4"/> {errorMsg}
            </div>
        )}
        
        {pendingBooking && (
            <div className="ml-10 bg-white p-5 rounded-2xl shadow-xl shadow-indigo-100 border border-indigo-50 max-w-xs animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                    <p className="font-bold text-slate-800 text-sm">Confirm Booking</p>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">Fast Track</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-5 bg-slate-50 p-3 rounded-lg">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Route</span>
                        <span className="font-bold text-slate-700">{pendingBooking.source} → {pendingBooking.destination}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Fare</span>
                        <span className="block font-bold text-lg text-slate-900">₹{pendingBooking.price}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={confirmBooking} className="bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200">Confirm & Pay</button>
                    <button onClick={() => setPendingBooking(null)} className="bg-white border border-slate-200 text-slate-600 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-[84px] left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="max-w-md mx-auto bg-white p-2 rounded-[2rem] shadow-2xl shadow-indigo-100 border border-slate-100 flex items-center gap-2 pl-4">
            <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask me anything..."}
            className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 font-medium h-10"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
                onClick={input ? handleSend : toggleListening} 
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200' 
                    : input 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 rotate-0' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 rotate-90'
                }`}
            >
                {input ? <Send className="w-4 h-4 ml-0.5" /> : <Mic className="w-4 h-4" />}
            </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---

export default function App() {
  const [user, setUser] = useState({ uid: null, wallet: 0 });
  const [view, setView] = useState('home');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gatewayConfig, setGatewayConfig] = useState(null);

  useEffect(() => {
    let uid = localStorage.getItem('rail_uid');
    if (!uid) {
        uid = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('rail_uid', uid);
    }
    
    const savedWallet = localStorage.getItem('rail_wallet');
    const walletBalance = savedWallet ? parseInt(savedWallet) : 500;

    setUser({ uid, wallet: walletBalance });
    fetchTickets(uid);
    setLoading(false);
  }, []);

  const fetchTickets = async (uid) => {
      try {
          const res = await fetch(`${API_URL}/user/${uid}`);
          const data = await res.json();
          if (data.ok) {
              setTickets(data.tickets);
          }
      } catch (err) {
          console.error("Server connection failed", err);
      }
  };

  const updateWallet = (newBalance) => {
      localStorage.setItem('rail_wallet', newBalance);
      setUser(prev => ({ ...prev, wallet: newBalance }));
  };

  // Booking Flow State
  const [bookSrc, setBookSrc] = useState('Dadar');
  const [bookDst, setBookDst] = useState('Virar');
  const [bookClass, setBookClass] = useState('second');
  const [bookQty, setBookQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [topUpAmount, setTopUpAmount] = useState('');

  const finalizeBooking = async (config) => {
    try {
        const payload = {
            uid: user.uid,
            expiryMinutes: 60,
            meta: {
                source: config.source,
                destination: config.destination,
                amount: config.amount,
                classType: config.classType,
                count: config.count,
                bookingMethod: config.method
            }
        };

        const res = await fetch(`${API_URL}/createTicket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.ok) {
            if (config.method.includes('Wallet') || config.method === 'wallet') {
                 updateWallet(user.wallet - config.amount);
            }
            
            setGatewayConfig(null);
            setView('home');
            fetchTickets(user.uid); 
            alert("Ticket Booked Successfully!");
        } else {
            alert("Booking Failed: " + data.err);
        }
    } catch (e) {
        console.error(e);
        alert("Server Error. Ensure Node.js is running on port 4000.");
    }
  };

  const finalizeTopUp = async (config) => {
      const newBalance = user.wallet + config.amount;
      updateWallet(newBalance);
      setGatewayConfig(null);
      setTopUpAmount('');
      alert(`₹${config.amount} Added successfully!`);
  };

  const handleManualBooking = async () => {
    if(!user) return;
    const unitFare = Backend.calculateFare(bookSrc, bookDst, bookClass);
    const totalFare = unitFare * bookQty;
    
    if (paymentMethod === 'wallet') {
        const payRes = await Backend.processPayment(totalFare, 'wallet', user.wallet);
        if(payRes.success) {
             await finalizeBooking({ 
                 source: bookSrc, destination: bookDst, amount: totalFare, 
                 classType: bookClass, count: bookQty, method: 'wallet' 
             });
        } else {
            alert(payRes.message);
        }
    } else {
        setGatewayConfig({
            type: 'BOOKING',
            amount: totalFare,
            method: paymentMethod,
            source: bookSrc, destination: bookDst, 
            classType: bookClass, count: bookQty
        });
    }
  };

  const initTopUp = (method) => {
      if (!topUpAmount || isNaN(topUpAmount) || Number(topUpAmount) <= 0) {
          alert("Enter valid amount");
          return;
      }
      setGatewayConfig({
          type: 'TOPUP',
          amount: Number(topUpAmount),
          method: method
      });
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-white flex-col gap-6">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-slate-700 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-500 rounded-full animate-spin absolute top-0 left-0 border-t-transparent"></div>
            <Train className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
        </div>
        <p className="font-medium tracking-wide animate-pulse text-slate-400">Loading Transit System...</p>
    </div>
  );

  return (
    // MAIN WRAPPER: Ensures app centers on desktop but fills screen on mobile
    <div className="bg-slate-100 min-h-screen font-sans text-slate-900 flex justify-center selection:bg-blue-100 selection:text-blue-900">
      
      {/* APP CONTAINER: Limits width on desktop, adds shadow/radius */}
      <div className="w-full max-w-md bg-slate-50 h-[100dvh] sm:h-[95vh] sm:my-auto sm:rounded-[2.5rem] sm:shadow-2xl sm:shadow-slate-400/20 sm:border-[8px] sm:border-white relative overflow-hidden flex flex-col">
        
        <Header user={user} toggleMenu={() => setView('profile')} />

        {/* PAYMENT OVERLAY */}
        {gatewayConfig && (
            <PaymentGateway 
                config={gatewayConfig}
                onCancel={() => setGatewayConfig(null)}
                onComplete={() => {
                    if (gatewayConfig.type === 'BOOKING') finalizeBooking(gatewayConfig);
                    else finalizeTopUp(gatewayConfig);
                }}
            />
        )}

        {/* MAIN SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          
          {/* HOME VIEW */}
          {view === 'home' && (
            <div className="p-5 space-y-8 animate-in fade-in duration-500">
                
                {/* HERO ACTIONS */}
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setView('book')} className="group relative overflow-hidden bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-100 transition-colors"></div>
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="bg-blue-50 p-4 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-blue-100">
                                <Ticket className="w-6 h-6" strokeWidth={2.5}/>
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">Book Ticket</span>
                        </div>
                    </button>
                    <button onClick={() => setView('assistant')} className="group relative overflow-hidden bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-100 transition-colors"></div>
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-indigo-100">
                                <Mic className="w-6 h-6" strokeWidth={2.5}/>
                            </div>
                            <span className="font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">AI Assistant</span>
                        </div>
                    </button>
                </div>

                {/* ACTIVE TICKETS */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Active Journey
                        </h2>
                        {tickets.length > 0 && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{tickets.length}</span>}
                    </div>
                    {tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                <Ticket className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-medium">No active tickets found.</p>
                            <button onClick={() => setView('book')} className="mt-4 text-xs font-bold text-blue-600 hover:underline">Start a new journey</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map(t => <TicketCard key={t._id || t.tid} ticket={t} />)}
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* BOOKING VIEW */}
          {view === 'book' && (
            <div className="p-6 h-full flex flex-col animate-in slide-in-from-right duration-300">
              <div className="mb-6">
                 <h2 className="text-2xl font-bold text-slate-800">Plan Journey</h2>
                 <p className="text-slate-400 text-sm">Select stations to book your ticket</p>
              </div>
              
              <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6 relative overflow-hidden">
                  
                  {/* Stations Input */}
                  <div className="relative space-y-4">
                      {/* Connector Line */}
                      <div className="absolute left-[1.15rem] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500 via-slate-200 to-red-400 rounded-full"></div>
                      
                      <div className="relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center">
                              <div className="w-3 h-3 bg-blue-500 rounded-full ring-4 ring-white shadow-md"></div>
                          </div>
                          <div className="ml-12">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">From Station</label>
                              <div className="relative">
                                  <select value={bookSrc} onChange={e=>setBookSrc(e.target.value)} className="w-full p-3 pl-4 bg-slate-50 hover:bg-slate-100 rounded-xl border-none outline-none font-bold text-slate-700 appearance-none transition-colors cursor-pointer focus:ring-2 focus:ring-blue-100">
                                      {STATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                  </select>
                                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                              </div>
                          </div>
                      </div>

                      <div className="relative">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center">
                              <div className="w-3 h-3 bg-red-400 rounded-full ring-4 ring-white shadow-md"></div>
                          </div>
                          <div className="ml-12">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">To Station</label>
                              <div className="relative">
                                  <select value={bookDst} onChange={e=>setBookDst(e.target.value)} className="w-full p-3 pl-4 bg-slate-50 hover:bg-slate-100 rounded-xl border-none outline-none font-bold text-slate-700 appearance-none transition-colors cursor-pointer focus:ring-2 focus:ring-red-100">
                                      {STATIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                  </select>
                                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                              </div>
                          </div>
                      </div>
                  </div>

                  <hr className="border-slate-100"/>

                  {/* Options */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Ticket Class</label>
                          <select value={bookClass} onChange={e=>setBookClass(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-slate-700 text-sm focus:ring-2 focus:ring-blue-100">
                              <option value="second">Second Class</option>
                              <option value="first">First Class</option>
                              <option value="ac">AC Local</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Passengers</label>
                          <div className="flex items-center bg-slate-50 rounded-xl p-1">
                              <button onClick={() => setBookQty(Math.max(1, bookQty - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 font-bold transition-all active:scale-90">-</button>
                              <span className="flex-1 text-center font-bold text-slate-800 text-sm">{bookQty}</span>
                              <button onClick={() => setBookQty(Math.min(10, bookQty + 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 hover:text-blue-600 font-bold transition-all active:scale-90">+</button>
                          </div>
                      </div>
                  </div>

                  {/* Total & Pay */}
                  <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col gap-4 shadow-xl shadow-slate-300">
                      <div className="flex justify-between items-end border-b border-white/10 pb-4">
                          <div>
                              <p className="text-slate-400 text-xs font-medium mb-1">Total Fare</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">₹{Backend.calculateFare(bookSrc, bookDst, bookClass) * bookQty}</span>
                                <span className="text-xs text-slate-400">inc. taxes</span>
                              </div>
                          </div>
                          <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-medium backdrop-blur-md">
                              {bookClass.toUpperCase()}
                          </div>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pay Via</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['wallet', 'upi', 'card'].map(m => (
                                <button 
                                    key={m} 
                                    onClick={() => setPaymentMethod(m)} 
                                    className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all border ${
                                        paymentMethod === m 
                                        ? 'bg-white text-slate-900 border-white' 
                                        : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/5'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                      </div>

                      <button onClick={handleManualBooking} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 mt-2">
                          <span>Confirm Booking</span>
                          <ArrowRight className="w-4 h-4"/>
                      </button>
                  </div>
              </div>
            </div>
          )}

          {/* ASSISTANT VIEW */}
          {view === 'assistant' && <Assistant user={user} refreshUser={() => {}} finalizeBooking={finalizeBooking} />}

          {/* WALLET VIEW */}
          {view === 'wallet' && (
              <div className="p-6 animate-in slide-in-from-right duration-300">
                  <div className="relative overflow-hidden bg-slate-900 text-white rounded-[2rem] p-8 shadow-2xl shadow-slate-300 mb-8">
                      {/* Abstract Background Shapes */}
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-600/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Balance</p>
                                <h1 className="text-5xl font-bold tracking-tight">₹{user?.wallet?.toLocaleString()}</h1>
                            </div>
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                                <Wallet className="w-6 h-6 text-emerald-400" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Quick Top-up</label>
                            
                            <div className="flex gap-0 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-1">
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                    <input 
                                        type="number" 
                                        placeholder="100" 
                                        className="w-full pl-8 pr-4 py-3 bg-transparent border-none outline-none text-white font-bold placeholder:text-slate-600" 
                                        value={topUpAmount} 
                                        onChange={e=>setTopUpAmount(e.target.value)} 
                                    />
                                </div>
                                <div className="flex gap-1 pr-1">
                                    <button onClick={()=>initTopUp('upi')} className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition-colors shadow-lg shadow-emerald-900/20">
                                        <Smartphone className="w-4 h-4"/>
                                    </button>
                                    <button onClick={()=>initTopUp('card')} className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                                        <CreditCard className="w-4 h-4"/>
                                    </button>
                                </div>
                            </div>
                        </div>
                      </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="font-bold text-slate-800 text-lg">Recent Transactions</h3>
                        <Calendar className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                            <Activity className="w-5 h-5"/>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Your recent transactions will appear here.</p>
                        <p className="text-slate-400 text-xs mt-1">Syncing with secure ledger...</p>
                    </div>
                  </div>
              </div>
          )}
        </main>

        <Navigation setView={setView} view={view} />
        
        {/* Style helper for hiding scrollbar but keeping functionality */}
        <style>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        `}</style>
      </div>
    </div>
  );
}