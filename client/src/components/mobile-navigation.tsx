import { Home, Wallet, RefreshCw, History, User } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function MobileNavigation() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around">
          <Link href="/">
            <a className={`group flex flex-col items-center py-3 px-3 ${
              location === "/" ? 
                "text-primary-600 border-t-2 border-primary-600" : 
                "text-slate-500 hover:text-slate-700 border-t-2 border-transparent"
            }`}>
              <Home className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">Home</span>
            </a>
          </Link>
          
          <Link href="/wallets">
            <a className={`group flex flex-col items-center py-3 px-3 ${
              location.startsWith("/wallet") ? 
                "text-primary-600 border-t-2 border-primary-600" : 
                "text-slate-500 hover:text-slate-700 border-t-2 border-transparent"
            }`}>
              <Wallet className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">Wallets</span>
            </a>
          </Link>
          
          <Link href="/transfer">
            <a className={`group flex flex-col items-center py-3 px-3 ${
              location === "/transfer" ? 
                "text-primary-600 border-t-2 border-primary-600" : 
                "text-slate-500 hover:text-slate-700 border-t-2 border-transparent"
            }`}>
              <RefreshCw className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">Transfer</span>
            </a>
          </Link>
          
          <Link href="/history">
            <a className={`group flex flex-col items-center py-3 px-3 ${
              location === "/history" ? 
                "text-primary-600 border-t-2 border-primary-600" : 
                "text-slate-500 hover:text-slate-700 border-t-2 border-transparent"
            }`}>
              <History className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">History</span>
            </a>
          </Link>
          
          <Link href="/profile">
            <a className={`group flex flex-col items-center py-3 px-3 ${
              location === "/profile" ? 
                "text-primary-600 border-t-2 border-primary-600" : 
                "text-slate-500 hover:text-slate-700 border-t-2 border-transparent"
            }`}>
              <User className="h-5 w-5" />
              <span className="text-xs font-medium mt-1">Profile</span>
            </a>
          </Link>
        </div>
      </div>
    </nav>
  );
}
