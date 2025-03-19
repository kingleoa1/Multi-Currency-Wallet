import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CurrencyCard from "@/components/currency-card";
import TransactionItem from "@/components/transaction-item";
import CurrencyConverter from "@/components/currency-converter";
import MobileNavigation from "@/components/mobile-navigation";
import AddWalletModal from "@/components/modals/add-wallet-modal";
import TransferModal from "@/components/modals/transfer-modal";
import AddFundsModal from "@/components/modals/add-funds-modal";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency-utils";
import { Wallet, Transaction } from "@shared/schema";

export default function Dashboard() {
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddFundsModalOpen, setIsAddFundsModalOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const { toast } = useToast();

  // Fetch user session
  const { data: sessionData } = useQuery({
    queryKey: ['/api/auth/session'],
  });

  // Fetch wallets
  const { data: wallets, isLoading: isLoadingWallets } = useQuery<Wallet[]>({
    queryKey: ['/api/wallets'],
  });

  // Fetch transactions
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  // Calculate total balance in USD
  const calculateTotalBalance = () => {
    if (!wallets) return "0.00";
    
    // For a real app, we would convert all balances to USD based on exchange rates
    // For simplicity, we'll just add up the balances directly
    const total = wallets.reduce((sum, wallet) => {
      // Add proper currency conversion here in a real app
      return sum + Number(wallet.balance);
    }, 0);
    
    return total.toFixed(2);
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      queryClient.clear();
      window.location.href = "/auth";
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "An error occurred while logging out",
        variant: "destructive",
      });
    }
  };

  const loadMoreTransactions = () => {
    toast({
      title: "Feature coming soon",
      description: "Loading more transactions will be available in a future update",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg 
              className="h-8 w-8 text-primary-600" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="6" x2="12" y2="12" />
              <path d="M8 12 L16 12" />
            </svg>
            <h1 className="text-lg font-bold text-slate-900">WiseGuyWallet</h1>
          </div>
          <div className="relative">
            <button 
              className="flex items-center text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
              <span className="sr-only">Open user menu</span>
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
                {sessionData?.user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="ml-2 hidden sm:block">
                {sessionData?.user?.name || "User"}
              </span>
              <svg className="ml-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showProfileDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 z-10">
                <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Your Profile</a>
                <a href="#" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">Settings</a>
                <button 
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Account Summary */}
        <section className="mb-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Account Summary</h2>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Balance (in USD)</p>
                  {isLoadingWallets ? (
                    <Skeleton className="h-10 w-32 mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">
                      ${calculateTotalBalance()}
                    </p>
                  )}
                </div>
                <div className="mt-4 sm:mt-0 flex space-x-3">
                  <Button 
                    onClick={() => setIsAddFundsModalOpen(true)}
                    className="inline-flex items-center"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Funds
                  </Button>
                  <Button 
                    onClick={() => setIsTransferModalOpen(true)}
                    variant="secondary"
                    className="inline-flex items-center"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Transfer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
        
        {/* Wallets */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">My Wallets</h2>
            <Button 
              onClick={() => setIsAddWalletModalOpen(true)}
              variant="outline" 
              className="inline-flex items-center text-primary-600 bg-primary-50 hover:bg-primary-100 border-primary-200"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Wallet
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingWallets ? (
              // Loading skeleton
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="rounded-lg shadow-lg p-5 bg-gray-100">
                  <Skeleton className="h-10 w-3/4 mb-4" />
                  <Skeleton className="h-8 w-1/2 mb-1" />
                  <Skeleton className="h-4 w-1/3 mt-4" />
                </div>
              ))
            ) : wallets && wallets.length > 0 ? (
              // Render wallets
              wallets.map(wallet => (
                <CurrencyCard key={wallet.id} wallet={wallet} />
              ))
            ) : (
              // No wallets state
              <div className="col-span-full text-center py-8">
                <p className="text-slate-500 mb-4">You don't have any wallets yet</p>
                <Button onClick={() => setIsAddWalletModalOpen(true)}>
                  Create your first wallet
                </Button>
              </div>
            )}
          </div>
        </section>
        
        {/* Currency Converter */}
        <section className="mb-8">
          <CurrencyConverter wallets={wallets || []} />
        </section>
        
        {/* Transaction History */}
        <section>
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-slate-900">Recent Transactions</h2>
              <Link href="/transactions" className="text-sm font-medium text-primary-600 hover:text-primary-500">
                View all
              </Link>
            </div>
            
            {isLoadingTransactions ? (
              // Loading skeleton
              <div className="divide-y divide-slate-200">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="px-6 py-4 flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="ml-4 flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              // Render transactions
              <ul className="divide-y divide-slate-200">
                {transactions.map(transaction => (
                  <TransactionItem key={transaction.id} transaction={transaction} />
                ))}
              </ul>
            ) : (
              // No transactions state
              <div className="py-8 text-center">
                <p className="text-slate-500">No transactions yet</p>
              </div>
            )}
            
            {transactions && transactions.length > 0 && (
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
                <Button 
                  onClick={loadMoreTransactions}
                  variant="outline" 
                  className="w-full"
                >
                  Load more
                </Button>
              </div>
            )}
          </Card>
        </section>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Modals */}
      <AddWalletModal 
        isOpen={isAddWalletModalOpen} 
        onClose={() => setIsAddWalletModalOpen(false)} 
      />
      
      <TransferModal 
        isOpen={isTransferModalOpen} 
        onClose={() => setIsTransferModalOpen(false)}
        wallets={wallets || []} 
      />
      
      <AddFundsModal 
        isOpen={isAddFundsModalOpen} 
        onClose={() => setIsAddFundsModalOpen(false)}
        wallets={wallets || []} 
      />
    </div>
  );
}
