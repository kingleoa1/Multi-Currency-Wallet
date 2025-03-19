import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "@shared/schema";
import { formatCurrency } from "@/lib/currency-utils";

interface CurrencyConverterProps {
  wallets: Wallet[];
}

interface ExchangeRateData {
  rates: Record<string, Record<string, number>>;
  timestamp: string;
}

export default function CurrencyConverter({ wallets }: CurrencyConverterProps) {
  const [fromAmount, setFromAmount] = useState<number>(100);
  const [toAmount, setToAmount] = useState<number | null>(null);
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("EUR");
  const [fromWalletId, setFromWalletId] = useState<number | null>(null);
  const [toWalletId, setToWalletId] = useState<number | null>(null);
  
  const { toast } = useToast();
  
  // Fetch exchange rates
  const { data: ratesData } = useQuery<ExchangeRateData>({
    queryKey: ['/api/rates'],
  });

  // Filter wallets by currency
  const fromWallets = wallets.filter(wallet => wallet.currency === fromCurrency);
  const toWallets = wallets.filter(wallet => wallet.currency === toCurrency);

  // Get current exchange rate
  const currentRate = ratesData?.rates?.[fromCurrency]?.[toCurrency] || 0;

  // Update "to" amount when from amount or currencies change
  useEffect(() => {
    if (currentRate && fromAmount) {
      setToAmount(fromAmount * currentRate);
    } else {
      setToAmount(null);
    }
  }, [fromAmount, currentRate]);

  // Set default wallet IDs when wallets or currencies change
  useEffect(() => {
    if (fromWallets.length > 0 && !fromWalletId) {
      setFromWalletId(fromWallets[0].id);
    }
    
    if (toWallets.length > 0 && !toWalletId) {
      setToWalletId(toWallets[0].id);
    }
    
    // Reset wallet IDs if the selected currency has no wallets
    if (fromWallets.length === 0) {
      setFromWalletId(null);
    }
    
    if (toWallets.length === 0) {
      setToWalletId(null);
    }
  }, [fromWallets, toWallets, fromCurrency, toCurrency, fromWalletId, toWalletId]);

  // Handle conversion mutation
  const conversionMutation = useMutation({
    mutationFn: async () => {
      if (!fromWalletId || !toWalletId || !fromAmount) {
        throw new Error("Missing required fields");
      }
      
      const response = await apiRequest("POST", "/api/conversions", {
        fromWalletId,
        toWalletId,
        amount: fromAmount
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: "Conversion successful",
        description: `Successfully converted ${fromAmount} ${fromCurrency} to ${toAmount?.toFixed(2)} ${toCurrency}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "An error occurred during the conversion",
        variant: "destructive",
      });
    }
  });

  const handleConversion = () => {
    // Check if user has required wallets
    if (fromWallets.length === 0) {
      return toast({
        title: "No source wallet",
        description: `Please create a ${fromCurrency} wallet first`,
        variant: "destructive",
      });
    }
    
    if (toWallets.length === 0) {
      return toast({
        title: "No destination wallet",
        description: `Please create a ${toCurrency} wallet first`,
        variant: "destructive",
      });
    }
    
    // Check for sufficient funds
    const sourceWallet = wallets.find(w => w.id === fromWalletId);
    if (sourceWallet && Number(sourceWallet.balance) < fromAmount) {
      return toast({
        title: "Insufficient funds",
        description: `Your ${fromCurrency} wallet has insufficient funds`,
        variant: "destructive",
      });
    }
    
    conversionMutation.mutate();
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Currency Converter</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="from-amount" className="block text-sm font-medium text-slate-700 mb-1">From</label>
              <div className="flex">
                <Input
                  id="from-amount"
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(parseFloat(e.target.value) || 0)}
                  className="flex-1 rounded-r-none"
                  placeholder="0.00"
                />
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger className="w-24 rounded-l-none">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    {/* Add more currencies as needed */}
                  </SelectContent>
                </Select>
              </div>
              
              {fromWallets.length > 0 && (
                <div className="mt-2">
                  <label htmlFor="from-wallet" className="block text-xs font-medium text-slate-500 mb-1">Source Wallet</label>
                  <Select value={fromWalletId?.toString() || ""} onValueChange={(value) => setFromWalletId(parseInt(value))}>
                    <SelectTrigger className="w-full border-dashed">
                      <SelectValue placeholder="Select wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {fromWallets.map(wallet => (
                        <SelectItem key={wallet.id} value={wallet.id.toString()}>
                          {wallet.name || wallet.currency} ({formatCurrency(Number(wallet.balance))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div>
              <label htmlFor="to-amount" className="block text-sm font-medium text-slate-700 mb-1">To</label>
              <div className="flex">
                <Input
                  id="to-amount"
                  type="number"
                  value={toAmount === null ? "" : toAmount}
                  readOnly
                  className="flex-1 rounded-r-none bg-slate-50"
                  placeholder="0.00"
                />
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger className="w-24 rounded-l-none">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    {/* Add more currencies as needed */}
                  </SelectContent>
                </Select>
              </div>
              
              {toWallets.length > 0 && (
                <div className="mt-2">
                  <label htmlFor="to-wallet" className="block text-xs font-medium text-slate-500 mb-1">Destination Wallet</label>
                  <Select value={toWalletId?.toString() || ""} onValueChange={(value) => setToWalletId(parseInt(value))}>
                    <SelectTrigger className="w-full border-dashed">
                      <SelectValue placeholder="Select wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {toWallets.map(wallet => (
                        <SelectItem key={wallet.id} value={wallet.id.toString()}>
                          {wallet.name || wallet.currency} ({formatCurrency(Number(wallet.balance))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-500">
              <span className="font-medium">
                1 {fromCurrency} = {currentRate?.toFixed(3) || "..."} {toCurrency}
              </span>
              <span className="ml-1 text-xs">
                Last updated: {ratesData?.timestamp ? new Date(ratesData.timestamp).toLocaleString() : "Loading..."}
              </span>
            </p>
            <Button 
              onClick={handleConversion}
              disabled={conversionMutation.isPending || !fromWalletId || !toWalletId}
            >
              {conversionMutation.isPending ? "Converting..." : "Convert"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
