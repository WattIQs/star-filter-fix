import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadLeadsCsv } from "@/lib/store";

export function ExportCsvButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2 text-xs"
      onClick={downloadLeadsCsv}
    >
      <Download className="h-4 w-4" />
      Exportar CSV
    </Button>
  );
}
