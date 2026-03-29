export type WalletState = {
  address: string | null;
  chainId: string | null;
  label: string;
  source: "coinbase" | "demo" | "none";
  isConnected: boolean;
};

type Eip1193Provider = {
  isCoinbaseWallet?: boolean;
  providers?: Eip1193Provider[];
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getDefaultWalletState(): WalletState {
  return {
    address: null,
    chainId: null,
    label: "Coinbase Wallet",
    source: "none",
    isConnected: false
  };
}

export function isFakeCoinbaseWalletEnabled() {
  return process.env.NEXT_PUBLIC_HUMANVOICE_FAKE_COINBASE === "true";
}

export function getDemoCoinbaseWallet(): WalletState {
  return {
    address: "0xC0inbASeD3m01234567890abcdef1234567890",
    chainId: "0x2105",
    label: "Coinbase Wallet",
    source: "demo",
    isConnected: true
  };
}

export function getServerWalletAddress() {
  return "Not connected";
}

export function getCoinbaseInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const provider = window.ethereum;
  if (provider.isCoinbaseWallet) {
    return provider;
  }

  return provider.providers?.find((entry) => entry.isCoinbaseWallet) ?? null;
}

export function formatWalletAddress(address: string | null) {
  if (!address) {
    return "Not connected";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function connectCoinbaseWallet(): Promise<WalletState> {
  if (isFakeCoinbaseWalletEnabled()) {
    return getDemoCoinbaseWallet();
  }

  const provider = getCoinbaseInjectedProvider();
  if (!provider) {
    throw new Error("Coinbase Wallet was not detected. Install the extension or open this app inside Coinbase Wallet.");
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
    params: []
  })) as string[];

  const chainId = (await provider.request({
    method: "eth_chainId"
  })) as string;

  return {
    address: accounts[0] ?? null,
    chainId,
    label: "Coinbase Wallet",
    source: "coinbase",
    isConnected: Boolean(accounts[0])
  };
}
