import React from "react";
import { Plus, CloudSun, PackagePlus, Trophy, ChevronRight, Snowflake, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TODAY_TESTS = [
  { id: 1, type: "Glide", location: "Lillehammer", creator: "Anders", time: "08:30" },
  { id: 2, type: "Structure", location: "Sjusjøen", creator: "Bjørn", time: "09:15" },
];

const RECENT_RESULTS = [
  {
    id: 1,
    type: "Glide",
    location: "Sjusjøen",
    date: "Today",
    creator: "Anders",
    winner: { brand: "Swix", name: "HF8" },
    latest: true,
  },
  {
    id: 2,
    type: "Structure",
    location: "Holmenkollen",
    date: "Yesterday",
    creator: "Bjørn",
    winner: { brand: "Red Creek", name: "1.0mm" },
    latest: false,
  },
  {
    id: 3,
    type: "Classic",
    location: "Lillehammer",
    date: "Oct 12",
    creator: "Kari",
    winner: { brand: "Rex", name: "Gold" },
    latest: false,
  },
];

const WEATHER_DATA = [
  { id: 1, location: "Lillehammer", date: "Today, 08:00", air: -4, snow: -6 },
  { id: 2, location: "Sjusjøen", date: "Today, 07:30", air: -8, snow: -10 },
  { id: 3, location: "Holmenkollen", date: "Yesterday, 09:00", air: -2, snow: -5 },
];

const PRODUCTS = [
  { id: 1, brand: "Swix", name: "HF8" },
  { id: 2, brand: "Rex", name: "Gold" },
  { id: 3, brand: "Toko", name: "Red" },
  { id: 4, brand: "Vauhti", name: "FC Speed" },
  { id: 5, brand: "Rode", name: "Multigrade" },
];

export function CleanMinimal() {
  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-100 pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20 lg:px-8">
        
        {/* Header & Quick Actions */}
        <header className="mb-16">
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-8">Glidr Hub</h1>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 h-10 px-5">
              <Plus className="mr-2 h-4 w-4" />
              New Test
            </Button>
            <Button variant="outline" className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50 h-10 px-5">
              <CloudSun className="mr-2 h-4 w-4 text-zinc-400" />
              Weather
            </Button>
            <Button variant="outline" className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50 h-10 px-5">
              <PackagePlus className="mr-2 h-4 w-4 text-zinc-400" />
              Product
            </Button>
          </div>
        </header>

        <main className="space-y-16">
          
          {/* Today's Tests */}
          <section>
            <div className="mb-6 flex items-baseline justify-between">
              <h2 className="text-3xl font-medium tracking-tight">Today's Tests</h2>
            </div>
            
            <div className="space-y-2">
              {TODAY_TESTS.map((test) => (
                <div key={test.id} className="group flex flex-col sm:flex-row sm:items-center justify-between py-4 cursor-pointer border-b border-zinc-100 hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="w-12 text-sm text-zinc-400 font-mono">{test.time}</span>
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-full font-medium border-0 px-3">
                      {test.type}
                    </Badge>
                    <span className="text-lg font-medium">{test.location}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 sm:mt-0 pl-16 sm:pl-0">
                    <span className="text-sm text-zinc-500">by {test.creator}</span>
                    <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-600 transition-colors hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Results */}
          <section>
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="text-3xl font-medium tracking-tight">Recent Results</h2>
              <span className="text-sm text-zinc-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Auto-updating
              </span>
            </div>
            
            <div className="space-y-4">
              {RECENT_RESULTS.map((result) => (
                <div 
                  key={result.id} 
                  className={cn(
                    "group relative flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl border transition-all cursor-pointer",
                    result.latest 
                      ? "border-amber-200 bg-amber-50/30" 
                      : "border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/50"
                  )}
                >
                  {result.latest && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-amber-400 rounded-r-full" />
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 mb-4 sm:mb-0">
                    <div className="flex flex-col gap-1 w-24">
                      <span className="text-sm text-zinc-500">{result.date}</span>
                      <span className="font-medium text-lg">{result.location}</span>
                    </div>
                    
                    <div className="hidden sm:block w-px h-8 bg-zinc-200" />
                    
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="rounded-full border-zinc-200 text-zinc-600 px-3 py-1">
                        {result.type}
                      </Badge>
                      <span className="text-sm text-zinc-500">by {result.creator}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-4 sm:mt-0 border-t sm:border-t-0 pt-4 sm:pt-0 border-zinc-100">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-zinc-100 shadow-sm">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">
                        {result.winner.brand} <span className="text-zinc-500">{result.winner.name}</span>
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Button variant="link" className="text-zinc-500 hover:text-zinc-900 px-0 h-auto font-medium">
                View all results <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>

          {/* Weather */}
          <section>
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="text-3xl font-medium tracking-tight">Recent Weather</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {WEATHER_DATA.map((weather) => (
                <div key={weather.id} className="flex flex-col p-6 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className="font-medium block text-lg">{weather.location}</span>
                      <span className="text-xs text-zinc-500">{weather.date}</span>
                    </div>
                    <CloudSun className="h-5 w-5 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                  
                  <div className="flex items-end justify-between mt-auto">
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500 mb-1 font-medium tracking-wide uppercase">Air</span>
                      <span className="text-3xl font-light tracking-tighter text-blue-900">{weather.air}°</span>
                    </div>
                    <div className="w-px h-10 bg-zinc-200" />
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-zinc-500 mb-1 font-medium tracking-wide uppercase">Snow</span>
                      <span className="text-3xl font-light tracking-tighter text-blue-600">{weather.snow}°</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <Button variant="link" className="text-zinc-500 hover:text-zinc-900 px-0 h-auto font-medium">
                View all weather <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>

          {/* Products */}
          <section>
            <div className="mb-8 flex items-baseline justify-between">
              <h2 className="text-3xl font-medium tracking-tight">Products Overview</h2>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {PRODUCTS.map((product) => (
                <div key={product.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200 hover:border-zinc-300 cursor-pointer transition-colors bg-white shadow-sm">
                  <span className="font-medium text-sm text-zinc-900">{product.brand}</span>
                  <span className="text-sm text-zinc-500">{product.name}</span>
                </div>
              ))}
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-dashed border-zinc-300 text-zinc-400 hover:text-zinc-600 hover:border-zinc-400 cursor-pointer transition-colors bg-zinc-50">
                <Search className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-6">
              <Button variant="link" className="text-zinc-500 hover:text-zinc-900 px-0 h-auto font-medium">
                Manage products <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>
          
        </main>
      </div>
    </div>
  );
}
