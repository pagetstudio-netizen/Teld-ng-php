import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pencil, Globe, Plus, Trash2 } from "lucide-react";
import type { Country } from "@shared/schema";
import { FALLBACK_COUNTRIES } from "@/lib/countries";

interface CountryForm {
  code: string;
  name: string;
  currency: string;
  phonePrefix: string;
  operators: string;
  isActive: boolean;
}

const emptyForm: CountryForm = {
  code: "PH",
  name: "Philippines",
  currency: "PHP",
  phonePrefix: "63",
  operators: "PayMaya, GCash",
  isActive: true,
};

export default function AdminCountries() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CountryForm>(emptyForm);

  const { data: countriesList, isLoading } = useQuery<Country[]>({
    queryKey: ["/api/admin/countries"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CountryForm) => {
      const payload = {
        ...data,
        operators: JSON.stringify(
          data.operators.split(",").map(o => o.trim()).filter(Boolean)
        ),
      };
      if (editingId) {
        const res = await apiRequest("PUT", `/api/admin/countries/${editingId}`, payload);
        if (!res.ok) throw new Error((await res.json()).message);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/countries", payload);
        if (!res.ok) throw new Error((await res.json()).message);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: editingId ? "Country updated!" : "Country added!" });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/countries/${id}`, {});
      if (!res.ok) throw new Error((await res.json()).message || "Unable to deactivate country");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
      toast({ title: "Country deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/admin/countries/${id}`, { isActive });
      if (!res.ok) throw new Error((await res.json()).message || "Unable to update country");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/countries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/countries"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openAdd = () => {
    const configuredCodes = new Set((countriesList || []).map((country) => country.code));
    const template = FALLBACK_COUNTRIES.find((country) => !configuredCodes.has(country.code));
    if (!template) {
      toast({ title: "No country available", description: "All supported countries are already configured.", variant: "destructive" });
      return;
    }
    setEditingId(null);
    setForm({
      code: template.code,
      name: template.name,
      currency: template.currency,
      phonePrefix: template.phonePrefix,
      operators: template.operators.join(", "),
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Country) => {
    let operatorsStr = "";
    try { operatorsStr = JSON.parse(c.operators).join(", "); } catch {}
    setForm({
      code: c.code,
      name: c.name,
      currency: c.currency,
      phonePrefix: c.phonePrefix,
      operators: operatorsStr,
      isActive: c.isActive,
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Countries and operators
        </h2>
          <Button onClick={openAdd} data-testid="button-add-country">
            <Plus className="w-4 h-4 mr-2" />
            Add country
          </Button>
      </div>

       {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      <div className="grid gap-3">
        {countriesList?.map((c) => {
          let ops: string[] = [];
          try { ops = JSON.parse(c.operators); } catch {}
          return (
            <Card key={c.id} data-testid={`card-country-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base">{c.name}</span>
                      <Badge variant="outline" className="text-xs">{c.code}</Badge>
                      <Badge variant="secondary" className="text-xs">{c.currency}</Badge>
                      <Badge variant={c.isActive ? "default" : "destructive"} className="text-xs">
                        {c.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Phone prefix: +{c.phonePrefix}
                    </p>
                    {ops.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ops.map((op) => (
                          <Badge key={op} variant="outline" className="text-xs font-normal">{op}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(isActive) => activeMutation.mutate({ id: c.id, isActive })}
                      disabled={activeMutation.isPending}
                      aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                      data-testid={`switch-country-${c.id}`}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-country-${c.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`Deactivate ${c.name}?`)) deleteMutation.mutate(c.id);
                      }}
                      disabled={deleteMutation.isPending || !c.isActive}
                      aria-label={`Deactivate ${c.name}`}
                      data-testid={`button-delete-country-${c.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {countriesList?.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">No countries configured</p>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setDialogOpen(false); setEditingId(null); setForm(emptyForm); }}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit country and operators" : "Add country and operators"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country code</Label>
                <Input
                  value={form.code}
                  placeholder="PH"
                  maxLength={3}
                  disabled={Boolean(editingId)}
                  required
                  data-testid="input-country-code"
                />
              </div>
              <div>
                  <Label>Provider currency</Label>
                <Input
                  value={form.currency}
                  placeholder="PHP"
                  maxLength={5}
                  disabled={Boolean(editingId)}
                  data-testid="input-country-currency"
                />
              </div>
            </div>
            <div>
              <Label>Country name</Label>
              <Input
                value={form.name}
                placeholder="Philippines"
                disabled={Boolean(editingId)}
                data-testid="input-country-name"
              />
            </div>
            <div>
              <Label>Phone prefix (without +)</Label>
              <Input
                value={form.phonePrefix}
                placeholder="228"
                disabled={Boolean(editingId)}
                data-testid="input-country-prefix"
              />
            </div>
            <div>
              <Label>Operators (comma-separated)</Label>
              <Input
                value={form.operators}
                onChange={e => setForm({ ...form, operators: e.target.value })}
                placeholder="PayMaya, GCash"
                data-testid="input-country-operators"
              />
              <p className="text-xs text-muted-foreground mt-1">These operators control the mobile accounts and payment numbers for this country.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-country">
                 {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
