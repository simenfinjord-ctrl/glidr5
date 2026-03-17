import React from "react";
import { 
  CalendarPlus, 
  PackagePlus, 
  Plus, 
  Snowflake, 
  Zap, 
  CloudSun, 
  Trophy, 
  Package,
  Activity,
  ArrowRight,
  TrendingUp,
  Wind
} from "lucide-react";

// Mock Data
const todayTests = [
  { id: 1, type: "Glide", location: "Lillehammer", creator: "Jan Egil", time: "08:30" },
  { id: 2, type: "Structure", location: "Sjusjøen", creator: "Tore", time: "10:15" },
];

const recentResults = [
  { 
    id: 1, 
    type: "Glide", 
    location: "Holmenkollen", 
    date: "Today, 11:45", 
    creator: "Jan Egil",
    winner: { brand: "Swix", name: "HF8", type: "Liquid" },
    isLatest: true 
  },
  { 
    id: 2, 
    type: "Structure", 
    location: "Lillehammer", 
    date: "Yesterday", 
    creator: "Tore",
    winner: { brand: "Red Creek", name: "1mm Linear", type: "Tool" },
    isLatest: false 
  },
  { 
    id: 3, 
    type: "Classic", 
    location: "Sjusjøen", 
    date: "Yesterday", 
    creator: "Ola",
    winner: { brand: "Rex", name: "Gold", type: "Kick" },
    isLatest: false 
  },
  { 
    id: 4, 
    type: "Skating", 
    location: "Beitostølen", 
    date: "Oct 12", 
    creator: "Jan Egil",
    winner: { brand: "Toko", name: "Red", type: "Powder" },
    isLatest: false 
  },
];

const recentWeather = [
  { id: 1, location: "Lillehammer", date: "Today, 08:00", air: -4, snow: -6, humidity: 82 },
  { id: 2, location: "Sjusjøen", date: "Today, 07:30", air: -8, snow: -10, humidity: 76 },
  { id: 3, location: "Holmenkollen", date: "Yesterday, 09:00", air: -2, snow: -5, humidity: 88 },
];

const products = [
  { id: 1, brand: "Swix", name: "TS8L", type: "Glide" },
  { id: 2, brand: "Rex", name: "TK-29", type: "Powder" },
  { id: 3, brand: "Toko", name: "High Performance Blue", type: "Glide" },
  { id: 4, brand: "Rode", name: "Multigrade", type: "Kick" },
  { id: 5, brand: "Vauhti", name: "FC Speed", type: "Liquid" },
  { id: 6, brand: "Holmenkol", name: "Matrix", type: "Structure" },
];

export function BentoGrid() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans selection:bg-blue-100">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Glidr Testing Hub</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 mt-1">Daily overview of tests, conditions, and winning products.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md">
              <Plus className="w-4 h-4" />
              New Test
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md">
              <CalendarPlus className="w-4 h-4 text-violet-500" />
              Weather
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md">
              <PackagePlus className="w-4 h-4 text-amber-500" />
              Product
            </button>
          </div>
        </header>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[minmax(180px,auto)]">
          
          {/* Today's Tests - Small Card */}
          <div className="col-span-1 md:col-span-1 lg:col-span-1 row-span-1 bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-emerald-600" />
                </div>
                <h2 className="font-semibold text-slate-800 text-lg">Today</h2>
              </div>
              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold">{todayTests.length} tests</span>
            </div>
            
            <div className="flex-1 space-y-3">
              {todayTests.map(test => (
                <div key={test.id} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">{test.location}</span>
                    <span className="text-xs text-slate-400">{test.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {test.type}
                    </span>
                    <span className="text-xs text-slate-500">{test.creator}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Results - Large Hero Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-lg transition-all flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-6 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-xl">Recent Results</h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Activity className="w-3 h-3 text-emerald-500" /> Auto-updating
                  </p>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-3 relative z-10">
              {recentResults.map(result => (
                <div 
                  key={result.id} 
                  className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all cursor-pointer border ${
                    result.isLatest 
                      ? "bg-amber-50/50 border-amber-200/50 shadow-sm" 
                      : "bg-slate-50/50 border-transparent hover:bg-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full ${result.isLatest ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`}></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">{result.location}</span>
                        <span className="text-xs text-slate-400 px-2 py-0.5 bg-white rounded-md border border-slate-100">{result.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-white border border-slate-100 px-2 py-0.5 rounded-full">
                          {result.type}
                        </span>
                        <span className="text-xs text-slate-500">by {result.creator}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-end">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                      <Trophy className={`w-3.5 h-3.5 ${result.isLatest ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className="text-sm font-bold text-slate-700">{result.winner.brand}</span>
                      <span className="text-sm text-slate-600">{result.winner.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions - Small Column */}
          <div className="col-span-1 md:col-span-3 lg:col-span-1 row-span-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 gap-4">
            <button className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-[2rem] p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-white group aspect-square lg:aspect-auto">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold">New Test</span>
            </button>
            <button className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group aspect-square lg:aspect-auto cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Snowflake className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-semibold text-slate-700">Series</span>
            </button>
            <button className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group aspect-square lg:aspect-auto cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <PackagePlus className="w-6 h-6 text-amber-500" />
              </div>
              <span className="font-semibold text-slate-700 text-center leading-tight">Add<br/>Product</span>
            </button>
            <button className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-3 group aspect-square lg:aspect-auto cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                <CalendarPlus className="w-6 h-6 text-violet-500" />
              </div>
              <span className="font-semibold text-slate-700">Weather</span>
            </button>
          </div>

          {/* Recent Weather - Medium Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] p-6 shadow-md hover:shadow-lg transition-all flex flex-col relative overflow-hidden text-white">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'#ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}></div>
            
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <CloudSun className="w-5 h-5 text-indigo-300" />
                </div>
                <h2 className="font-bold text-white text-xl">Recent Weather</h2>
              </div>
              <button className="text-indigo-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                View all <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
              {recentWeather.map(w => (
                <div key={w.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="font-medium text-indigo-100 mb-1">{w.location}</div>
                  <div className="text-xs text-indigo-300 mb-3">{w.date}</div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-xs text-indigo-400 flex items-center gap-1 mb-1"><Wind className="w-3 h-3"/> Air</div>
                      <div className="font-bold text-lg">{w.air}°</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-indigo-400 flex items-center gap-1 justify-end mb-1"><Snowflake className="w-3 h-3"/> Snow</div>
                      <div className="font-bold text-lg text-blue-300">{w.snow}°</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Products Overview - Medium Card */}
          <div className="col-span-1 md:col-span-1 lg:col-span-2 row-span-1 bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col group">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-slate-600" />
                </div>
                <h2 className="font-bold text-slate-900 text-xl">Products</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">142 total</span>
                <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-auto">
              {products.map(p => (
                <div key={p.id} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-sm hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-2">
                  <span className="font-bold text-slate-700">{p.brand}</span>
                  <span className="text-slate-500">{p.name}</span>
                </div>
              ))}
              <div className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                <Plus className="w-4 h-4 mr-1" /> Add
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
