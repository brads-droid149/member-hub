import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, TrendingUp } from "lucide-react";

// Mock data — will be replaced with real data later
const mockMember = {
  name: "Alex Johnson",
  status: "active" as const,
  monthsActive: 7,
  entries: 7,
};

const mockGiveaway = {
  title: "Custom Surfboard Package",
  drawDate: "2026-05-15",
  prizeImage: "https://images.unsplash.com/photo-1502680390548-bdbac40c7e1e?w=600&h=400&fit=crop",
};

const mockWinners = [
  { name: "Jamie T.", prize: "Wetsuit Bundle", date: "Mar 2026" },
  { name: "Sam K.", prize: "Board Rack Set", date: "Feb 2026" },
  { name: "Riley M.", prize: "Surf Trip Voucher", date: "Jan 2026" },
];

const statusColors = {
  active: "bg-success/20 text-success border-success/30",
  paused: "bg-warning/20 text-warning border-warning/30",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function Dashboard() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Welcome back, {mockMember.name}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={statusColors[mockMember.status]}>
            {mockMember.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Member for {mockMember.monthsActive} months
          </span>
        </div>
      </div>

      {/* Entry Count Hero */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
        <CardContent className="relative flex flex-col items-center justify-center py-12">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
            Your Entries
          </p>
          <span className="text-7xl font-display font-bold text-primary animate-pulse-glow">
            {mockMember.entries}
          </span>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            +1 entry every month you stay active
          </p>
        </CardContent>
      </Card>

      {/* Giveaway + Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Giveaway */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Current Giveaway
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden">
              <img
                src={mockGiveaway.prizeImage}
                alt={mockGiveaway.title}
                className="w-full h-40 object-cover"
              />
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">
                {mockGiveaway.title}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Calendar className="h-3 w-3" />
                Draw date: {new Date(mockGiveaway.drawDate).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Past Winners */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Past Winners</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {mockWinners.map((w, i) => (
                <li key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.prize}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{w.date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
