import { useEffect, useState } from "react";
import { SavedLeadsDrawer } from "./SavedLeadsDrawer";
import { getSavedLeads, removeLead, syncSavedLeads } from "@/lib/saved-leads";
import type { SavedLead } from "@/lib/types";

export function MobileActions() {
  const [leads, setLeads] = useState<SavedLead[]>([]);

  useEffect(() => {
    setLeads(getSavedLeads());
    void syncSavedLeads().then(setLeads);
  }, []);

  return (
    <div className="fixed inset-x-3 bottom-3 z-[4000] flex items-center justify-end gap-2 rounded-2xl border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur-xl lg:hidden">
      <SavedLeadsDrawer leads={leads} onRemove={(id) => { removeLead(id); setLeads(getSavedLeads()); }} />
    </div>
  );
}
