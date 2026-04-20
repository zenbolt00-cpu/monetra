"use client";

import { useEffect, useState } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { Loader2, Shield, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit")
      .then(res => res.json())
      .then(data => {
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Audit log load error:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case "UPLOAD": return "bg-primary/20 text-primary border-primary/20";
      case "CREATE": return "bg-ios-green/20 text-ios-green border-ios-green/20";
      case "UPDATE": return "bg-ios-yellow/20 text-ios-yellow border-ios-yellow/20";
      case "DELETE": return "bg-ios-red/20 text-ios-red border-ios-red/20";
      default: return "bg-black/10 text-[#424245] border-black/5";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" /> Audit Trail
        </h1>
        <p className="text-[#86868b] mt-1">Immutable record of all administrative and vendor actions.</p>
      </div>

      <div className="flex items-center gap-4 py-3 px-6 glass rounded-2xl border-black/5">
        <Search className="w-5 h-5 text-[#86868b]" />
        <input 
          type="text" 
          placeholder="Filter by actor, entity, or action..." 
          className="bg-transparent border-0 outline-none text-[#1d1d1f] text-sm flex-1 placeholder:text-[#86868b]/50"
        />
        <Filter className="w-4 h-4 text-[#86868b]" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[#86868b]">Loading secure audit records...</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader className="bg-black/5">
              <TableRow className="border-black/5 hover:bg-transparent">
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">Timestamp</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">Actor</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">Action</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">Entity</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">ID</TableHead>
                <TableHead className="text-[#86868b] font-bold uppercase text-[10px]">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="border-black/5 hover:bg-black/5 transition-colors glass-table-row">
                  <TableCell className="text-xs text-[#86868b]">{formatDate(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="font-semibold text-[#1d1d1f]">
                    <div className="flex flex-col">
                      <span>{log.actorName}</span>
                      <span className="text-[9px] uppercase tracking-tighter text-[#86868b]">{log.actorRole}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                      getActionColor(log.action)
                    )}>
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-[#424245] leading-relaxed font-medium">{log.entity}</TableCell>
                  <TableCell className="text-[10px] font-mono text-[#86868b]">{log.entityId.slice(0, 8)}...</TableCell>
                  <TableCell className="text-[10px] text-[#86868b]">{log.ipAddress || "::1"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
