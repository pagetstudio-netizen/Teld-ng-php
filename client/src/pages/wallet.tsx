import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getPaymentMethodsForCountry, type ApiCountry } from "@/lib/countries";
import { Loader2, Plus, Trash2, CreditCard, ChevronLeft, ChevronRight, Shield, Check, Search, X } from "lucide-react";
import emptyIllustration from "@assets/illustration-8_1784762965573.png";
import { Link, useLocation, useSearch } from "wouter";
import type { WithdrawalWallet } from "@shared/schema";

const walletSchema = z.object({
  accountName: z.string().min(2, "Account holder name is required"),
  accountNumber: z.string().min(8, "Account number is required"),
  paymentMethod: z.string().min(2, "Payment method is required"),
});

type WalletForm = z.infer<typeof walletSchema>;

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const selectMode = params.get("from") === "withdrawal";
  const [showForm, setShowForm] = useState(false);
  const [showBankSheet, setShowBankSheet] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const { data: wallets, isLoading } = useQuery<WithdrawalWallet[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: apiCountries = [] } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
  });

  const form = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    defaultValues: { accountName: "", accountNumber: "", paymentMethod: "" },
  });

  const addMutation = useMutation({
    mutationFn: async (data: WalletForm) => {
      const response = await apiRequest("POST", "/api/wallets", {
        ...data,
        country: user!.country,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Wallet added!" });
      form.reset();
      setSelectedMethod("");
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (walletId: number) => {
      const response = await apiRequest("DELETE", `/api/wallets/${walletId}`, {});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ title: "Wallet deleted!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (walletId: number) => {
      const response = await apiRequest("PATCH", `/api/wallets/${walletId}/default`, {});
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSelectWallet = (wallet: WithdrawalWallet) => {
    if (selectMode) {
      localStorage.setItem("selectedWalletId", wallet.id.toString());
      navigate("/withdrawal");
    }
  };

  const handleChooseMethod = (method: string) => {
    setSelectedMethod(method);
    form.setValue("paymentMethod", method);
    setBankSearch("");
    setShowBankSheet(false);
  };

  const handleSubmit = () => {
    form.handleSubmit((data) => addMutation.mutate(data))();
  };

  if (!user) return null;

  const paymentMethods = getPaymentMethodsForCountry(user.country, apiCountries);
  const backLink = selectMode ? "/withdrawal" : "/account";

  /* ─── ADD FORM VIEW ─── */
  if (showForm) {
    return (
      <div className="flex flex-col min-h-full bg-gray-50">

        {/* Header */}
        <div
          className="flex items-center px-4 py-4"
           style={{ background: "linear-gradient(112deg, #55c9e5 0%, #3174d1 100%)" }}
        >
          <button
            onClick={() => { setShowForm(false); form.reset(); setSelectedMethod(""); }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20"
            data-testid="button-back-form"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="flex-1 text-center text-white font-bold text-base mr-9">
            Add a mobile account
          </h1>
        </div>

        {/* Form sections */}
        <div className="flex-1 bg-white mt-3 mx-4 rounded-2xl shadow-sm overflow-hidden">

          {/* Bank selector */}
          <button
            type="button"
            onClick={() => setShowBankSheet(true)}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-100"
            data-testid="button-select-bank"
          >
            <div className="text-left">
              <p className="text-xs text-gray-400 mb-0.5">Operator</p>
              <p className={`text-sm font-medium ${selectedMethod ? "text-gray-800" : "text-gray-400"}`}>
                {selectedMethod || "Select an operator"}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>

          {/* Account name */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Account holder</p>
            <input
              {...form.register("accountName")}
              placeholder="Account holder name"
              className="w-full text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-300"
              data-testid="input-wallet-name"
            />
            {form.formState.errors.accountName && (
              <p className="text-xs text-[#FF4500] mt-1">{form.formState.errors.accountName.message}</p>
            )}
          </div>

          {/* Account number */}
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Account number</p>
            <input
              {...form.register("accountNumber")}
              type="tel"
              placeholder="Account number"
              className="w-full text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-300"
              data-testid="input-wallet-number"
            />
            {form.formState.errors.accountNumber && (
              <p className="text-xs text-[#FF4500] mt-1">{form.formState.errors.accountNumber.message}</p>
            )}
          </div>
        </div>

        {/* Confirm button */}
        <div className="px-4 py-6 mt-auto">
          <button
            onClick={handleSubmit}
            disabled={addMutation.isPending}
            className="w-full py-4 rounded-full text-white font-bold text-base disabled:opacity-40 shadow-md"
             style={{ background: "linear-gradient(112deg, #55c9e5 0%, #3174d1 100%)" }}
            data-testid="button-confirm-wallet"
          >
            {addMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement...
              </span>
            ) : (
              "Confirm"
            )}
          </button>
        </div>

        {/* Bank bottom sheet */}
        {showBankSheet && (
          <div className="country-picker-overlay" onClick={() => { setBankSearch(""); setShowBankSheet(false); }}>
            <section
              className="country-picker"
              role="dialog"
              aria-modal="true"
              aria-label="Choose an operator"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="country-picker-close"
                onClick={() => { setBankSearch(""); setShowBankSheet(false); }}
                aria-label="Close"
              >
                <X aria-hidden="true" />
              </button>
              <div className="country-picker-search">
                <Search aria-hidden="true" />
                <input
                  autoFocus
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search operators"
                />
              </div>
              <div className="country-picker-list">
                {paymentMethods
                  .filter((method) => method.toLowerCase().includes(bankSearch.trim().toLowerCase()))
                  .map((method) => (
                  <button
                    key={method}
                    onClick={() => handleChooseMethod(method)}
                    className={`country-picker-row${selectedMethod === method ? " is-selected" : ""}`}
                    data-testid={`button-bank-${method}`}
                  >
                    <span>{method}</span>
                    {selectedMethod === method && (
                      <span className="country-picker-check"><Check aria-hidden="true" /></span>
                    )}
                  </button>
                ))}
                {paymentMethods.filter((method) => method.toLowerCase().includes(bankSearch.trim().toLowerCase())).length === 0 && (
                  <p className="country-picker-empty">No operators found</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <div className="flex flex-col min-h-full bg-gray-50">

      {/* Header */}
      <div
        className="flex items-center px-4 py-4"
        style={{ background: "linear-gradient(112deg, #55c9e5 0%, #3174d1 100%)" }}
      >
        <Link href={backLink}>
          <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20" data-testid="button-back">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-base">
          {selectMode ? "Select a mobile account" : "Mobile accounts"}
        </h1>
        {!selectMode ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20"
            data-testid="button-add-wallet-icon"
          >
            <Plus className="w-5 h-5 text-white" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Wallet list */}
      <div className="flex-1 px-4 pt-4 pb-28 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#3174d1]" />
          </div>
        ) : wallets && wallets.length > 0 ? (
          wallets.map((wallet) => (
            <div
              key={wallet.id}
              onClick={() => selectMode && handleSelectWallet(wallet)}
              className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 ${
                selectMode ? "cursor-pointer active:opacity-80" : ""
              } ${wallet.isDefault ? "border-l-4 border-[#3174d1]" : ""}`}
              data-testid={`wallet-card-${wallet.id}`}
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-gray-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm">{wallet.paymentMethod}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{wallet.accountName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{wallet.accountNumber}</p>
                {wallet.isDefault && (
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-[#3174d1]" />
                    <span className="text-xs text-[#3174d1] font-medium">Default</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!selectMode && (
                <div className="flex items-center gap-1">
                  {!wallet.isDefault && (
                    <button
                      onClick={() => setDefaultMutation.mutate(wallet.id)}
                      disabled={setDefaultMutation.isPending}
                      className="p-2"
                      data-testid={`button-set-default-${wallet.id}`}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(wallet.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2"
                    data-testid={`button-delete-wallet-${wallet.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-[#3174d1]" />
                  </button>
                </div>
              )}

              {selectMode && (
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-10 flex flex-col items-center gap-2">
            <img src={emptyIllustration} alt="No wallets" className="w-40 h-40 object-contain opacity-90" />
            <p className="text-gray-500 text-sm">No mobile account registered</p>
            <p className="text-gray-400 text-xs mt-1">Add an account to make withdrawals</p>
          </div>
        )}
      </div>

      {/* Bottom add button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gray-50">
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 rounded-full text-white font-bold text-base shadow-md"
           style={{ background: "linear-gradient(112deg, #55c9e5 0%, #3174d1 100%)" }}
          data-testid="button-add-wallet"
        >
          Add a mobile account
        </button>
      </div>
    </div>
  );
}
