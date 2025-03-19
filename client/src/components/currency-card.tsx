import { Link } from "wouter";
import type { Wallet } from "@shared/schema";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency-utils";
import { formatDistanceToNow } from "date-fns";

interface CurrencyCardProps {
  wallet: Wallet;
}

export default function CurrencyCard({ wallet }: CurrencyCardProps) {
  // Define card color based on currency
  const getCardClass = () => {
    switch (wallet.currency) {
      case "USD":
        return "bg-gradient-to-br from-blue-600 to-blue-800";
      case "EUR":
        return "bg-gradient-to-br from-teal-600 to-teal-800";
      case "GBP":
        return "bg-gradient-to-br from-indigo-600 to-indigo-800";
      default:
        return "bg-gradient-to-br from-gray-700 to-gray-900";
    }
  };

  const getCurrencyFullName = () => {
    switch (wallet.currency) {
      case "USD": return "US Dollar";
      case "EUR": return "Euro";
      case "GBP": return "British Pound";
      case "JPY": return "Japanese Yen";
      case "CAD": return "Canadian Dollar";
      case "AUD": return "Australian Dollar";
      case "CHF": return "Swiss Franc";
      default: return wallet.currency;
    }
  };

  const currencySymbol = getCurrencySymbol(wallet.currency);

  return (
    <Link href={`/wallet/${wallet.id}`}>
      <div className={`${getCardClass()} rounded-lg shadow-lg p-5 text-white relative overflow-hidden cursor-pointer hover:shadow-xl transition-shadow`}>
        <div className="absolute top-0 right-0 p-2">
          <button className="text-white opacity-70 hover:opacity-100 focus:outline-none">
            <svg 
              className="h-5 w-5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center mb-4">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center mr-3">
            <span className="text-xl font-bold">{currencySymbol}</span>
          </div>
          <div>
            <h3 className="font-semibold text-lg">{getCurrencyFullName()}</h3>
            <p className="text-sm opacity-80">{wallet.name || (wallet.isPrimary ? "Primary" : "Secondary")}</p>
          </div>
        </div>
        <p className="text-2xl font-bold mb-1">
          {currencySymbol}{formatCurrency(Number(wallet.balance))}
        </p>
        <div className="flex justify-between items-center mt-4">
          <p className="text-xs opacity-80">
            Created {formatDistanceToNow(new Date(wallet.createdAt), { addSuffix: true })}
          </p>
          <div className="bg-white/20 hover:bg-white/30 text-white text-sm py-1 px-3 rounded-full">
            Details
          </div>
        </div>
      </div>
    </Link>
  );
}
