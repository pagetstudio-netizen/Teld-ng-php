import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-full" style={{ background: "#111" }}>

      {/* Header */}
      <header className="flex items-center px-4 py-3" style={{ background: "#111", borderBottom: "1px solid #222" }}>
        <Link href="/account">
          <button className="p-1" data-testid="button-back">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold text-white pr-6">About us</h1>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ color: "#d4d4d4", fontSize: 13.5, lineHeight: "1.75" }}>

        <p>
          TELD (Tcharging) is a leading company with one of the country's largest networks of connected charging stations.
        </p>

        <p>
          TELD (Tcharging) develops connected charging solutions for individuals and businesses.
        </p>

        <p>
          Our solutions adapt to indoor and outdoor spaces, including floors, walls, terraces, bathrooms, and living areas.
        </p>

        <p>
          Network availability, ease of use, and user satisfaction are at the heart of TELD (Tcharging)'s commitment.
        </p>

      </div>
    </div>
  );
}
