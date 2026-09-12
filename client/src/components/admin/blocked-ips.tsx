import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";

export default function AdminBlockedIps() {
  const { toast } = useToast();
  const [ip, setIp] = useState("");
  const { data: blockedIps = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/admin/blocked-ips"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/blocked-ips", { ip: ip.trim() });
      if (!response.ok) throw new Error((await response.json()).message || "Unable to block this IP");
      return response.json();
    },
    onSuccess: () => {
      setIp("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "IP blocked" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: async (value: string) => {
      const response = await apiRequest("DELETE", `/api/admin/blocked-ips/${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error((await response.json()).message || "Unable to unblock this IP");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "IP unblocked" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ban className="h-5 w-5 text-destructive" />
          Blocage des adresses IP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (ip.trim()) addMutation.mutate();
          }}
        >
          <Input value={ip} onChange={(event) => setIp(event.target.value)} placeholder="Ex. 192.168.1.10" />
          <Button type="submit" disabled={!ip.trim() || addMutation.isPending}>
            {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Bloquer</span>
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          A blocked address can no longer access the application. Check the address before blocking it.
        </p>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : blockedIps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocked IP addresses.</p>
        ) : (
          <div className="space-y-2">
            {blockedIps.map((value) => (
              <div key={value} className="flex items-center justify-between rounded-md border px-3 py-2">
                <code className="text-sm">{value}</code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => unblockMutation.mutate(value)}
                  disabled={unblockMutation.isPending}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}