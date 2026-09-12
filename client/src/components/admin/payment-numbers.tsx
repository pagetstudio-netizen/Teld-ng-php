import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Phone, Loader2, Eye, EyeOff } from "lucide-react";
import type { PaymentNumber } from "@shared/schema";

interface Country {
  id: number;
  code: string;
  name: string;
  currency: string;
  phonePrefix: string;
  operators: string;
  isActive: boolean;
}

function getCountryFlag(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌍";
  return String.fromCodePoint(...normalized.split("").map((letter) => 127397 + letter.charCodeAt(0)));
}

const emptyForm = { ownerName: "", phone: "", operatorName: "", country: "PH", logoUrl: "", isActive: true };

export default function AdminPaymentNumbers() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentNumber | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [manualCountry, setManualCountry] = useState(false);
  const [manualCountryInput, setManualCountryInput] = useState("");

  const { data: numbers = [], isLoading } = useQuery<PaymentNumber[]>({
    queryKey: ["/api/admin/payment-numbers"],
  });

  const { data: countries = [], isLoading: countriesLoading } = useQuery<Country[]>({
    queryKey: ["/api/countries"],
  });

  const selectedCountry = countries.find((country) => country.code === form.country);
  const configuredOperators = (() => {
    if (!selectedCountry?.operators) return [];
    try {
      const parsed = JSON.parse(selectedCountry.operators);
      return Array.isArray(parsed)
        ? parsed
          .map((operator) => String(operator).trim())
          .filter((operator, index, list) => operator && list.indexOf(operator) === index)
        : [];
    } catch {
      return [];
    }
  })();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        country: manualCountry ? manualCountryInput.toUpperCase().trim() : form.country,
      };
      if (!payload.country) throw new Error("Please select or enter a country");
      if (editTarget) {
        const res = await apiRequest("PUT", `/api/admin/payment-numbers/${editTarget.id}`, payload);
        if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Error"); }
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/payment-numbers", payload);
        if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Error"); }
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-numbers"] });
      toast({ title: editTarget ? "Number updated" : "Number added" });
      closeForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/payment-numbers/${id}`, {});
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Error"); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-numbers"] });
      toast({ title: "Number deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/payment-numbers/${id}`, { isActive });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Error"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-numbers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-numbers"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setManualCountry(false);
    setManualCountryInput("");
    setShowForm(true);
  };

  const openEdit = (num: PaymentNumber) => {
    setEditTarget(num);
    const isKnown = countries.some(c => c.code === num.country);
    setManualCountry(!isKnown);
    setManualCountryInput(!isKnown ? num.country : "");
    setForm({ ownerName: num.ownerName, phone: num.phone, operatorName: num.operatorName, country: isKnown ? num.country : "", logoUrl: num.logoUrl || "", isActive: num.isActive });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
    setForm(emptyForm);
    setManualCountry(false);
    setManualCountryInput("");
  };

  const grouped = numbers.reduce((acc, n) => {
    if (!acc[n.country]) acc[n.country] = [];
    acc[n.country].push(n);
    return acc;
  }, {} as Record<string, PaymentNumber[]>);

  const getCountryName = (code: string) => {
    const found = countries.find(c => c.code === code);
    return found ? found.name : code;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{numbers.length} configured number(s)</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-payment-number">
          <Plus className="w-4 h-4 mr-2" />
          Add number
        </Button>
      </div>

      {isLoading ? (
        Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)
      ) : numbers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No numbers configured</p>
          <p className="text-xs mt-1">Add a number for a configured operator.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([country, nums]) => (
          <div key={country}>
            <div className="flex items-center gap-2 mb-2">
               <span className="text-lg">{getCountryFlag(country)}</span>
              <h3 className="font-semibold text-foreground">{getCountryName(country)}</h3>
              <Badge variant="secondary">{nums.length}</Badge>
            </div>
            <div className="space-y-2 ml-2">
              {nums.map((num) => (
                <Card key={num.id} className={num.isActive ? "" : "opacity-60"}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {num.logoUrl ? (
                        <img src={num.logoUrl} alt={num.operatorName} className="w-12 h-12 rounded-xl object-contain border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                          <Phone className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{num.operatorName}</p>
                          <Badge variant={num.isActive ? "default" : "secondary"} className="text-xs">
                            {num.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="font-mono text-primary font-bold">{num.phone}</p>
                        <p className="text-sm text-muted-foreground">{num.ownerName}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost"
                          onClick={() => toggleActiveMutation.mutate({ id: num.id, isActive: !num.isActive })}
                          disabled={toggleActiveMutation.isPending}
                          data-testid={`button-toggle-active-${num.id}`}>
                          {num.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(num)} data-testid={`button-edit-${num.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive"
                          onClick={() => { if (confirm("Delete this number?")) deleteMutation.mutate(num.id); }}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${num.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit number" : "Add payment number"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Country</label>
              <Select value={form.country} onValueChange={(country) => setForm(f => ({ ...f, country, operatorName: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a country" /></SelectTrigger>
                <SelectContent>
                   {countries.filter(c => c.isActive).map(c => <SelectItem key={c.code} value={c.code}>{getCountryFlag(c.code)} {c.name} ({c.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Operator</label>
              <Select
                value={form.operatorName}
                onValueChange={(operatorName) => setForm(f => ({ ...f, operatorName }))}
              >
                <SelectTrigger
                  className="mt-1"
                  disabled={countriesLoading || configuredOperators.length === 0}
                  data-testid="select-operator-name"
                >
                  <SelectValue placeholder="Select an operator" />
                </SelectTrigger>
                <SelectContent>
                  {configuredOperators.map((operator) => (
                    <SelectItem key={operator} value={operator}>
                      {operator}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {countriesLoading ? (
                <p className="mt-1 text-xs text-muted-foreground">Loading operators...</p>
              ) : configuredOperators.length === 0 ? (
                <p className="mt-1 text-xs text-destructive">
                  No operators configured. Add operators in the country settings first.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select an operator already configured for this country.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Phone number</label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ex: +22890000000" className="mt-1" data-testid="input-phone" />
            </div>
            <div>
              <label className="text-sm font-medium">Owner name</label>
              <Input value={form.ownerName} onChange={(e) => setForm(f => ({ ...f, ownerName: e.target.value }))}
                placeholder="Ex: Jean Dupont" className="mt-1" data-testid="input-owner-name" />
            </div>
            <div>
              <label className="text-sm font-medium">Logo URL <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input value={form.logoUrl} onChange={(e) => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..." className="mt-1" data-testid="input-logo-url" />
              {form.logoUrl && (
                <img src={form.logoUrl} alt="logo" className="mt-2 h-10 object-contain rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <label htmlFor="isActive" className="text-sm font-medium">Active (visible to users)</label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeForm}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.ownerName || !form.phone || !form.operatorName || (!manualCountry && !form.country) || (manualCountry && !manualCountryInput.trim())}
                data-testid="button-save-payment-number"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editTarget ? "Edit" : "Add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
