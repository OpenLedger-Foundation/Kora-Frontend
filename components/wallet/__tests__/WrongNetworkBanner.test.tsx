import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { WrongNetworkBanner } from "../WrongNetworkBanner";
import { useWallet } from "@/hooks/useWallet";
import { useWalletStore } from "@/store";
import * as envModule from "@/lib/env";

// Mock the hooks and modules
vi.mock("@/hooks/useWallet");
vi.mock("@/store");
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    NEXT_PUBLIC_INVOICE_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_MARKETPLACE_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    NEXT_PUBLIC_IPFS_GATEWAY: "https://gateway.pinata.cloud/ipfs",
  },
}));

describe("WrongNetworkBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when wallet is disconnected", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: false,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => false,
      network: "testnet",
    } as any);

    const { container } = render(<WrongNetworkBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should not render when network is correct", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => false,
      network: "testnet",
    } as any);

    const { container } = render(<WrongNetworkBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should render when connected to wrong network enum", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
      network: "mainnet",
    } as any);

    render(<WrongNetworkBanner />);
    expect(screen.getByText(/Wrong Network/)).toBeInTheDocument();
    expect(screen.getByText("Wrong Network:", { exact: false })).toHaveTextContent(/Connected to.*Mainnet/);
  });

  it("should render when passphrase mismatches", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => true,
      network: "testnet",
    } as any);

    render(<WrongNetworkBanner />);
    expect(screen.getByText(/Wrong Network/)).toBeInTheDocument();
    expect(screen.getByText(/passphrase mismatch/)).toBeInTheDocument();
  });

  it("should show dismissible banner with close button", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
      network: "mainnet",
    } as any);

    render(<WrongNetworkBanner />);
    const closeButton = screen.getByRole("button", {
      name: /Dismiss wrong network warning/,
    });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(screen.queryByText(/Wrong Network/)).not.toBeInTheDocument();
  });

  it("should re-appear when banner is dismissed and component re-mounts", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
      network: "mainnet",
    } as any);

    const { rerender } = render(<WrongNetworkBanner />);
    
    // Dismiss the banner
    const closeButton = screen.getByRole("button", {
      name: /Dismiss wrong network warning/,
    });
    fireEvent.click(closeButton);
    expect(screen.queryByText(/Wrong Network/)).not.toBeInTheDocument();

    // Re-render (simulate navigation away and back by unmounting and mounting again)
    cleanup();
    render(<WrongNetworkBanner />);
    expect(screen.getByText(/Wrong Network/)).toBeInTheDocument();
  });

  it("should display correct network names", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
      network: "mainnet",
    } as any);

    render(<WrongNetworkBanner />);
    const banner = screen.getByText("Wrong Network:", { exact: false });
    expect(banner).toHaveTextContent(/Connected to.*Mainnet/);
    expect(banner).toHaveTextContent(/Testnet/);
  });

  it("should show passphrase mismatch in banner text", () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => true,
      network: "testnet",
    } as any);

    render(<WrongNetworkBanner />);
    expect(screen.getByText(/passphrase mismatch/)).toBeInTheDocument();
    expect(screen.getByText(/Please switch your wallet network to continue/)).toBeInTheDocument();
  });

  it("should handle testnet->mainnet scenario", () => {
    // Simulate testnet wallet connected to mainnet app
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => true,
      network: "testnet",
    } as any);

    render(<WrongNetworkBanner />);
    const banner = screen.getByText("Wrong Network:", { exact: false });
    expect(banner).toHaveTextContent(/Connected to.*Testnet/);
    expect(banner).toHaveTextContent(/passphrase mismatch/);
  });

  it("should handle mainnet->testnet scenario", () => {
    // Simulate mainnet wallet connected to testnet app
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
    } as any);
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => true,
      network: "mainnet",
    } as any);

    render(<WrongNetworkBanner />);
    const banner = screen.getByText("Wrong Network:", { exact: false });
    expect(banner).toHaveTextContent(/Connected to.*Mainnet/);
    expect(banner).toHaveTextContent(/Testnet/);
    expect(banner).toHaveTextContent(/passphrase mismatch/);
  });
});
