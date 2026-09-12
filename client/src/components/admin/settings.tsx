import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, Link, Clock, Users, Zap } from "lucide-react";

const NETWORKS = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
];

const settingsSchema = z.object({
  supportLink: z.string().min(5, "Link is required"),
  supportType: z.string().min(1, "Network is required"),
  supportLabel: z.string().min(1, "Label is required"),
  support2Link: z.string().min(5, "Link is required"),
  support2Type: z.string().min(1, "Network is required"),
  support2Label: z.string().min(1, "Label is required"),
  channelLink: z.string().min(5, "Link is required"),
  channelType: z.string().min(1, "Network is required"),
  channelLabel: z.string().min(1, "Label is required"),
  groupLink: z.string().min(5, "Link is required"),
  groupType: z.string().min(1, "Network is required"),
  groupLabel: z.string().min(1, "Label is required"),
  popupButtonLabel: z.string().min(1, "Label is required"),
  supportEnabled: z.boolean(),
  support2Enabled: z.boolean(),
  channelEnabled: z.boolean(),
  groupEnabled: z.boolean(),
  signupBonus: z.string().min(1, "Bonus is required"),
  minDeposit: z.string().min(1, "Amount is required"),
  minWithdrawal: z.string().min(1, "Amount is required"),
  signupBonus_NG: z.string().min(1, "Nigeria bonus is required"),
  minDeposit_NG: z.string().min(1, "Nigeria deposit amount is required"),
  minWithdrawal_NG: z.string().min(1, "Nigeria withdrawal amount is required"),
  withdrawalFees: z.string().min(1, "Fee is required"),
  maxWithdrawalsPerDay: z.string().min(1, "Required"),
  withdrawalStartHour: z.string().min(1, "Start time is required"),
  withdrawalEndHour: z.string().min(1, "End time is required"),
  level1Commission: z.string().min(1, "Commission is required"),
  level2Commission: z.string().min(1, "Commission is required"),
  level3Commission: z.string().min(1, "Commission is required"),
  sendavapayEnabled: z.boolean(),
  sendavapayChannelName: z.string().min(1, "Name is required"),
  westpayEnabled: z.boolean(),
  westpayChannelName: z.string().min(1, "Name is required"),
  westpayCountries: z.string(),
  seapayEnabled: z.boolean(),
  seapayCountries: z.string(),
  seapayChannelName: z.string().min(1, "Name is required"),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface AdminSettingsProps {
  isSuperAdmin: boolean;
}

export default function AdminSettings({ isSuperAdmin }: AdminSettingsProps) {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/admin/settings"],
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      supportLink: "https://t.me/sybotx",
      supportType: "telegram",
      supportLabel: "Customer service",
      support2Link: "https://t.me/sybotx",
      support2Type: "telegram",
      support2Label: "Customer service 2",
      channelLink: "https://t.me/sybotx",
      channelType: "telegram",
      channelLabel: "Official channel",
      groupLink: "https://t.me/sybotx",
      groupType: "telegram",
      groupLabel: "Discussion group",
      popupButtonLabel: "Click here to join the Telegram group",
      supportEnabled: true,
      support2Enabled: true,
      channelEnabled: true,
      groupEnabled: true,
       signupBonus: "40",
       minDeposit: "320",
       minWithdrawal: "100",
       signupBonus_NG: "24",
       minDeposit_NG: "175",
       minWithdrawal_NG: "28",
      withdrawalFees: "10",
      maxWithdrawalsPerDay: "1",
      withdrawalStartHour: "9",
       withdrawalEndHour: "17",
       level1Commission: "20",
       level2Commission: "5",
       level3Commission: "2",
      sendavapayEnabled: false,
      sendavapayChannelName: "SendavaPay",
       westpayEnabled: false,
      westpayChannelName: "WestPay",
       westpayCountries: "PH",
       seapayEnabled: false,
        seapayCountries: "PH,NG",
       seapayChannelName: "SeaPay",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        supportLink: settings.supportLink || "https://t.me/sybotx",
        supportType: settings.supportType || "telegram",
        supportLabel: settings.supportLabel || "Customer service",
        support2Link: settings.support2Link || "https://t.me/sybotx",
        support2Type: settings.support2Type || "telegram",
        support2Label: settings.support2Label || "Customer service 2",
        channelLink: settings.channelLink || "https://t.me/sybotx",
        channelType: settings.channelType || "telegram",
        channelLabel: settings.channelLabel || "Official channel",
        groupLink: settings.groupLink || "https://t.me/sybotx",
        groupType: settings.groupType || "telegram",
        groupLabel: settings.groupLabel || "Discussion group",
        popupButtonLabel: settings.popupButtonLabel || "Click here to join the Telegram group",
        supportEnabled: settings.supportEnabled !== "false",
        support2Enabled: settings.support2Enabled !== "false",
        channelEnabled: settings.channelEnabled !== "false",
        groupEnabled: settings.groupEnabled !== "false",
         signupBonus: settings.signupBonus || "40",
         minDeposit: settings.minDeposit || "320",
         minWithdrawal: settings.minWithdrawal || "100",
         signupBonus_NG: settings.signupBonus_NG || "24",
         minDeposit_NG: settings.minDeposit_NG || "175",
         minWithdrawal_NG: settings.minWithdrawal_NG || "28",
        withdrawalFees: settings.withdrawalFees || "10",
        maxWithdrawalsPerDay: settings.maxWithdrawalsPerDay || "1",
        withdrawalStartHour: settings.withdrawalStartHour || "9",
         withdrawalEndHour: settings.withdrawalEndHour || "17",
        level1Commission: settings.level1Commission || "20",
        level2Commission: settings.level2Commission || "5",
        level3Commission: settings.level3Commission || "2",
        sendavapayEnabled: settings.sendavapayEnabled === "true",
        sendavapayChannelName: settings.sendavapayChannelName || "SendavaPay",
        westpayEnabled: settings.westpayEnabled === "true",
        westpayChannelName: settings.westpayChannelName || "WestPay",
        westpayCountries: settings.westpayCountries || "PH",
         seapayEnabled: settings.seapayEnabled === "true",
          seapayCountries: settings.seapayCountries || "PH,NG",
         seapayChannelName: settings.seapayChannelName || "SeaPay",
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const serialized = {
        ...data,
        supportEnabled: String(data.supportEnabled),
        support2Enabled: String(data.support2Enabled),
        channelEnabled: String(data.channelEnabled),
        groupEnabled: String(data.groupEnabled),
        sendavapayEnabled: String(data.sendavapayEnabled),
        westpayEnabled: String(data.westpayEnabled),
        seapayEnabled: String(data.seapayEnabled),
      };
      const response = await apiRequest("POST", "/api/admin/settings", serialized);
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/links"] });
      toast({ title: "Settings saved!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">

        {/* ── Links & Social networks ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link className="w-5 h-5 text-primary" />
              Links & Social networks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Support 1 */}
            <div className="space-y-2 border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link 1 — Customer service</p>
                <FormField control={form.control} name="supportEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500">{field.value ? "Active" : "Disabled"}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="supportLabel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display label</FormLabel>
                    <FormControl><Input {...field} placeholder="Customer service" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="supportType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Network..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="supportLink" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL link</FormLabel>
                  <FormControl><Input {...field} placeholder="https://t.me/..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Support 2 */}
            <div className="space-y-2 border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link 2 — Customer service</p>
                <FormField control={form.control} name="support2Enabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500">{field.value ? "Active" : "Disabled"}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="support2Label" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display label</FormLabel>
                    <FormControl><Input {...field} placeholder="Customer service 2" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="support2Type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Network..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="support2Link" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL link</FormLabel>
                  <FormControl><Input {...field} placeholder="https://t.me/..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Channel */}
            <div className="space-y-2 border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link 3 — Official channel</p>
                <FormField control={form.control} name="channelEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500">{field.value ? "Active" : "Disabled"}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="channelLabel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display label</FormLabel>
                    <FormControl><Input {...field} placeholder="Official channel" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="channelType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Network..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="channelLink" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL link</FormLabel>
                  <FormControl><Input {...field} placeholder="https://t.me/..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Group */}
            <div className="space-y-2 border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Link 4 — Discussion group</p>
                <FormField control={form.control} name="groupEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500">{field.value ? "Active" : "Disabled"}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="groupLabel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display label</FormLabel>
                    <FormControl><Input {...field} placeholder="Discussion group" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="groupType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Social network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Network..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NETWORKS.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="groupLink" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL link</FormLabel>
                  <FormControl><Input {...field} placeholder="https://t.me/..." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Popup dashboard button */}
            <div className="border border-red-500 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <p className="text-sm font-semibold text-red-600">Dashboard popup button</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This button appears in the warning window that opens automatically on the home page.
              </p>
              <FormField control={form.control} name="popupButtonLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Button text <span className="text-red-500">(dashboard popup)</span></FormLabel>
                  <FormControl><Input {...field} placeholder="E.g. Click here to join the Telegram group" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="groupLink" render={({ field }) => (
                <FormItem>
                  <FormLabel>Button link <span className="text-red-500">(dashboard popup)</span></FormLabel>
                  <FormControl><Input {...field} placeholder="https://t.me/..." /></FormControl>
                  <FormDescription>This link is also used in the dashboard welcome popup.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

          </CardContent>
        </Card>

        {/* ── Withdrawals & Bonus ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Withdrawals & Bonus
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="signupBonus" render={({ field }) => (
              <FormItem>
                <FormLabel>Sign-up bonus (PHP)</FormLabel>
                <FormControl><Input {...field} type="number" min="0" /></FormControl>
                <FormDescription>Amount given to each new user when they sign up.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="minDeposit" render={({ field }) => (
                <FormItem>
                <FormLabel>Minimum deposit (PHP)</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="minWithdrawal" render={({ field }) => (
                <FormItem>
                <FormLabel>Minimum withdrawal (PHP)</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
              <p className="text-sm font-medium">Nigeria amounts (PHP ledger equivalent)</p>
              <p className="text-xs text-muted-foreground">
                These values are stored in the platform ledger currency and displayed as NGN to Nigeria users.
              </p>
              <FormField control={form.control} name="signupBonus_NG" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nigeria sign-up bonus (PHP ledger)</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="minDeposit_NG" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nigeria minimum deposit (PHP ledger)</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="minWithdrawal_NG" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nigeria minimum withdrawal (PHP ledger)</FormLabel>
                    <FormControl><Input {...field} type="number" min="0" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="withdrawalFees" render={({ field }) => (
                <FormItem>
                  <FormLabel>Withdrawal fee (%)</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" max="100" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxWithdrawalsPerDay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Max withdrawals / day</FormLabel>
                  <FormControl><Input {...field} type="number" min="1" max="10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="withdrawalStartHour" render={({ field }) => (
                <FormItem>
                  <FormLabel>Withdrawal start hour</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" max="23" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="withdrawalEndHour" render={({ field }) => (
                <FormItem>
                  <FormLabel>Withdrawal end hour</FormLabel>
                  <FormControl><Input {...field} type="number" min="0" max="23" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

         {/* ── Payment aggregators ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Payment aggregators
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SendavaPay */}
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">SendavaPay</p>
                  <p className="text-xs text-gray-500">
                     Automatic Mobile Money payment for enabled countries
                  </p>
                </div>
                <FormField control={form.control} name="sendavapayEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500 whitespace-nowrap">
                       {field.value ? "Active" : "Disabled"}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="sendavapayChannelName" render={({ field }) => (
                <FormItem>
                   <FormLabel>Displayed channel name</FormLabel>
                  <FormControl><Input {...field} placeholder="SendavaPay" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-700 space-y-1">
                <p className="font-semibold">SendavaPay configuration</p>
                     <p>Configured country: <strong>PH (Philippines)</strong></p>
                <p>Add <code className="bg-orange-100 px-1 rounded">SENDAVAPAY_API_KEY</code> to the server Secrets.</p>
                <p>Keep the webhook secret in <code className="bg-orange-100 px-1 rounded">SENDAVAPAY_WEBHOOK_SECRET</code>.</p>
                <p>Webhook : <code className="bg-orange-100 px-1 rounded">/api/webhooks/sendavapay</code></p>
              </div>
            </div>

            {/* WestPay */}
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">WestPay</p>
                  <p className="text-xs text-gray-500">
                     Mobile Money payment by redirecting to the secure page
                  </p>
                </div>
                <FormField control={form.control} name="westpayEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500 whitespace-nowrap">
                       {field.value ? "Active" : "Disabled"}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="westpayChannelName" render={({ field }) => (
                <FormItem>
                   <FormLabel>Displayed channel name</FormLabel>
                  <FormControl><Input {...field} placeholder="WestPay" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="westpayCountries" render={({ field }) => (
                <FormItem>
                  <FormLabel>Enabled countries</FormLabel>
                   <FormControl><Input {...field} placeholder="PH" /></FormControl>
                  <FormDescription className="text-xs">
                      Use the code <strong>PH</strong>. Leave blank for all supported countries.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-xs text-orange-700 space-y-1">
                <p className="font-semibold">WestPay configuration</p>
                <p>Add <code className="bg-orange-100 px-1 rounded">WESTPAY_MERCHANT_SLUG</code> to the server Secrets.</p>
                 <p>The withdrawal key and webhook secret must remain in the server Secrets.</p>
                <p>Webhook : <code className="bg-orange-100 px-1 rounded">/api/webhooks/westpay</code></p>
              </div>
            </div>

            {/* SeaPay */}
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">SeaPay</p>
                  <p className="text-xs text-gray-500">
                    Hosted Pay-In checkout for supported countries
                  </p>
                </div>
                <FormField control={form.control} name="seapayEnabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-xs text-gray-500 whitespace-nowrap">
                      {field.value ? "Active" : "Disabled"}
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
               <FormField control={form.control} name="seapayCountries" render={({ field }) => (
                 <FormItem>
                   <FormLabel>Enabled countries</FormLabel>
                   <FormControl><Input {...field} placeholder="PH,NG" /></FormControl>
                   <FormDescription>Comma-separated country codes. Nigeria requires an NGN channel on the SeaPay merchant account.</FormDescription>
                   <FormMessage />
                 </FormItem>
               )} />
               <FormField control={form.control} name="seapayChannelName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Displayed channel name</FormLabel>
                  <FormControl><Input {...field} placeholder="SeaPay" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">SeaPay configuration</p>
                 <p>Enable only countries assigned to the SeaPay merchant account. The app offers five published NG payout options, including PalmPay.</p>
                 <p>Use separate server Secrets for each merchant: Philippines — <code className="bg-blue-100 px-1 rounded">SEAPAY_PH_MERCHANT_ID</code>, <code className="bg-blue-100 px-1 rounded">SEAPAY_PH_API_KEY</code>, <code className="bg-blue-100 px-1 rounded">SEAPAY_PH_API_SECRET</code>; Nigeria — <code className="bg-blue-100 px-1 rounded">SEAPAY_NG_MERCHANT_ID</code>, <code className="bg-blue-100 px-1 rounded">SEAPAY_NG_API_KEY</code>, <code className="bg-blue-100 px-1 rounded">SEAPAY_NG_API_SECRET</code>. The API secret is used for payouts and SeaPay payout webhooks.</p>
                 <p>Optional country-specific settings are <code className="bg-blue-100 px-1 rounded">SEAPAY_PH_API_BASE</code>/<code className="bg-blue-100 px-1 rounded">SEAPAY_NG_API_BASE</code>, <code className="bg-blue-100 px-1 rounded">SEAPAY_PH_PAY_TYPES</code>/<code className="bg-blue-100 px-1 rounded">SEAPAY_NG_PAY_TYPES</code>, and country-specific notify URLs. Shared names remain supported for legacy credentials.</p>
                 <p>For Nigeria deposits, <code className="bg-blue-100 px-1 rounded">pay_type</code> is sent only when SeaPay gives your merchant multiple NGN channels. Set <code className="bg-blue-100 px-1 rounded">SEAPAY_NG_PAY_TYPES</code> to the supplied operator-to-channel JSON; never use payout bank routing codes as pay-in types.</p>
                 <p>For Nigeria payouts, set <code className="bg-blue-100 px-1 rounded">SEAPAY_PAYOUT_COUNTRIES=NG</code>. The five displayed methods use SeaPay's published routing codes; <code className="bg-blue-100 px-1 rounded">SEAPAY_NG_PAYOUT_BANK_CODES</code> is only needed for additional merchant-approved methods.</p>
                <p>Webhooks: <code className="bg-blue-100 px-1 rounded">/api/seapay/callback/deposit</code> for deposits and <code className="bg-blue-100 px-1 rounded">/api/seapay/callback/withdrawal</code> for payouts — SeaPay must receive the public URLs.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Commissions ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
               Referral commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="level1Commission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Level 1 (%)</FormLabel>
                  <FormControl><Input {...field} type="number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="level2Commission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Level 2 (%)</FormLabel>
                  <FormControl><Input {...field} type="number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="level3Commission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Level 3 (%)</FormLabel>
                  <FormControl><Input {...field} type="number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
               Save settings
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
