import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wallet } from "@shared/schema";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency-utils";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
}

const formSchema = z.object({
  fromWalletId: z.string().min(1, "Source wallet is required"),
  toWalletId: z.string().min(1, "Destination wallet is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    {
      message: "Amount must be greater than 0",
    }
  ),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function TransferModal({ isOpen, onClose, wallets }: TransferModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromWalletId: "",
      toWalletId: "",
      amount: "",
      note: "",
    },
  });

  const fromWalletId = form.watch("fromWalletId");
  const fromWallet = wallets.find(w => w.id.toString() === fromWalletId);
  const toWalletId = form.watch("toWalletId");
  
  // Group wallets by currency
  const walletsByCurrency = wallets.reduce<Record<string, Wallet[]>>((acc, wallet) => {
    if (!acc[wallet.currency]) {
      acc[wallet.currency] = [];
    }
    acc[wallet.currency].push(wallet);
    return acc;
  }, {});

  // Only show target wallets with the same currency as the source wallet
  const filteredToWallets = fromWallet 
    ? wallets.filter(w => w.currency === fromWallet.currency && w.id !== fromWallet.id)
    : [];

  const transferMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/transfers", {
        fromWalletId: parseInt(data.fromWalletId),
        toWalletId: parseInt(data.toWalletId),
        amount: parseFloat(data.amount),
        description: data.note || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({
        title: "Transfer successful",
        description: "Funds have been transferred successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Transfer failed",
        description: error instanceof Error ? error.message : "An error occurred during transfer",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSubmitting(false);
    }
  });

  const onSubmit = (data: FormValues) => {
    if (data.fromWalletId === data.toWalletId) {
      toast({
        title: "Invalid transfer",
        description: "Source and destination wallets cannot be the same",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(data.amount);
    const fromWallet = wallets.find(w => w.id.toString() === data.fromWalletId);
    
    if (fromWallet && Number(fromWallet.balance) < amount) {
      toast({
        title: "Insufficient funds",
        description: `Your ${fromWallet.currency} wallet has insufficient funds`,
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    transferMutation.mutate(data);
  };

  const handleClose = () => {
    if (!submitting) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Transfer money between your wallets of the same currency
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fromWalletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source wallet" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(walletsByCurrency).map(([currency, currencyWallets]) => (
                        <div key={currency}>
                          <div className="px-2 py-1.5 text-xs font-medium text-slate-500">
                            {currency}
                          </div>
                          {currencyWallets.map(wallet => (
                            <SelectItem key={wallet.id} value={wallet.id.toString()}>
                              {wallet.name || `${currency} Wallet`} - {getCurrencySymbol(currency)}{formatCurrency(Number(wallet.balance))}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="toWalletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!fromWallet || filteredToWallets.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !fromWallet 
                            ? "Select source wallet first" 
                            : filteredToWallets.length === 0 
                              ? `No other ${fromWallet.currency} wallets` 
                              : "Select destination wallet"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredToWallets.map(wallet => (
                        <SelectItem key={wallet.id} value={wallet.id.toString()}>
                          {wallet.name || `${wallet.currency} Wallet`} - {getCurrencySymbol(wallet.currency)}{formatCurrency(Number(wallet.balance))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-500 sm:text-sm">
                        {fromWallet ? getCurrencySymbol(fromWallet.currency) : "$"}
                      </span>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        className="pl-7"
                        step="0.01"
                        min="0.01"
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-slate-500 sm:text-sm">
                        {fromWallet ? fromWallet.currency : "USD"}
                      </span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="What's this transfer for?"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  submitting || 
                  !fromWalletId || 
                  !toWalletId || 
                  fromWalletId === toWalletId ||
                  filteredToWallets.length === 0
                }
              >
                {submitting ? "Processing..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
