import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

import serviceImage from "@assets/images_(75)_1787504538978.jpeg";
import teldLogo from "@assets/Teld-azul-scaled_1787504539099.png";
import tonMachinesBanner from "@assets/images_(73)_1787504539028.jpeg";

interface LinksSettings {
  supportLink: string;
  channelLink: string;
  groupLink: string;
}

export default function ServicePage() {
  const { data: settings } = useQuery<LinksSettings>({
    queryKey: ["/api/settings/links"],
  });

  const telegramLinks = [
    { label: "@Telegram Support", href: settings?.supportLink || "https://t.me/sybotx", testId: "button-support-link", size: "short" },
    { label: "@Official Telegram\ngroup", href: settings?.groupLink || "https://t.me/sybotx", testId: "button-group-link", size: "tall" },
    { label: "@Official Telegram\nchannel", href: settings?.channelLink || "https://t.me/sybotx", testId: "button-channel-link", size: "tall" },
  ];

  return (
    <main className="service-reference">
      <style>{`
        .service-reference { min-height: 100dvh; background: #eeeeee; color: #4b4b4b; font-family: Arial, sans-serif; }
        .service-reference .service-screen { width: 100%; max-width: 512px; min-height: 100dvh; margin: 0 auto; overflow: hidden; background: #eeeeee; }
        .service-reference .service-header { position: relative; height: 85px; background: #fff; }
        .service-reference .service-back { position: absolute; top: 25px; left: 23px; display: grid; width: 42px; height: 42px; place-items: center; border: 0; background: transparent; color: #111; }
        .service-reference .service-back svg { width: 33px; height: 33px; stroke-width: 2.1; }
        .service-reference .service-logo { position: absolute; top: 20px; left: 123px; width: 61px; height: 46px; object-fit: contain; }
        .service-reference .service-title { position: absolute; top: 34px; left: 236px; margin: 0; color: #008895; font-size: 21px; font-weight: 400; line-height: 25px; }
        .service-reference .benefits { min-height: 178px; box-sizing: border-box; padding: 0 0 13px; background: #eeeeee; }
        .service-reference .benefit-banner { display: block; width: 100%; height: auto; }
        .service-reference .telegram-section { box-sizing: border-box; padding: 30px 21px 29px; background: #00ABB7; }
        .service-reference .telegram-title { margin: 0 0 27px; color: #fff; font-size: 35px; font-weight: 400; line-height: 42px; text-align: center; }
        .service-reference .telegram-grid { display: grid; grid-template-columns: minmax(0, 42.13%) minmax(0, 1fr); column-gap: 16px; align-items: start; }
        .service-reference .bike-image { width: 100%; height: auto; aspect-ratio: 606 / 506; margin-top: 20px; object-fit: contain; background: #000; }
        .service-reference .telegram-actions { min-width: 0; }
        .service-reference .telegram-link { position: relative; display: grid; width: 100%; align-items: center; justify-items: center; box-sizing: border-box; border: 0; border-radius: 46px; padding: 0 37px 0 10px; background: #fff; color: #008895; font-size: 21px; font-weight: 400; line-height: 28px; text-align: center; white-space: pre-line; box-shadow: 0 1px 2px rgba(0, 123, 136, .12); transition: transform .12s ease, background-color .12s ease; }
        .service-reference .telegram-link.short { height: 60px; }
        .service-reference .telegram-link.tall { height: 90px; margin-top: 15px; }
        .service-reference .telegram-link:active { transform: scale(.98); background: #f6fff6; }
        .service-reference .telegram-link svg { position: absolute; right: 11px; width: 25px; height: 25px; color: #008895; stroke-width: 1.9; }
        .service-reference .online-hours { margin-top: 11px; color: #fff; font-size: clamp(23px, 6.25vw, 32px); font-weight: 400; line-height: 1.4; text-align: center; white-space: normal; }
        .service-reference .online-hours p { margin: 0; }
        .service-reference .advice { min-height: 210px; box-sizing: border-box; padding: 14px 21px 82px; background: #eeeeee; }
        .service-reference .advice-title { margin: 0 0 17px; color: #4b4b4b; font-size: 20px; font-weight: 700; line-height: 24px; }
        .service-reference .advice-copy { margin: 0 0 8px; color: #5a5a5a; font-size: 18px; font-weight: 400; line-height: 29px; }
        @media (max-width: 370px) {
          .service-reference .service-logo { top: 20px; left: 24%; width: 58px; height: 44px; }
          .service-reference .service-title { left: 46%; font-size: 18px; }
          .service-reference .benefits { padding-right: 0; padding-left: 0; }
          .service-reference .telegram-section { padding-right: 14px; padding-left: 14px; }
          .service-reference .telegram-grid { grid-template-columns: minmax(0, 42.13%) minmax(0, 1fr); column-gap: 12px; }
          .service-reference .bike-image { width: 100%; height: auto; aspect-ratio: 606 / 506; }
          .service-reference .telegram-link { padding-right: 28px; font-size: 17px; line-height: 23px; }
          .service-reference .telegram-link svg { right: 4px; width: 20px; }
          .service-reference .online-hours { font-size: clamp(21px, 6.7vw, 24px); line-height: 1.45; }
          .service-reference .advice-copy { font-size: 16px; }
        }
      `}</style>

      <div className="service-screen">
        <header className="service-header">
          <Link href="/account">
            <button className="service-back" data-testid="button-back" aria-label="Back">
              <ChevronLeft aria-hidden="true" />
            </button>
          </Link>
          <img className="service-logo" src={teldLogo} alt="Logo TELD (Tcharging)" />
          <h1 className="service-title">Customer service</h1>
        </header>

        <section className="benefits" aria-label="Our benefits">
          <img className="benefit-banner" src={tonMachinesBanner} alt="TELD (Tcharging) charging station" />
        </section>

        <section className="telegram-section" aria-labelledby="telegram-heading">
          <h2 id="telegram-heading" className="telegram-title">Telegram</h2>
          <div className="telegram-grid">
            <img className="bike-image" src={serviceImage} alt="TELD (Tcharging) connected stations" />
            <div className="telegram-actions">
              {telegramLinks.map((link) => (
                <button key={link.testId} type="button" className={`telegram-link ${link.size}`} onClick={() => window.open(link.href, "_blank")} data-testid={link.testId}>
                  {link.label}
                  <ChevronRight aria-hidden="true" />
                </button>
              ))}
              <div className="online-hours">
                <p>Online hours:</p>
                <p>9:00 AM-7:00 PM</p>
              </div>
            </div>
          </div>
        </section>

        <section className="advice" aria-label="Tips">
          <h2 className="advice-title">TIPS:</h2>
          <p className="advice-copy">1. If you have any questions, please contact our online customer service. We will be happy to help.</p>
          <p className="advice-copy">2. Keep your password safe and never share it with anyone.</p>
        </section>
      </div>
    </main>
  );
}