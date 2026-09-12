import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import giftHero from "@assets/images_(75)_1787504538978.jpeg";
import telegramIcon from "@assets/tg-1_1787390593655.png";

export default function GiftCodePage() {
  const { refreshUser } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const claimMutation = useMutation({
    mutationFn: async (giftCode: string) => {
      const response = await apiRequest("POST", "/api/gift-codes/claim", { code: giftCode });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error");
      }
      return response.json();
    },
    onSuccess: (data) => {
      refreshUser();
      setCode("");
      toast({ title: "Congratulations!", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!code.trim()) {
      toast({ title: "Error", description: "Please enter a code", variant: "destructive" });
      return;
    }
    claimMutation.mutate(code.trim());
  };

  return (
    <main className="gift-reference">
      <style>{`
        .gift-reference { min-height: 100dvh; background: #f3f3f3; color: #151515; font-family: Arial, sans-serif; }
        .gift-reference *, .gift-reference *::before, .gift-reference *::after { box-sizing: border-box; }
        .gift-reference .gift-screen { width: 100%; max-width: 512px; min-height: 100dvh; margin: 0 auto; background: #f3f3f3; }
        .gift-reference .gift-title { height: 80px; display: flex; align-items: center; padding: 0 38px; background: #fff; border-bottom: 1px solid #ddd; }
        .gift-reference .gift-title a { color: #37434b; font-size: 38px; line-height: 1; text-decoration: none; }
         .gift-reference .gift-title h1 { flex: 1; margin: 0; color: #00ABB7; font-size: 21px; font-weight: 700; text-align: center; }
        .gift-reference .gift-hero { display: block; width: 100%; height: auto; aspect-ratio: 461 / 292; object-fit: cover; }
        .gift-reference .gift-description { height: 58px; display: flex; align-items: center; padding: 0 21px; background: #f8f8f8; color: #555; font-size: 17px; }
        .gift-reference .gift-telegram { height: 93px; display: flex; align-items: center; padding: 0 21px; background: #fff; border-bottom: 1px solid #eee; text-decoration: none; }
        .gift-reference .gift-telegram img { width: 56px; height: 56px; margin-right: 15px; object-fit: contain; }
        .gift-reference .gift-telegram strong { flex: 1; color: #171717; font-size: 19px; }
        .gift-reference .gift-telegram svg { width: 22px; height: 22px; color: #aaa; stroke-width: 2; }
        .gift-reference .gift-form { padding: 29px 21px 0; }
        .gift-reference .gift-label { display: block; margin-bottom: 17px; color: #151515; font-size: 19px; font-weight: 700; }
         .gift-reference .gift-label::first-letter { color: #00ABB7; }
        .gift-reference .gift-input { display: block; width: 100%; height: 67px; border: 0; border-radius: 8px; padding: 0 21px; outline: 0; background: #e9e9eb; color: #333; font-size: 16px; }
        .gift-reference .gift-input::placeholder { color: #a6a9b3; opacity: 1; }
         .gift-reference .gift-submit { display: block; width: calc(100% - 42px); height: 69px; margin: 37px auto 0; border: 0; border-radius: 36px; background: #00ABB7; color: white; font-size: 21px; font-weight: 700; box-shadow: 0 8px 18px rgba(0, 171, 183, .2); }
        .gift-reference .gift-submit:active { transform: scale(.98); }
        .gift-reference .gift-submit:disabled { opacity: .7; }
        @media (max-width: 370px) {
          .gift-reference .gift-description { font-size: 15px; }
          .gift-reference .gift-title h1 { font-size: 19px; }
        }
      `}</style>
      <div className="gift-screen">
        <header className="gift-title">
          <Link href="/account" aria-label="Back">‹</Link>
          <h1>Redeem a gift</h1>
        </header>
        <img className="gift-hero" src={giftHero} alt="TELD charging station" data-testid="img-gift-banner" />
        <p className="gift-description">You can get a gift code in the group</p>
        <a className="gift-telegram" href={settings?.groupLink || "https://t.me/sybotx"} target="_blank" rel="noreferrer">
          <img src={telegramIcon} alt="" />
          <strong>Official group</strong>
          <ChevronRight aria-hidden="true" />
        </a>
        <form className="gift-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <label className="gift-label" htmlFor="gift-code-input"><span>* </span>Gift code</label>
          <input
            id="gift-code-input"
            className="gift-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter the gift code"
            data-testid="input-gift-code"
          />
          <button className="gift-submit" type="submit" disabled={claimMutation.isPending} data-testid="button-submit-code">
            {claimMutation.isPending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Confirm"}
          </button>
        </form>
      </div>
    </main>
  );
}