import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Users, MapPin, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoamlyLogo } from "@/components/RoamlyLogo";
import { UserMenu } from "@/components/UserMenu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/");
  }, [isAdmin, authLoading, navigate]);

  const { data: profiles } = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: tripStats } = useQuery({
    queryKey: ["admin", "trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, user_id, title, created_at");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (authLoading || !isAdmin) return null;

  const userCount = profiles?.length ?? 0;
  const tripCount = tripStats?.length ?? 0;
  const recentUsers = profiles?.slice(0, 10) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="shrink-0">
            <RoamlyLogo size="md" className="text-primary" />
          </button>
          <UserMenu />
        </div>
      </nav>

      <main className="pt-28 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-display font-bold text-primary">Admin Dashboard</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Total Users", value: userCount, icon: Users, color: "text-primary" },
            { label: "Saved Trips", value: tripCount, icon: MapPin, color: "text-accent" },
            { label: "Trips / User", value: userCount > 0 ? (tripCount / userCount).toFixed(1) : "0", icon: TrendingUp, color: "text-emerald-600" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm"
            >
              <stat.icon className={`w-5 h-5 mb-2 ${stat.color}`} />
              <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
              <p className="text-sm font-body text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Users */}
        <h2 className="text-xl font-display font-semibold text-primary mb-4">Recent Signups</h2>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          {recentUsers.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground font-body">No users yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentUsers.map((user) => (
                <div key={user.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-body font-bold">
                      {(user.display_name?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">{user.display_name || "—"}</p>
                      <p className="text-xs font-body text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {user.role === "admin" && (
                      <span className="text-xs font-body font-medium text-accent bg-accent/10 px-2 py-0.5 rounded-full">Admin</span>
                    )}
                    <span className="text-xs text-muted-foreground font-body">
                      {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
