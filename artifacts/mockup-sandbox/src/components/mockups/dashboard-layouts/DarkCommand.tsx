import React, { useState, useEffect } from "react";
import { 
  Activity, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  CloudSnow, 
  MapPin, 
  Package, 
  Plus, 
  Snowflake, 
  Thermometer, 
  ThermometerSnowflake, 
  Timer, 
  Trophy, 
  Wind,
  Zap,
  BarChart4,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  PackagePlus,
  CloudSun,
  ChevronRight
} from "lucide-react";

// --- DUMMY DATA ---
const STATS = [
  { label: "TESTS TODAY", value: "14", trend: "+3", status: "good" },
  { label: "ACTIVE SERIES", value: "3", trend: "0", status: "neutral" },
  { label: "AVG SNOW TEMP", value: "-6.2°C", trend: "-1.1°", status: "cold" },
  { label: "TOP PRODUCTS", value: "8", trend: "new", status: "good" }
];

const RECENT_WEATHER = [
  { id: 1, location: "Lillehammer", date: "Today, 08:30", air: -4.5, snow: -6.2, humidity: "78%", wind: "3 m/s" },
  { id: 2, location: "Sjusjøen", date: "Today, 07:15", air: -6.1, snow: -8.0, humidity: "82%", wind: "5 m/s" },
  { id: 3, location: "Holmenkollen", date: "Yesterday, 14:00", air: -2.3, snow: -4.1, humidity: "65%", wind: "2 m/s" },
];

const TODAY_TESTS = [
  { id: 101, type: "Glide", location: "Lillehammer - Stadium", creator: "O. Bjørndalen", time: "09:15" },
  { id: 102, type: "Structure", location: "Sjusjøen - Track 2", creator: "M. Falla", time: "08:45" },
  { id: 103, type: "Classic", location: "Lillehammer - North", creator: "P. Northug", time: "08:10" },
  { id: 104, type: "Skating", location: "Holmenkollen", creator: "T. Johaug", time: "07:30" },
];

const RECENT_RESULTS = [
  { 
    id: 201, 
    type: "Glide", 
    location: "Lillehammer", 
    time: "10 mins ago", 
    winner: { brand: "Swix", name: "TS8 Liquid" },
    difference: "-0.4s",
    status: "new"
  },
  { 
    id: 202, 
    type: "Structure", 
    location: "Sjusjøen", 
    time: "45 mins ago", 
    winner: { brand: "Red Creek", name: "0/-10" },
    difference: "-0.2s",
    status: "read"
  },
  { 
    id: 203, 
    type: "Classic", 
    location: "Lillehammer", 
    time: "2 hrs ago", 
    winner: { brand: "Rode", name: "Multigrade" },
    difference: "Solid kick",
    status: "read"
  },
  { 
    id: 204, 
    type: "Glide", 
    location: "Holmenkollen", 
    time: "3 hrs ago", 
    winner: { brand: "Rex", name: "G21G" },
    difference: "-0.6s",
    status: "read"
  },
];

const PRODUCTS = [
  { brand: "Swix", name: "TS8 Liquid", type: "Glide" },
  { brand: "Rex", name: "G21G Spray", type: "Glide" },
  { brand: "Toko", name: "High Performance Red", type: "Glide" },
  { brand: "Rode", name: "Multigrade Violet", type: "Kick" },
  { brand: "Vauhti", name: "FC Speed Warm", type: "Glide" },
  { brand: "Red Creek", name: "Structure 0/-10", type: "Tool" },
  { brand: "Swix", name: "VP40 Pro", type: "Kick" },
];

export function DarkCommand() {
  const [currentTime, setCurrentTime] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour12: false }) + " UTC" + (now.getTimezoneOffset() / -60 >= 0 ? "+" : "") + (now.getTimezoneOffset() / -60));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updatePulse = setInterval(() => {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 800);
    }, 15000);
    return () => clearInterval(updatePulse);
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-mono text-sm selection:bg-emerald-500/30">
      {/* HEADER COMMAND BAR */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400 fill-emerald-400/20" />
            <span className="font-bold text-zinc-100 tracking-wider">GLIDR // COMMAND</span>
          </div>
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Activity className="h-3 w-3" />
            SYS.ONLINE
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">SYNC</span>
            <RefreshCw className={`h-3 w-3 text-emerald-400 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-emerald-400 font-bold tabular-nums tracking-widest bg-emerald-950/30 px-3 py-1 rounded border border-emerald-900/50 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
            {currentTime || "00:00:00 UTC+1"}
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {STATS.map((stat, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-zinc-500 font-semibold tracking-wider">{stat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  stat.status === 'good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                  stat.status === 'cold' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 
                  'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {stat.trend}
                </span>
              </div>
              <div className={`text-4xl font-light tabular-nums tracking-tight ${
                stat.status === 'good' ? 'text-zinc-100 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' :
                stat.status === 'cold' ? 'text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]' :
                'text-zinc-100'
              }`}>
                {stat.value}
              </div>
              
              {/* Decorative accent line */}
              <div className={`absolute bottom-0 left-0 h-0.5 w-full ${
                stat.status === 'good' ? 'bg-emerald-500/30' :
                stat.status === 'cold' ? 'bg-cyan-500/30' :
                'bg-zinc-800'
              }`}></div>
            </div>
          ))}
        </div>

        {/* MAIN LAYOUT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN - ACTION & WEATHER */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* ACTION CENTER */}
            <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg p-5">
              <h2 className="text-xs font-bold text-zinc-500 tracking-widest mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                QUICK ACTIONS
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <button className="flex items-center gap-3 w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 p-3 rounded transition-all group">
                  <PlusCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold tracking-wide">INITIATE NEW TEST</span>
                  <ArrowUpRight className="h-4 w-4 ml-auto opacity-50" />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 p-3 rounded transition-all">
                    <CloudSun className="h-4 w-4 text-cyan-400" />
                    <span>Log Weather</span>
                  </button>
                  <button className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 p-3 rounded transition-all">
                    <PackagePlus className="h-4 w-4 text-amber-400" />
                    <span>Add Product</span>
                  </button>
                </div>
              </div>
            </div>

            {/* WEATHER TELEMETRY */}
            <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg p-0 overflow-hidden flex flex-col h-[calc(100%-200px)]">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h2 className="text-xs font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                  <Thermometer className="h-4 w-4" />
                  WEATHER TELEMETRY
                </h2>
                <button className="text-[10px] text-cyan-400 hover:text-cyan-300 uppercase tracking-wider">View All</button>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {RECENT_WEATHER.map((w) => (
                  <div key={w.id} className="p-4 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-zinc-200">{w.location}</div>
                        <div className="text-xs text-zinc-500">{w.date}</div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Wind className="h-3 w-3 text-zinc-500" />
                        <span className="text-zinc-400">{w.wind}</span>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">AIR</span>
                        <span className="font-bold text-blue-400">{w.air}°C</span>
                      </div>
                      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded p-2 flex items-center justify-between">
                        <span className="text-xs text-zinc-500">SNOW</span>
                        <span className="font-bold text-cyan-400">{w.snow}°C</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* MIDDLE COLUMN - RECENT RESULTS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* RESULTS FEED */}
            <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h2 className="text-xs font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                  <BarChart4 className="h-4 w-4" />
                  LIVE RESULTS FEED
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Auto-updating</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-950/50">
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Location / Type</th>
                      <th className="p-4 font-semibold">Top Product</th>
                      <th className="p-4 font-semibold">Delta</th>
                      <th className="p-4 font-semibold text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {RECENT_RESULTS.map((res) => (
                      <tr key={res.id} className={`group hover:bg-zinc-800/30 transition-colors ${res.status === 'new' ? 'bg-emerald-950/10' : ''}`}>
                        <td className="p-4 align-middle">
                          {res.status === 'new' ? (
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></span>
                          ) : (
                            <span className="inline-flex h-2 w-2 rounded-full bg-zinc-700"></span>
                          )}
                        </td>
                        <td className="p-4 align-middle">
                          <div className="font-medium text-zinc-200">{res.location}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{res.type}</div>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded text-amber-400">
                            <Trophy className="h-3 w-3" />
                            <span className="font-semibold">{res.winner.brand}</span>
                            <span>{res.winner.name}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle">
                          <span className="text-emerald-400 font-mono text-xs bg-emerald-500/10 px-2 py-0.5 rounded">
                            {res.difference}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right text-xs text-zinc-500 whitespace-nowrap">
                          {res.time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 text-center">
                <button className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-wider transition-colors">Load Historical Data</button>
              </div>
            </div>

            {/* BOTTOM ROW - TODAY'S TESTS & PRODUCTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* ACTIVE TESTS */}
              <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg overflow-hidden flex flex-col">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                  <h2 className="text-xs font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    ACTIVE PROTOCOLS
                  </h2>
                </div>
                <div className="p-4 space-y-3 flex-1">
                  {TODAY_TESTS.map((test) => (
                    <div key={test.id} className="flex items-center justify-between border border-zinc-800/60 bg-zinc-950 p-3 rounded group cursor-pointer hover:border-zinc-700">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                            test.type === 'Glide' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            test.type === 'Structure' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            {test.type}
                          </span>
                          <span className="text-xs text-zinc-500">{test.time}</span>
                        </div>
                        <div className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors">
                          {test.location}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">{test.creator}</div>
                        <ChevronRight className="h-4 w-4 text-zinc-600 inline-block mt-1 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PRODUCTS OVERVIEW */}
              <div className="border border-zinc-800 bg-zinc-900/30 rounded-lg overflow-hidden flex flex-col">
                <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                  <h2 className="text-xs font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    INDEXED PRODUCTS
                  </h2>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">{PRODUCTS.length} Total</span>
                </div>
                <div className="p-4 flex-1">
                  <div className="flex flex-wrap gap-2">
                    {PRODUCTS.map((p, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded text-xs hover:border-zinc-600 cursor-pointer transition-colors">
                        <span className="font-bold text-zinc-300">{p.brand}</span>
                        <span className="text-zinc-500">{p.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 text-center mt-auto">
                  <button className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-wider transition-colors">Manage Database</button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
