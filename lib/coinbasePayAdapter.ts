import { demoInventory } from "@/lib/demoInventory";

export function getCoinbasePaymentLabel(itemId: string | null) {
  const item = demoInventory.find((entry) => entry.id === itemId);
  if (!item) {
    return "Complete Coinbase Pay";
  }

  return `Complete Coinbase Pay for ${item.title} (${item.priceLabel})`;
}
