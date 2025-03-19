import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TransactionItem from "@/components/transaction-item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Transaction } from "@shared/schema";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency-utils";

interface WalletDetailsResponse {
  wallet: Wallet;
  transactions: Transaction[];
}

export default function WalletDetails() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<WalletDetailsResponse>({
    queryKey: [`/api/wallets/${id}`],
  });

  useEffect(() => {
    if (error) {
      navigate("/");
    }
  }, [error, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="sm" className="mr-4" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Skeleton className="h-8 w-32" />
          </div>
          
          <Card>
            <CardHeader>
              <Skeleton className="h-10 w-40 mb-2" />
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full mb-4" />
              <Skeleton className="h-80 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data?.wallet) {
    return null;
  }

  const { wallet, transactions } = data;
  const currencySymbol = getCurrencySymbol(wallet.currency);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="sm" className="mr-4" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">Wallet Details</h1>
        </div>
        
        <Card className="mb-8">
          <CardHeader className="pb-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">{wallet.name || wallet.currency}</CardTitle>
                <p className="text-sm text-slate-500">{wallet.isPrimary ? 'Primary' : 'Secondary'}</p>
              </div>
              
              <div className="text-right">
                <p className="text-3xl font-bold">
                  {currencySymbol}{formatCurrency(Number(wallet.balance))}
                </p>
                <p className="text-sm text-slate-500">{wallet.currency}</p>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Deposit
              </Button>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                Withdraw
              </Button>
            </div>
            
            <Tabs defaultValue="transactions">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="transactions" className="flex-1">Transactions</TabsTrigger>
                <TabsTrigger value="analytics" className="flex-1">Analytics</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="transactions" className="mt-0">
                <div className="bg-white rounded-md overflow-hidden">
                  <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
                    <h3 className="font-medium text-slate-700">Recent Transactions</h3>
                  </div>
                  
                  {transactions && transactions.length > 0 ? (
                    <ul className="divide-y divide-slate-200">
                      {transactions.map(transaction => (
                        <TransactionItem key={transaction.id} transaction={transaction} />
                      ))}
                    </ul>
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-slate-500">No transactions for this wallet yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="analytics">
                <div className="bg-white rounded-md p-6 text-center">
                  <p className="text-slate-500">Analytics feature coming soon</p>
                </div>
              </TabsContent>
              
              <TabsContent value="settings">
                <div className="bg-white rounded-md p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-slate-900 mb-1">Wallet Name</h3>
                      <div className="flex">
                        <input 
                          type="text" 
                          className="flex-1 rounded-l-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                          defaultValue={wallet.name || wallet.currency}
                        />
                        <Button className="rounded-l-none">Save</Button>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-slate-900 mb-2">Danger Zone</h3>
                      <Button variant="destructive" size="sm">Delete Wallet</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
