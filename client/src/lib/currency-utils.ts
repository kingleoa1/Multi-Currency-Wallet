/**
 * Format currency value with appropriate decimal places
 */
export function formatCurrency(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    case "CAD":
      return "C$";
    case "AUD":
      return "A$";
    case "CHF":
      return "Fr";
    default:
      return "$";
  }
}

/**
 * Get full currency name for a given currency code
 */
export function getCurrencyFullName(currencyCode: string): string {
  switch (currencyCode) {
    case "USD":
      return "US Dollar";
    case "EUR":
      return "Euro";
    case "GBP":
      return "British Pound";
    case "JPY":
      return "Japanese Yen";
    case "CAD":
      return "Canadian Dollar";
    case "AUD":
      return "Australian Dollar";
    case "CHF":
      return "Swiss Franc";
    default:
      return currencyCode;
  }
}

/**
 * Available currencies in the app
 */
export const availableCurrencies = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
];

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number, 
  fromCurrency: string, 
  toCurrency: string, 
  rates: Record<string, Record<string, number>>
): number {
  if (!rates || !rates[fromCurrency] || !rates[fromCurrency][toCurrency]) {
    return 0;
  }
  
  return amount * rates[fromCurrency][toCurrency];
}
