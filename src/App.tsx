import React, { useEffect, useState, useMemo } from "react";
import { Participant } from "./types";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Settings, 
  Calendar as CalendarIcon, 
  Filter, 
  Search, 
  Activity, 
  DollarSign,
  ChevronRight,
  Plus,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, parse, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";

// Mapping of Match ID to Race Name
type MatchMap = Record<string, string>;

const SECRET_TOKEN = "xP9kL2mN5vR8qT1wY4zB7sD0fG3hJ6kL9mN2vR5qT8wY1zB4sD7fG0hJ3kL6mN9vR2qT5wY8zB1sD4fG7hJ0kL3mN6vR9qT2wY5zB8sD1fG4hJ7";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("marathon_auth_token") === SECRET_TOKEN;
  });
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState(false);

  const [data, setData] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Settings & Filters
  const [matchMap, setMatchMap] = useState<MatchMap>(() => {
    const saved = localStorage.getItem("marathon_match_map");
    return saved ? JSON.parse(saved) : { "80": "VnExpress Marathon 2024", "79": "VnExpress Marathon 2023", "60": "VnExpress Marathon 2022" };
  });
  
  const [selectedRace, setSelectedRace] = useState<string>("all");
  const [selectedDistance, setSelectedDistance] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput === SECRET_TOKEN) {
      localStorage.setItem("marathon_auth_token", SECRET_TOKEN);
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("marathon_auth_token");
    setIsAuthenticated(false);
    setTokenInput("");
  };

  const resetFilters = () => {
    setSelectedRace("all");
    setSelectedDistance("all");
    setSelectedStage("all");
    setDateRange({ from: undefined, to: undefined });
    setSearchTerm("");
  };

  // Save map to localStorage
  useEffect(() => {
    localStorage.setItem("marathon_match_map", JSON.stringify(matchMap));
  }, [matchMap]);

  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/marathon-data")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("Failed to load data from Google Sheets");
          setLoading(false);
        });
    }
  }, [isAuthenticated]);

  // Helper to parse date from "DD/MM/YYYY HH:mm:ss" or similar
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      // Try common formats
      const formats = ["dd/MM/yyyy HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "MM/dd/yyyy HH:mm:ss"];
      for (const f of formats) {
        const d = parse(dateStr, f, new Date());
        if (!isNaN(d.getTime())) return d;
      }
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((p) => {
      const matchId = p["MATCH ID"];
      const raceName = matchMap[matchId] || `Match ${matchId}`;
      
      const matchesRace = selectedRace === "all" || raceName === selectedRace;
      const matchesDistance = selectedDistance === "all" || p["CU LY"] === selectedDistance;
      const matchesStage = selectedStage === "all" || p["STAGE"] === selectedStage;
      
      const pDate = parseDate(p["THOI GIAN TAO"]);
      let matchesDate = true;
      if (dateRange.from && dateRange.to && pDate) {
        matchesDate = isWithinInterval(pDate, { 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.to) 
        });
      } else if (dateRange.from && pDate) {
        matchesDate = pDate >= startOfDay(dateRange.from);
      } else if (dateRange.to && pDate) {
        matchesDate = pDate <= endOfDay(dateRange.to);
      }

      const matchesSearch = 
        p["USER ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p["TINH THANH"]?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesRace && matchesDistance && matchesStage && matchesDate && matchesSearch;
    });
  }, [data, matchMap, selectedRace, selectedDistance, selectedStage, dateRange, searchTerm]);

  // Revenue Calculation
  const revenueStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    
    filteredData.forEach((p) => {
      const matchId = p["MATCH ID"];
      const raceName = matchMap[matchId] || `Match ${matchId}`;
      const distance = p["CU LY"] || "Unknown";
      const amount = parseFloat(p["SO TIEN"]?.replace(/,/g, "") || "0");

      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][distance] = (stats[raceName][distance] || 0) + amount;
    });

    return stats;
  }, [filteredData, matchMap]);

  // BIB Stats by Stage
  const bibStageStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    filteredData.forEach((p) => {
      const matchId = p["MATCH ID"];
      const raceName = matchMap[matchId] || `Match ${matchId}`;
      const stage = p["STAGE"] || "Unknown";
      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][stage] = (stats[raceName][stage] || 0) + 1;
    });
    return stats;
  }, [filteredData, matchMap]);

  // BIB Stats by Distance
  const bibDistanceStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    filteredData.forEach((p) => {
      const matchId = p["MATCH ID"];
      const raceName = matchMap[matchId] || `Match ${matchId}`;
      const distance = p["CU LY"] || "Unknown";
      if (!stats[raceName]) stats[raceName] = {};
      stats[raceName][distance] = (stats[raceName][distance] || 0) + 1;
    });
    return stats;
  }, [filteredData, matchMap]);

  const allDistances = useMemo(() => {
    const dists = new Set<string>();
    data.forEach(p => { if (p["CU LY"]) dists.add(p["CU LY"]); });
    return Array.from(dists).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [data]);

  const allStages = useMemo(() => {
    const stages = new Set<string>();
    data.forEach(p => { if (p["STAGE"]) stages.add(p["STAGE"]); });
    return Array.from(stages).sort();
  }, [data]);

  const allRaceNames = useMemo(() => {
    const names = new Set<string>();
    data.forEach(p => {
      const name = matchMap[p["MATCH ID"]] || `Match ${p["MATCH ID"]}`;
      names.add(name);
    });
    return Array.from(names).sort();
  }, [data, matchMap]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="inline-block p-3 border border-[var(--line)] mb-4">
              <Settings className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-serif italic uppercase tracking-tighter">Security Access</h1>
            <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label className="col-header">Access Token</Label>
              <Input 
                type="password"
                placeholder="Enter security token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className={cn(
                  "rounded-none border-[var(--line)] bg-white/50 font-mono text-center text-lg tracking-[0.5em]",
                  authError && "border-red-500 ring-1 ring-red-500"
                )}
              />
              {authError && (
                <p className="text-[10px] font-mono text-red-600 uppercase text-center">Invalid Token. Access Denied.</p>
              )}
            </div>
            <Button type="submit" className="w-full rounded-none bg-[var(--ink)] text-[var(--bg)] font-mono uppercase py-6 text-sm tracking-widest">
              Verify & Enter
            </Button>
          </form>

          <div className="pt-8 border-t border-[var(--line)] opacity-20 text-center">
            <p className="text-[9px] font-mono uppercase tracking-widest">Marathon Revenue Intelligence v2.2.0</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="font-mono text-sm uppercase tracking-widest">Synchronizing Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--line)] pb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="rounded-none border-[var(--line)] font-mono text-[10px] uppercase">Live Feed</Badge>
            <span className="text-[10px] font-mono opacity-40 uppercase tracking-widest">v2.2.0</span>
          </div>
          <h1 className="text-5xl font-serif italic tracking-tighter uppercase leading-none">Marathon Analytics</h1>
          <p className="text-xs opacity-50 font-mono mt-2 uppercase tracking-wider">Financial & Registration Performance</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleLogout} className="text-[10px] font-mono uppercase opacity-40 hover:opacity-100">Logout</Button>
          <SettingsPopup matchMap={matchMap} setMatchMap={setMatchMap} />
          <div className="h-12 w-[1px] bg-[var(--line)] opacity-20 hidden md:block" />
          <div className="text-right">
            <p className="text-[10px] font-mono opacity-40 uppercase">Total Filtered Revenue</p>
            <p className="text-2xl font-serif italic">
              {Object.values(revenueStats).reduce((acc, curr) => acc + Object.values(curr).reduce((a, b) => a + b, 0), 0).toLocaleString()} VND
            </p>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-white/50 p-4 border border-[var(--line)]">
          <div className="space-y-1">
            <Label className="col-header">Race Name</Label>
            <select 
              className="w-full bg-transparent border border-[var(--line)] px-3 py-2 text-sm font-mono focus:outline-none"
              value={selectedRace}
              onChange={(e) => setSelectedRace(e.target.value)}
            >
              <option value="all">All Races</option>
              {allRaceNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="col-header">Distance</Label>
            <select 
              className="w-full bg-transparent border border-[var(--line)] px-3 py-2 text-sm font-mono focus:outline-none"
              value={selectedDistance}
              onChange={(e) => setSelectedDistance(e.target.value)}
            >
              <option value="all">All Distances</option>
              {allDistances.map(d => <option key={d} value={d}>{d}km</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="col-header">Stage</Label>
            <select 
              className="w-full bg-transparent border border-[var(--line)] px-3 py-2 text-sm font-mono focus:outline-none"
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
            >
              <option value="all">All Stages</option>
              {allStages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1 lg:col-span-2">
            <Label className="col-header">Date Range</Label>
            <Popover>
              <PopoverTrigger render={
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-mono rounded-none border-[var(--line)] bg-transparent",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              } />
              <PopoverContent className="w-auto p-0 rounded-none border-[var(--line)]" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                />
                <div className="p-2 border-t border-[var(--line)] flex justify-end">
                  <Button variant="ghost" size="sm" className="text-[10px] uppercase font-mono" onClick={() => setDateRange({ from: undefined, to: undefined })}>Clear</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <Label className="col-header">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <Input 
                placeholder="User ID..." 
                className="pl-10 rounded-none border-[var(--line)] bg-transparent focus:ring-0 font-mono text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={resetFilters}
            className="rounded-none border-[var(--line)] font-mono text-[10px] uppercase gap-2"
          >
            <Trash2 className="w-3 h-3" /> Reset Filters
          </Button>
        </div>
      </div>

      {/* Revenue Table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          <h2 className="text-2xl font-serif italic uppercase tracking-tight">Revenue Breakdown</h2>
        </div>
        
        <div className="border border-[var(--line)] overflow-hidden">
          <Table>
            <TableHeader className="bg-[var(--ink)]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="col-header text-[var(--bg)] py-4">Race Name</TableHead>
                {allDistances.map(d => (
                  <TableHead key={d} className="col-header text-[var(--bg)] text-right">{d}km</TableHead>
                ))}
                <TableHead className="col-header text-[var(--bg)] text-right">Total (VND)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(revenueStats).map(([race, dists]) => {
                const rowTotal = Object.values(dists).reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={race} className="data-row">
                    <TableCell className="font-serif italic text-lg">{race}</TableCell>
                    {allDistances.map(d => (
                      <TableCell key={d} className="data-value text-right">
                        {dists[d] ? dists[d].toLocaleString() : "-"}
                      </TableCell>
                    ))}
                    <TableCell className="data-value text-right font-bold bg-black/5">
                      {rowTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* BIB by Stage */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          <h2 className="text-2xl font-serif italic uppercase tracking-tight">BIBs by Stage</h2>
        </div>
        <div className="border border-[var(--line)] overflow-hidden">
          <Table>
            <TableHeader className="bg-[var(--ink)]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="col-header text-[var(--bg)] py-4">Race</TableHead>
                {allStages.map(s => (
                  <TableHead key={s} className="col-header text-[var(--bg)] text-right">{s}</TableHead>
                ))}
                <TableHead className="col-header text-[var(--bg)] text-right">Total BIB</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(bibStageStats).map(([race, stages]) => {
                const rowTotal = Object.values(stages).reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={race} className="data-row">
                    <TableCell className="font-mono text-xs font-bold">{race}</TableCell>
                    {allStages.map(s => (
                      <TableCell key={s} className="data-value text-right">
                        {stages[s] || 0}
                      </TableCell>
                    ))}
                    <TableCell className="data-value text-right font-bold bg-black/5">
                      {rowTotal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* BIB by Distance */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <h2 className="text-2xl font-serif italic uppercase tracking-tight">BIBs by Distance</h2>
        </div>
        <div className="border border-[var(--line)] overflow-hidden">
          <Table>
            <TableHeader className="bg-[var(--ink)]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="col-header text-[var(--bg)] py-4">Race</TableHead>
                {allDistances.map(d => (
                  <TableHead key={d} className="col-header text-[var(--bg)] text-center">{d}km (Count | %)</TableHead>
                ))}
                <TableHead className="col-header text-[var(--bg)] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(bibDistanceStats).map(([race, dists]) => {
                const rowTotal = Object.values(dists).reduce((a, b) => a + b, 0);
                return (
                  <TableRow key={race} className="data-row">
                    <TableCell className="font-mono text-xs font-bold">{race}</TableCell>
                    {allDistances.map(d => {
                      const count = dists[d] || 0;
                      const percentage = rowTotal > 0 ? (count / rowTotal * 100).toFixed(1) : 0;
                      return (
                        <TableCell key={d} className="data-value text-center">
                          {count} <span className="opacity-40 text-[10px]">| {percentage}%</span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="data-value text-right font-bold bg-black/5">
                      {rowTotal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Raw Data Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            <h2 className="text-2xl font-serif italic uppercase tracking-tight">Registration Records</h2>
          </div>
          <p className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Showing {filteredData.length} records</p>
        </div>
        
        <div className="border border-[var(--line)] overflow-hidden">
          <Table>
            <TableHeader className="bg-[var(--ink)]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="col-header text-[var(--bg)] py-4">User ID</TableHead>
                <TableHead className="col-header text-[var(--bg)]">Race</TableHead>
                <TableHead className="col-header text-[var(--bg)]">Dist</TableHead>
                <TableHead className="col-header text-[var(--bg)]">Stage</TableHead>
                <TableHead className="col-header text-[var(--bg)]">Amount</TableHead>
                <TableHead className="col-header text-[var(--bg)]">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.slice(0, 15).map((p, idx) => (
                <TableRow key={`${p["USER ID"]}-${idx}`} className="data-row">
                  <TableCell className="data-value font-bold">{p["USER ID"]}</TableCell>
                  <TableCell className="data-value text-xs">{matchMap[p["MATCH ID"]] || p["MATCH ID"]}</TableCell>
                  <TableCell className="data-value">
                    <Badge variant="outline" className="rounded-none border-[var(--line)] font-mono text-[10px]">
                      {p["CU LY"]}km
                    </Badge>
                  </TableCell>
                  <TableCell className="data-value text-[10px]">{p["STAGE"]}</TableCell>
                  <TableCell className="data-value">{parseFloat(p["SO TIEN"]?.replace(/,/g, "") || "0").toLocaleString()}</TableCell>
                  <TableCell className="data-value text-[10px] opacity-60">{p["THOI GIAN TAO"]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-10 border-t border-[var(--line)] flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono uppercase tracking-widest opacity-40">
        <p>© 2026 VnExpress Marathon Analytics Dashboard</p>
        <div className="flex gap-6">
          <span>Source: Google Sheets TSV</span>
          <span>Auto-Sync: Active</span>
        </div>
      </footer>
    </div>
  );
}

function SettingsPopup({ matchMap, setMatchMap }: { matchMap: MatchMap; setMatchMap: React.Dispatch<React.SetStateAction<MatchMap>> }) {
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (newId && newName) {
      setMatchMap(prev => ({ ...prev, [newId]: newName }));
      setNewId("");
      setNewName("");
    }
  };

  const handleRemove = (id: string) => {
    const next = { ...matchMap };
    delete next[id];
    setMatchMap(next);
  };

  return (
    <Dialog>
      <DialogTrigger render={
        <Button variant="outline" className="rounded-none border-[var(--line)] font-mono uppercase text-xs gap-2">
          <Settings className="w-4 h-4" />
          Race Mapping
        </Button>
      } />
      <DialogContent className="rounded-none border-[var(--line)] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif italic text-2xl uppercase">Race Mapping Settings</DialogTitle>
          <CardDescription className="font-mono text-xs">Map Match IDs to readable Race Names</CardDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="col-header">Match ID</Label>
              <Input 
                placeholder="e.g. 80" 
                value={newId} 
                onChange={(e) => setNewId(e.target.value)}
                className="rounded-none border-[var(--line)] font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="col-header">Race Name</Label>
              <Input 
                placeholder="e.g. VM Hue 2024" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)}
                className="rounded-none border-[var(--line)] font-mono"
              />
            </div>
          </div>
          <Button onClick={handleAdd} className="w-full rounded-none bg-[var(--ink)] text-[var(--bg)] font-mono uppercase text-xs gap-2">
            <Plus className="w-4 h-4" /> Add Mapping
          </Button>

          <div className="border-t border-[var(--line)] pt-4 space-y-2">
            <Label className="col-header">Current Mappings</Label>
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
              <AnimatePresence>
                {Object.entries(matchMap).map(([id, name]) => (
                  <motion.div 
                    key={id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between p-2 bg-black/5 border border-[var(--line)]/20"
                  >
                    <div className="font-mono text-xs">
                      <span className="opacity-50">ID: {id}</span>
                      <ChevronRight className="inline w-3 h-3 mx-1 opacity-30" />
                      <span className="font-bold">{name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(id)} className="h-6 w-6 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <p className="text-[9px] font-mono opacity-40 uppercase text-center w-full">Settings are saved locally in your browser</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
