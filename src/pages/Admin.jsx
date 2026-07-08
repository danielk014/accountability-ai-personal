import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Settings, Shield, Mail, UserPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Admin() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: me?.role === "admin",
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list(),
    enabled: me?.role === "admin",
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["completions"],
    queryFn: () => base44.entities.TaskCompletion.list("-completed_date", 1000),
    enabled: me?.role === "admin",
  });

  const inviteMutation = useMutation({
    mutationFn: () => base44.users.inviteUser(inviteEmail, inviteRole),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Failed to send invitation"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => base44.entities.User.update(userId, { role }),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  if (!me) return null;

  if (me.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Access Denied</h2>
        <p className="text-slate-500">You need admin privileges to view this page.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const completionsToday = completions.filter(c => c.completed_date === today).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
          <p className="text-sm text-slate-500">Manage users and app settings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-indigo-600 bg-indigo-50" },
          { label: "Total Tasks", value: tasks.length, icon: Settings, color: "text-violet-600 bg-violet-50" },
          { label: "Completions Today", value: completionsToday, icon: RefreshCw, color: "text-emerald-600 bg-emerald-50" },
          { label: "All-time Completions", value: completions.length, icon: Shield, color: "text-amber-600 bg-amber-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Invite User */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Invite User</h2>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Email address"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl"
            type="email"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white text-slate-700"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            onClick={() => inviteMutation.mutate()}
            disabled={!inviteEmail || inviteMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
          >
            <Mail className="w-4 h-4 mr-2" />
            Send Invite
          </Button>
        </div>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">Users</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["users"] })} className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading users...</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {users.map(user => (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">
                      {(user.full_name || user.email || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{user.full_name || "—"}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={user.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}>
                    {user.role || "user"}
                  </Badge>
                  {user.id !== me.id && (
                    <select
                      value={user.role || "user"}
                      onChange={e => updateRoleMutation.mutate({ userId: user.id, role: e.target.value })}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  )}
                  {user.id === me.id && (
                    <span className="text-xs text-slate-400 italic">you</span>
                  )}
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="p-8 text-center text-slate-400">No users found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}