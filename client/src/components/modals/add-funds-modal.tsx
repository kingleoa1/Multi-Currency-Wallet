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

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
}

const formSchema = z.object({
  walletId: z.string().min(1, "Wallet is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    {
      message: "Amount must be greater than 0",
    }
  ),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddFundsModal({ isOpen, onClose, wallets }: AddFundsModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      walletId: "",
      amount: "",
    },
  });

  const walletId = form.watch("walletId");
  const selectedWallet = wallets.find(w => w.id.toString() === walletId);

  // Group wallets by currency
  const walletsByCurrency = wallets.reduce<Record<string, Wallet[]>>((acc, wallet) => {
    if (!acc[wallet.currency]) {
      acc[wallet.currency] = [];
    }
    acc[wallet.currency].push(wallet);
    return acc;
  }, {});

  const addFundsMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const response = await apiRequest("POST", "/api/deposits", {
        walletId: parseInt(data.walletId),
        amount: parseFloat(data.amount),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      toast({
        title: "Funds added",
        description: "Funds have been added to your wallet successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to add funds",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSubmitting(false);
    }
  });

  const onSubmit = (data: FormValues) => {
    setSubmitting(true);
    addFundsMutation.mutate(data);
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
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>
            Add funds to your wallet
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="walletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Wallet</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-500 sm:text-sm">
                        {selectedWallet ? getCurrencySymbol(selectedWallet.currency) : "$"}
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
                        {selectedWallet ? selectedWallet.currency : "USD"}
                      </span>
                    </div>
                  </div>
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
                disabled={submitting || !walletId}
              >
                {submitting ? "Processing..." : "Add Funds"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
