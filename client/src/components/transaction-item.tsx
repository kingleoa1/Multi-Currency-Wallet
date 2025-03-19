import { useMemo } from "react";
import type { Transaction } from "@shared/schema";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency-utils";
import { format } from "date-fns";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  RefreshCw, 
  CreditCard, 
  PlusCircle
} from "lucide-react";

interface TransactionItemProps {
  transaction: Transaction;
}

export default function TransactionItem({ transaction }: TransactionItemProps) {
  const {
    type,
    amount,
    fromCurrency,
    toCurrency,
    status,
    createdAt,
    description
  } = transaction;

  const renderIcon = useMemo(() => {
    switch (type) {
      case 'deposit':
        return (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
            <PlusCircle className="h-5 w-5" />
          </div>
        );
      case 'withdrawal':
        return (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <ArrowUpCircle className="h-5 w-5" />
          </div>
        );
      case 'transfer':
        return (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
            <ArrowDownCircle className="h-5 w-5" />
          </div>
        );
      case 'conversion':
        return (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <RefreshCw className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <CreditCard className="h-5 w-5" />
          </div>
        );
    }
  }, [type]);

  const renderAmount = useMemo(() => {
    const fromSymbol = fromCurrency ? getCurrencySymbol(fromCurrency) : '';
    const toSymbol = toCurrency ? getCurrencySymbol(toCurrency) : '';

    switch (type) {
      case 'deposit':
        return (
          <span className="text-sm font-semibold text-success-500">
            +{toSymbol}{formatCurrency(Number(amount))}
          </span>
        );
      case 'withdrawal':
        return (
          <span className="text-sm font-semibold text-danger-500">
            -{fromSymbol}{formatCurrency(Number(amount))}
          </span>
        );
      case 'transfer':
        return (
          <span className="text-sm font-semibold text-slate-700">
            {fromSymbol}{formatCurrency(Number(amount))}
          </span>
        );
      case 'conversion':
        if (fromCurrency && toCurrency) {
          const rate = transaction.rate || 1;
          const convertedAmount = Number(amount) * Number(rate);
          return (
            <span className="text-sm font-semibold text-slate-700">
              {fromSymbol}{formatCurrency(Number(amount))} → {toSymbol}{formatCurrency(convertedAmount)}
            </span>
          );
        }
        return (
          <span className="text-sm font-semibold text-slate-700">
            {formatCurrency(Number(amount))}
          </span>
        );
      default:
        return (
          <span className="text-sm font-semibold text-slate-700">
            {formatCurrency(Number(amount))}
          </span>
        );
    }
  }, [type, amount, fromCurrency, toCurrency, transaction.rate]);

  const getDescription = () => {
    if (description) return description;
    
    switch (type) {
      case 'deposit':
        return 'Added funds to wallet';
      case 'withdrawal':
        return 'Withdrawn from wallet';
      case 'transfer':
        return 'Transfer between wallets';
      case 'conversion':
        return `Converted ${fromCurrency} to ${toCurrency}`;
      default:
        return 'Transaction';
    }
  };

  return (
    <li className="px-6 py-4 flex items-center">
      {renderIcon}
      <div className="ml-4 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">{getDescription()}</p>
          <div className="flex items-center">
            {renderAmount}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-slate-500">
            {format(new Date(createdAt), "MMM d, yyyy - h:mm a")}
          </p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            status === 'completed' 
              ? 'bg-success-100 text-success-800' 
              : status === 'pending'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-800'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>
    </li>
  );
}
