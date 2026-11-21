"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ReloadButton } from "./ReloadButton";
import { StaleDataBadge } from "@/components/layout/StaleDataBadge";
import { PendingTxQueuePanel } from "@/components/pwa/PendingTxQueuePanel";
import { getLatestMarketplaceDataUpdatedAt } from "@/lib/queryPersistence";

export default function OfflinePage() {
  const t = useTranslations("offline");
  const queryClient = useQueryClient();
  const cachedAt = getLatestMarketplaceDataUpdatedAt(queryClient);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      {/* Icon */}
      <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
        {t("title")}
      </h1>

      <p className="mt-4 max-w-md text-base text-zinc-400">{t("subtitle")}</p>

      <div className="mt-8 w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("availableOffline")}
        </p>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("cachedListings")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {t("cachedAssets")}
          </li>
        </ul>
        <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("requiresConnection")}
        </p>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("walletSigning")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("invoiceCreation")}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            {t("liveData")}
          </li>
        </ul>
      </div>

      {/* Pending signed-XDR queue — visible online and offline */}
      <div className="mt-8 w-full max-w-sm text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {t("pendingQueueTitle")}
        </p>
        <p className="mb-4 text-xs text-zinc-500">{t("pendingQueueDesc")}</p>
        <PendingTxQueuePanel />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ReloadButton />
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
        >
          {t("browseCached")}
        </Link>
      </div>

      {/* Show last-synced timestamp if marketplace data is in the cache */}
      {cachedAt ? (
        <div className="mt-4">
          <StaleDataBadge updatedAt={cachedAt} />
        </div>
      ) : null}
    </div>
  );
}

Kora-Frontend
Repository navigation
Code
Issues
137
 (137)
Issue done- #1275
#1275
Open
Georgebingi
wants to merge 1 commit into
OpenLedger-Foundation:main
from
Georgebingi:main
Conversation1 (1)
Commits1 (1)
Checks0 (0)
Files changed1 (1)
Pull request toolbar
Issue done
Georgebingi
Georgebingi
authored
3 minutes ago
Verified
commit
012613e
‎app/marketplace/loading.tsx‎
Original file line number	Diff line number	Diff line change
    </div>
  );
}
import React from "react";
export interface AppLoadingShellProps {
  isLoading: boolean;
  children?: React.ReactNode;
  showWalletSkeleton?: boolean;
  walletCount?: number;
  className?: string;
  label?: string;
}
const DEFAULT_WALLET_COUNT = 2;
export function AppLoadingShell({
  isLoading,
  children,
  showWalletSkeleton = true,
  walletCount = DEFAULT_WALLET_COUNT,
  className = "",
  label = "Loading application",
}: AppLoadingShellProps) {
  if (!isLoading) {
    return <>{children}</>;
  }
  const safeWalletCount = Math.max(
    1,
    Math.min(walletCount, 4)
  );
  return (
    <main
      className={`app-loading-shell ${className}`}
      aria-label={label}
      aria-busy="true"
    >
      <header className="loading-header">
        <div
          className="skeleton skeleton-logo"
          aria-hidden="true"
        />
        <div className="loading-header-actions">
          <div
            className="skeleton skeleton-action"
            aria-hidden="true"
          />
          <div
            className="skeleton skeleton-avatar"
            aria-hidden="true"
          />
        </div>
      </header>
      <section className="loading-content">
        <div className="loading-title-group">
          <div
            className="skeleton skeleton-title"
            aria-hidden="true"
          />
          <div
            className="skeleton skeleton-subtitle"
            aria-hidden="true"
          />
        </div>
        {showWalletSkeleton && (
          <section
            className="wallet-loading-grid"
            aria-label="Wallet loading placeholders"
          >
            {Array.from(
              { length: safeWalletCount },
              (_, index) => (
                <WalletSkeleton
                  key={index}
                />
              )
            )}
          </section>
        )}
        <section
          className="loading-dashboard"
          aria-hidden="true"
        >
          <div className="skeleton skeleton-panel" />
          <div className="loading-dashboard-grid">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        </section>
        <span
          className="visually-hidden"
          role="status"
        >
          {label}
        </span>
      </section>
    </main>
  );
}
export function WalletSkeleton() {
  return (
    <article className="wallet-skeleton">
      <div className="wallet-skeleton-header">
        <div
          className="skeleton skeleton-wallet-icon"
        />
        <div className="wallet-skeleton-heading">
          <div className="skeleton skeleton-wallet-name" />
          <div className="skeleton skeleton-wallet-network" />
        </div>
      </div>
      <div className="skeleton skeleton-wallet-balance" />
      <div className="wallet-skeleton-footer">
        <div className="skeleton skeleton-wallet-button" />
        <div className="skeleton skeleton-wallet-button" />
      </div>
    </article>
  );
}
.app-loading-shell {
  width: 100%;
  min-height: 100vh;
  min-height: 100svh;
  box-sizing: border-box;
  padding: 24px;
  overflow-x: hidden;
}
.loading-header {
  width: 100%;
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}
.loading-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.loading-content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.loading-title-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}
.skeleton {
  position: relative;
  overflow: hidden;
  background: #e9ebef;
  border-radius: 8px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.55),
    transparent
  );
  animation: skeleton-shimmer 1.5s infinite;
}
.skeleton-logo {
  width: 150px;
  height: 36px;
}
.skeleton-action {
  width: 110px;
  height: 40px;
}
.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.skeleton-title {
  width: min(320px, 70%);
  height: 32px;
}
.skeleton-subtitle {
  width: min(220px, 55%);
  height: 16px;
}
.wallet-loading-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, 250px), 1fr)
  );
  gap: 20px;
  margin-bottom: 32px;
}
.wallet-skeleton {
  box-sizing: border-box;
  min-width: 0;
  min-height: 190px;
  height: 190px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.wallet-skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.wallet-skeleton-heading {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skeleton-wallet-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}
.skeleton-wallet-name {
  width: 130px;
  max-width: 100%;
  height: 15px;
}
.skeleton-wallet-network {
  width: 85px;
  height: 11px;
}
.skeleton-wallet-balance {
  width: 65%;
  height: 30px;
}
.wallet-skeleton-footer {
  display: flex;
  gap: 12px;
}
.skeleton-wallet-button {
  width: 50%;
  height: 36px;
}
.loading-dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.skeleton-panel {
  width: 100%;
  height: 220px;
  border-radius: 12px;
}
.loading-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.skeleton-card {
  width: 100%;
  height: 160px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (max-width: 768px) {
  .app-loading-shell {
    padding: 16px;
  }
  .loading-header {
    margin-bottom: 24px;
  }
  .wallet-loading-grid {
    grid-template-columns: 1fr;
  }
  .loading-dashboard-grid {
    grid-template-columns: 1fr;
  }
  .wallet-skeleton {
    min-height: 180px;
    height: 180px;
  }
  .skeleton-panel {
    height: 180px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .skeleton::after {
    animation: none;
  }
}
import React from "react";
interface WalletBootstrapContainerProps {
  isBootstrapping: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
export function WalletBootstrapContainer({
  isBootstrapping,
  children,
  fallback,
}: WalletBootstrapContainerProps) {
  return (
    <section
      className="wallet-bootstrap-container"
      aria-busy={isBootstrapping}
      data-bootstrap-state={
        isBootstrapping ? "loading" : "ready"
      }
    >
      {isBootstrapping ? (
        fallback ?? <WalletBootstrapFallback />
      ) : (
        children
      )}
    </section>
  );
}
function WalletBootstrapFallback() {
  return (
    <div className="wallet-bootstrap-fallback">
      <div className="skeleton skeleton-wallet-balance" />
      <div className="wallet-bootstrap-actions">
        <div className="skeleton skeleton-wallet-button" />
        <div className="skeleton skeleton-wallet-button" />
      </div>
    </div>
  );
}
import React from "react";
import {
  AppLoadingShell,
} from "./app-loading-shell";
import {
  WalletBootstrapContainer,
} from "./wallet-bootstrap-container";
interface AppProps {
  walletReady: boolean;
  isBootstrapping: boolean;
}
export default function App({
  walletReady,
  isBootstrapping,
}: AppProps) {
  const isLoading =
    isBootstrapping || !walletReady;
  return (
    <AppLoadingShell
      isLoading={isLoading}
      walletCount={2}
    >
      <main className="application-content">
        <header className="application-header">
          <h1>Dashboard</h1>
        </header>
        <WalletBootstrapContainer
          isBootstrapping={isBootstrapping}
        >
          <section className="wallet-dashboard">
            <h2>Connected Wallet</h2>
            <div className="wallet-balance">
              $0.00
            </div>
            <div className="wallet-actions">
              <button type="button">
                Deposit
              </button>
              <button type="button">
                Withdraw
              </button>
            </div>
          </section>
        </WalletBootstrapContainer>
      </main>
    </AppLoadingShell>
  );
}
import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  AppLoadingShell,
  WalletSkeleton,
} from "../components/app-loading-shell";
describe("AppLoadingShell", () => {
  test("renders loading shell while loading", () => {
    render(
      <AppLoadingShell isLoading={true} />
    );
    expect(
      screen.
      
Kora-Frontend
Repository navigation
Code
Issues
137
 (137)
Issue done- #1275
#1275
Open
Georgebingi
wants to merge 1 commit into
OpenLedger-Foundation:main
from
Georgebingi:main
Conversation1 (1)
Commits1 (1)
Checks0 (0)
Files changed1 (1)
Pull request toolbar
Issue done
Georgebingi
Georgebingi
authored
3 minutes ago
Verified
commit
012613e
‎app/marketplace/loading.tsx‎
Original file line number	Diff line number	Diff line change
    </div>
  );
}
import React from "react";
export interface AppLoadingShellProps {
  isLoading: boolean;
  children?: React.ReactNode;
  showWalletSkeleton?: boolean;
  walletCount?: number;
  className?: string;
  label?: string;
}
const DEFAULT_WALLET_COUNT = 2;
export function AppLoadingShell({
  isLoading,
  children,
  showWalletSkeleton = true,
  walletCount = DEFAULT_WALLET_COUNT,
  className = "",
  label = "Loading application",
}: AppLoadingShellProps) {
  if (!isLoading) {
    return <>{children}</>;
  }
  const safeWalletCount = Math.max(
    1,
    Math.min(walletCount, 4)
  );
  return (
    <main
      className={`app-loading-shell ${className}`}
      aria-label={label}
      aria-busy="true"
    >
      <header className="loading-header">
        <div
          className="skeleton skeleton-logo"
          aria-hidden="true"
        />
        <div className="loading-header-actions">
          <div
            className="skeleton skeleton-action"
            aria-hidden="true"
          />
          <div
            className="skeleton skeleton-avatar"
            aria-hidden="true"
          />
        </div>
      </header>
      <section className="loading-content">
        <div className="loading-title-group">
          <div
            className="skeleton skeleton-title"
            aria-hidden="true"
          />
          <div
            className="skeleton skeleton-subtitle"
            aria-hidden="true"
          />
        </div>
        {showWalletSkeleton && (
          <section
            className="wallet-loading-grid"
            aria-label="Wallet loading placeholders"
          >
            {Array.from(
              { length: safeWalletCount },
              (_, index) => (
                <WalletSkeleton
                  key={index}
                />
              )
            )}
          </section>
        )}
        <section
          className="loading-dashboard"
          aria-hidden="true"
        >
          <div className="skeleton skeleton-panel" />
          <div className="loading-dashboard-grid">
            <div className="skeleton skeleton-card" />
            <div className="skeleton skeleton-card" />
          </div>
        </section>
        <span
          className="visually-hidden"
          role="status"
        >
          {label}
        </span>
      </section>
    </main>
  );
}
export function WalletSkeleton() {
  return (
    <article className="wallet-skeleton">
      <div className="wallet-skeleton-header">
        <div
          className="skeleton skeleton-wallet-icon"
        />
        <div className="wallet-skeleton-heading">
          <div className="skeleton skeleton-wallet-name" />
          <div className="skeleton skeleton-wallet-network" />
        </div>
      </div>
      <div className="skeleton skeleton-wallet-balance" />
      <div className="wallet-skeleton-footer">
        <div className="skeleton skeleton-wallet-button" />
        <div className="skeleton skeleton-wallet-button" />
      </div>
    </article>
  );
}
.app-loading-shell {
  width: 100%;
  min-height: 100vh;
  min-height: 100svh;
  box-sizing: border-box;
  padding: 24px;
  overflow-x: hidden;
}
.loading-header {
  width: 100%;
  height: 64px;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}
.loading-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.loading-content {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}
.loading-title-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}
.skeleton {
  position: relative;
  overflow: hidden;
  background: #e9ebef;
  border-radius: 8px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.55),
    transparent
  );
  animation: skeleton-shimmer 1.5s infinite;
}
.skeleton-logo {
  width: 150px;
  height: 36px;
}
.skeleton-action {
  width: 110px;
  height: 40px;
}
.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.skeleton-title {
  width: min(320px, 70%);
  height: 32px;
}
.skeleton-subtitle {
  width: min(220px, 55%);
  height: 16px;
}
.wallet-loading-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, 250px), 1fr)
  );
  gap: 20px;
  margin-bottom: 32px;
}
.wallet-skeleton {
  box-sizing: border-box;
  min-width: 0;
  min-height: 190px;
  height: 190px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.wallet-skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.wallet-skeleton-heading {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skeleton-wallet-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}
.skeleton-wallet-name {
  width: 130px;
  max-width: 100%;
  height: 15px;
}
.skeleton-wallet-network {
  width: 85px;
  height: 11px;
}
.skeleton-wallet-balance {
  width: 65%;
  height: 30px;
}
.wallet-skeleton-footer {
  display: flex;
  gap: 12px;
}
.skeleton-wallet-button {
  width: 50%;
  height: 36px;
}
.loading-dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.skeleton-panel {
  width: 100%;
  height: 220px;
  border-radius: 12px;
}
.loading-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.skeleton-card {
  width: 100%;
  height: 160px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (max-width: 768px) {
  .app-loading-shell {
    padding: 16px;
  }
  .loading-header {
    margin-bottom: 24px;
  }
  .wallet-loading-grid {
    grid-template-columns: 1fr;
  }
  .loading-dashboard-grid {
    grid-template-columns: 1fr;
  }
  .wallet-skeleton {
    min-height: 180px;
    height: 180px;
  }
  .skeleton-panel {
    height: 180px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton,
  .skeleton::after {
    animation: none;
  }
}
import React from "react";
interface WalletBootstrapContainerProps {
  isBootstrapping: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
export function WalletBootstrapContainer({
  isBootstrapping,
  children,
  fallback,
}: WalletBootstrapContainerProps) {
  return (
    <section
      className="wallet-bootstrap-container"
      aria-busy={isBootstrapping}
      data-bootstrap-state={
        isBootstrapping ? "loading" : "ready"
      }
    >
      {isBootstrapping ? (
        fallback ?? <WalletBootstrapFallback />
      ) : (
        children
      )}
    </section>
  );
}
function WalletBootstrapFallback() {
  return (
    <div className="wallet-bootstrap-fallback">
      <div className="skeleton skeleton-wallet-balance" />
      <div className="wallet-bootstrap-actions">
        <div className="skeleton skeleton-wallet-button" />
        <div className="skeleton skeleton-wallet-button" />
      </div>
    </div>
  );
}
import React from "react";
import {
  AppLoadingShell,
} from "./app-loading-shell";
import {
  WalletBootstrapContainer,
} from "./wallet-bootstrap-container";
interface AppProps {
  walletReady: boolean;
  isBootstrapping: boolean;
}
export default function App({
  walletReady,
  isBootstrapping,
}: AppProps) {
  const isLoading =
    isBootstrapping || !walletReady;
  return (
    <AppLoadingShell
      isLoading={isLoading}
      walletCount={2}
    >
      <main className="application-content">
        <header className="application-header">
          <h1>Dashboard</h1>
        </header>
        <WalletBootstrapContainer
          isBootstrapping={isBootstrapping}
        >
          <section className="wallet-dashboard">
            <h2>Connected Wallet</h2>
            <div className="wallet-balance">
              $0.00
            </div>
            <div className="wallet-actions">
              <button type="button">
                Deposit
              </button>
              <button type="button">
                Withdraw
              </button>
            </div>
          </section>
        </WalletBootstrapContainer>
      </main>
    </AppLoadingShell>
  );
 {
