import { MerchantItem } from "@/lib/types";

export const demoInventory: MerchantItem[] = [
  {
    id: "coworking-pass",
    title: "Coworking Day Pass",
    category: "coworking",
    description: "Tomorrow at 10:00 AM. Quiet floor, Wi-Fi, coffee included.",
    inventory: 3,
    priceLabel: "$22",
    protected: true
  },
  {
    id: "event-ticket",
    title: "Launch Event Ticket",
    category: "event",
    description: "One limited ticket for tomorrow night’s founder mixer.",
    inventory: 3,
    priceLabel: "$18",
    protected: true
  },
  {
    id: "coffee-subscription",
    title: "Coffee Subscription",
    category: "product",
    description: "Discounted first month for a single subscriber.",
    inventory: 3,
    priceLabel: "$12",
    protected: true
  }
];
