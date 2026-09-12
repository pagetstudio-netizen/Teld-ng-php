import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getBaseSettingForCountry } from "@/lib/countries";

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutModal({ open, onClose }: AboutModalProps) {
  const { user } = useAuth();
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const groupLink = settings?.groupLink || "https://t.me/sybotx";
  const country = user?.country || "PH";
  const signupBonus = formatCurrency(
    Number(getBaseSettingForCountry(settings || {}, "signupBonus", country, "40")),
    country,
  );
  const level1Commission = settings?.level1Commission || "20";
  const level2Commission = settings?.level2Commission || "5";
  const level3Commission = settings?.level3Commission || "2";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className={[
          "h-[603px] max-h-[calc(100dvh-30px)] w-[calc(100%-36px)] max-w-[424px]",
          "overflow-hidden rounded-[14px] border-0 bg-[#d9d9d9] p-0 text-[#161616]",
          "font-[Arial,Helvetica,sans-serif] shadow-[0_2px_12px_rgba(0,0,0,.35)]",
          "[&>button]:hidden",
        ].join(" ")}
        data-testid="welcome-modal"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 px-4 pb-[18px] pt-[16px] text-center">
            <DialogTitle className="text-[28px] font-bold leading-[34px] text-[#343434]">
              Platform
            </DialogTitle>
            <DialogDescription className="sr-only">
              Welcome information about the TELD platform.
            </DialogDescription>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-[31px] text-[16px] leading-[1.52]">
            <p className="mb-[21px]">✨Welcome to TELD!</p>
            <p className="mb-[18px]">
              ✔️ The most reliable charging and investment app!
            </p>
            <div className="space-y-[2px]">
               <p>➤ New users receive {signupBonus} when they sign up.</p>
              <p>
                 ➤ Earn commissions of {level1Commission}%, {level2Commission}% and{" "}
                 {level3Commission}% for each friend you refer.
              </p>
              <p>➤ Deposits and withdrawals available 24/7.</p>
              <p>
                 ➤ Enjoy stable returns on your individual investments for up to
                 100 days.
              </p>
            </div>
            <p className="mt-[25px]">↪️ Start building your wealth today!</p>
          </div>

          <div className="shrink-0 space-y-[19px] px-[11px] pb-[20px] pt-[12px]">
            <a
              href={groupLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-[45px] w-full items-center justify-center rounded-[8px] bg-white text-[17px] leading-none text-[#111] no-underline shadow-[0_1px_2px_rgba(0,0,0,.06)] transition-colors hover:bg-[#f5f5f5] active:bg-[#eeeeee]"
              data-testid="welcome-telegram-link"
            >
              Telegram group
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-[45px] w-full items-center justify-center rounded-[8px] bg-[#222] text-[17px] leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-colors hover:bg-[#2d2d2d] active:bg-[#111]"
              data-testid="welcome-dismiss"
            >
              OK
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
