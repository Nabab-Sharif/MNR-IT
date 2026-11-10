import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BadgeCheck, Building2, MapPin, Phone, UserCircle, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

type Extra = { full_name?: string | null; department?: string | null; unit_office?: string | null; phone?: string | null };

const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-sky-100 dark:border-slate-700">
    <Icon className="h-5 w-5 text-sky-600 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  </div>
);

const MyProfile = () => {
  const { access, user } = useAuth();
  const [extra, setExtra] = useState<Extra>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("access_users")
      .select("full_name, department, unit_office, phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setExtra(data as Extra); });
  }, [user]);

  const displayName = extra.full_name || access?.label || "User";
  const initials = displayName.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="p-6 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">My Profile</h1>
          <p className="text-muted-foreground">Your account details</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-sky-200">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-sky-300">
                <AvatarFallback className="bg-gradient-to-br from-sky-500 to-blue-600 text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl text-sky-800">{displayName}</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">{access?.label || "—"}</div>
                {access?.is_super_admin && (
                  <Badge className="mt-2 bg-purple-600">Super Admin</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Row icon={BadgeCheck} label="Access ID" value={access?.access_id} />
              <Row icon={UserCircle} label="Full Name" value={extra.full_name} />
              <Row icon={Briefcase} label="Designation" value={access?.label} />
              <Row icon={Building2} label="Department" value={extra.department} />
              <Row icon={MapPin} label="Unit / Office" value={extra.unit_office} />
              <Row icon={Phone} label="Phone" value={extra.phone} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyProfile;