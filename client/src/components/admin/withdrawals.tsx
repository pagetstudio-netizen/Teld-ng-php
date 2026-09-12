import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, Search, Loader2, Send, Copy } from "lucide-react";
import type { Withdrawal } from "@shared/schema";
import { formatCurrency } from "@/lib/countries";

interface WithdrawalWithUser extends Withdrawal {
  seapayPayoutAvailable?: boolean;
  user: {
    id: number;
    fullName: string;
    phone: string;
    country: string;
    isPromoter: boolean;
  };
}

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "processing">("pending");

  const { data: allWithdrawals, isLoading } = useQuery<WithdrawalWithUser[]>({
    queryKey: ["/api/admin/withdrawals"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/withdrawals?status=all`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      return res.json();
    },
  });

  const withdrawals = allWithdrawals?.filter(w =>
    statusFilter === "all" ? true : w.status === statusFilter
  );

  const [processingId, setProcessingId] = useState<number | null>(null);

  const processMutation = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" }) => {
      setProcessingId(id);
      const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Withdrawal processed!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: () => setProcessingId(null),
  });

  const seapayMutation = useMutation({
    mutationFn: async (id: number) => {
      setProcessingId(id);
      const res = await fetch(`/api/banker/withdrawals/${id}/seapay`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Withdrawal sent to SeaPay" });
    },
    onError: (error: any) => {
      toast({ title: "SeaPay error", description: error.message, variant: "destructive" });
    },
    onSettled: () => setProcessingId(null),
  });

  const copySeapayRequest = async (id: number) => {
    try {
      const res = await fetch(`/api/banker/withdrawals/${id}/seapay-request`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to load SeaPay request");
      await navigator.clipboard.writeText(data.text);
      toast({ title: "SeaPay request copied" });
    } catch (error: any) {
      toast({ title: "Copy failed", description: error.message, variant: "destructive" });
    }
  };

  const filteredWithdrawals = withdrawals?.filter(w =>
    w.accountNumber.includes(filter) ||
    w.user.phone.includes(filter) ||
    w.user.fullName.toLowerCase().includes(filter.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by number or name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "pending", "processing", "approved", "rejected"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "default" : "outline"}
            onClick={() => setStatusFilter(status)}
          >
            {status === "all" ? "All" : status === "pending" ? "Pending" : status === "processing" ? "Processing" : status === "approved" ? "Approved" : "Rejected"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : filteredWithdrawals.length > 0 ? (
          filteredWithdrawals.map((withdrawal) => (
            <Card key={withdrawal.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{withdrawal.user.fullName}</p>
                      {withdrawal.user.isPromoter && <Badge className="text-xs">Promoter</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{withdrawal.user.phone}</p>
                    <p className="text-sm text-muted-foreground">Country: {withdrawal.user.country}</p>
                  </div>
                  <Badge variant={
                    withdrawal.status === "pending" ? "secondary" :
                    withdrawal.status === "approved" ? "default" :
                    withdrawal.status === "processing" ? "outline" : "destructive"
                  }>
                    {withdrawal.status === "pending" ? "Pending" : withdrawal.status === "approved" ? "Approved" : withdrawal.status === "processing" ? "Processing" : "Rejected"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Requested amount</p>
                    <p className="font-medium text-foreground">{formatCurrency(withdrawal.amount, withdrawal.user.country)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net amount</p>
                    <p className="font-medium text-primary">{formatCurrency(withdrawal.netAmount, withdrawal.user.country)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fee</p>
                    <p className="font-medium text-destructive">{formatCurrency(withdrawal.fees, withdrawal.user.country)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Method</p>
                    <p className="font-medium text-foreground">{withdrawal.paymentMethod}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Receiving number</p>
                    <p className="font-medium text-foreground">{withdrawal.accountNumber} - {withdrawal.accountName}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Date and time</p>
                    <p className="font-medium text-foreground">
                      {new Date(withdrawal.createdAt).toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })} at {new Date(withdrawal.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>

                {withdrawal.status === "pending" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {withdrawal.seapayPayoutAvailable && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-cyan-600 text-cyan-700 hover:bg-cyan-50"
                        onClick={() => seapayMutation.mutate(withdrawal.id)}
                        disabled={processingId === withdrawal.id}
                        data-testid={`button-seapay-withdrawal-${withdrawal.id}`}
                      >
                        {processingId === withdrawal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1" /> Send to SeaPay</>}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => processMutation.mutate({ id: withdrawal.id, action: "approve" })}
                      disabled={processingId === withdrawal.id}
                      data-testid={`button-approve-${withdrawal.id}`}
                    >
                      {processingId === withdrawal.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Process manually</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => processMutation.mutate({ id: withdrawal.id, action: "reject" })}
                      disabled={processingId === withdrawal.id}
                      data-testid={`button-reject-${withdrawal.id}`}
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {withdrawal.seapayPayoutReference && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground font-mono truncate flex-1">
                      SeaPay: {withdrawal.seapayPayoutReference}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copySeapayRequest(withdrawal.id)}
                      data-testid={`button-copy-seapay-withdrawal-${withdrawal.id}`}
                    >
                      <Copy className="w-4 h-4 mr-1" /> Copy request
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No withdrawals found
          </div>
        )}
      </div>
    </div>
  );
}
