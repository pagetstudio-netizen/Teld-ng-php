import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fromBaseCurrency, formatLocalCurrency, getBaseSettingForCountry, getPaymentMethodsForCountry, type ApiCountry } from "@/lib/countries";
import { Loader2 } from "lucide-react";
import type { PaymentChannel } from "@shared/schema";

const depositSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  paymentMethod: z.string().min(2, "Payment method is required"),
  paymentChannelId: z.string().min(1, "Top-up channel is required"),
});

type DepositForm = z.infer<typeof depositSchema>;

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DepositModal({ open, onClose }: DepositModalProps) {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"amount" | "details">("amount");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const { data: channels } = useQuery<PaymentChannel[]>({
    queryKey: ["/api/payment-channels"],
    enabled: open,
  });

  const { data: apiCountries } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
    enabled: open,
  });

  const { data: platformSettings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    enabled: open,
  });

  const form = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: "",
      paymentMethod: "",
      paymentChannelId: "",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: DepositForm) => {
      const response = await apiRequest("POST", "/api/deposits", {
        amount: parseInt(data.amount),
        accountName: user!.fullName,
        accountNumber: user!.phone,
        country: user!.country,
        paymentMethod: data.paymentMethod,
        paymentChannelId: parseInt(data.paymentChannelId),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Error");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      refreshUser();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank");
      }
      toast({ title: "Request sent!", description: "Your deposit is awaiting approval." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep("amount");
    setSelectedAmount(null);
    form.reset();
    onClose();
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    form.setValue("amount", amount.toString());
    setStep("details");
  };

  const handleCustomAmount = () => {
    const amount = parseInt(form.getValues("amount"));
    const country = user?.country || "PH";
    const minimum = fromBaseCurrency(
      parseInt(getBaseSettingForCountry(platformSettings || {}, "minDeposit", country, "320")),
      country,
    );
    if (amount >= minimum) {
      setSelectedAmount(amount);
      setStep("details");
    } else {
      toast({ title: "Invalid amount", description: `The minimum amount is ${formatLocalCurrency(minimum, user?.country || "PH")}`, variant: "destructive" });
    }
  };

  if (!user) return null;

  const paymentMethods = getPaymentMethodsForCountry(user.country, apiCountries);
  const activeChannels = channels?.filter(c => c.isActive) || [];
  const minimumDepositBase = parseInt(getBaseSettingForCountry(platformSettings || {}, "minDeposit", user.country, "320"));
  const presetAmounts = [minimumDepositBase, 640, 1280, 2560, 5000, 10000]
    .filter((baseAmount, index, values) => values.indexOf(baseAmount) === index)
    .map((baseAmount) => fromBaseCurrency(baseAmount, user.country));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "amount" ? "Top up" : "Payment details"}
          </DialogTitle>
        </DialogHeader>

        {step === "amount" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Minimum: {formatLocalCurrency(fromBaseCurrency(minimumDepositBase, user.country), user.country)}
            </p>

            <div className="grid grid-cols-3 gap-2">
              {presetAmounts.map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  onClick={() => handleAmountSelect(amount)}
                  data-testid={`button-amount-${amount}`}
                >
                   {formatLocalCurrency(amount, user.country)}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Custom amount"
                value={form.watch("amount")}
                onChange={(e) => form.setValue("amount", e.target.value)}
                data-testid="input-custom-amount"
              />
              <Button onClick={handleCustomAmount} data-testid="button-custom-amount">
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))} className="space-y-4">
              <div className="bg-secondary rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold text-primary">
                   {formatLocalCurrency(selectedAmount || 0, user.country)}
                </p>
              </div>

              <FormField
                control={form.control}
                name="paymentChannelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Top-up channel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-channel">
                          <SelectValue placeholder="Choose a channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id.toString()}>
                            {channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue placeholder="Choose" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep("amount")} className="flex-1">
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={depositMutation.isPending} data-testid="button-submit-deposit">
                  {depositMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Proceed to payment"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
