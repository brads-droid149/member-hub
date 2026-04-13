import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check } from "lucide-react";

const mockPartners = Array.from({ length: 16 }, (_, i) => ({
  id: i + 1,
  name: [
    "SurfCo", "WaveRider", "BoardHouse", "SaltLife",
    "Reef Gear", "Tide & Co", "OceanEdge", "CoastLine",
    "ShoreBreak", "FinCraft", "SeaFoam", "SandBar",
    "RipCurl Pro", "Barrel Co", "SwellTech", "DriftWood"
  ][i],
  discount: [
    "JUNK20", "WAVE15", "BOARD25", "SALT10",
    "REEF30", "TIDE20", "OCEAN15", "COAST25",
    "SHORE10", "FIN20", "FOAM15", "SAND30",
    "RIP20", "BARREL10", "SWELL25", "DRIFT15"
  ][i],
  description: "Member exclusive discount",
}));

export default function Partners() {
  const { toast } = useToast();
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = async (code: string, id: number) => {
    await navigator.clipboard.writeText(code);
    setCopied(id);
    toast({ title: "Copied!", description: `${code} copied to clipboard` });
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Partners & Discounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Exclusive discounts for active members. Click a code to copy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {mockPartners.map((partner) => (
          <Card
            key={partner.id}
            className="cursor-pointer hover:border-primary/40 transition-colors group"
            onClick={() => handleCopy(partner.discount, partner.id)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <span className="text-lg font-display font-bold text-foreground">
                  {partner.name.charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{partner.name}</p>
                <p className="text-xs text-muted-foreground">{partner.description}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-secondary rounded-md px-3 py-1.5 font-mono text-sm text-primary group-hover:bg-primary/10 transition-colors">
                {copied === partner.id ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {partner.discount}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
