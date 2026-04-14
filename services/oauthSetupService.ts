/**
 * oauthSetupService.ts — OAuth Browser Login Flow Bridge
 *
 * Orchestrates the browser-based OAuth login process for each AI provider.
 * Communicates with the Electron main process (which runs a local HTTP callback
 * server and opens the browser) via IPC through desktopBridge.
 *
 * In browser-only mode, this service gracefully reports that OAuth is
 * unavailable and suggests using manual API keys instead.
 */

import { ProxyProvider, OAuthFlowStatus, ProxyAccount, ProxySettings } from '../types';
import desktopBridge from './desktopBridge';
import {
  loadProxySettings,
  saveProxySettings,
  invalidateSettingsCache,
  PROVIDER_DISPLAY_NAMES,
} from './nullProxyService';

/** Whether the app is running in Electron (full OAuth support). */
export const isElectronRuntime = (): boolean =>
  typeof window !== 'undefined' && !!window.electronAPI;

/**
 * Start an OAuth login flow for a given provider.
 *
 * This opens the provider's login page in the default browser.
 * A local HTTP server (managed by the Electron main process) listens
 * for the OAuth callback redirect and captures the auth code/token.
 *
 * @param provider - The AI provider to authenticate with
 * @param onStatus - Progress callback for UI updates
 * @returns The new ProxyAccount if successful, or null on failure
 */
export async function startOAuthFlow(
  provider: ProxyProvider,
  onStatus: (status: OAuthFlowStatus) => void
): Promise<ProxyAccount | null> {
  if (!isElectronRuntime()) {
    onStatus({
      provider,
      phase: 'error',
      message: 'OAuth login requires the Null Library desktop app.',
      error: 'Not running in Electron.',
    });
    return null;
  }

  onStatus({
    provider,
    phase: 'starting',
    message: `Opening ${PROVIDER_DISPLAY_NAMES[provider]} login page…`,
  });

  // Subscribe to status updates from the main process
  let unsubscribe: (() => void) | null = null;
  const statusPromise = new Promise<void>((resolve) => {
    unsubscribe = desktopBridge.onOAuthStatus((status) => {
      if (status.provider === provider) {
        onStatus(status);
        if (status.phase === 'done' || status.phase === 'error') {
          resolve();
        }
      }
    });
  });

  try {
    const result = await desktopBridge.oauthStart(provider);
    if (!result.success) {
      onStatus({
        provider,
        phase: 'error',
        message: `Failed to start OAuth flow: ${result.error ?? 'Unknown error'}`,
        error: result.error,
      });
      return null;
    }

    // Wait for the flow to complete (browser login + callback capture)
    await statusPromise;

    // Reload accounts from main process
    invalidateSettingsCache();
    const accounts = await desktopBridge.proxyGetStatus();
    const newAccount = accounts
      .filter((a) => a.provider === provider)
      .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))[0];

    if (newAccount) {
      // Persist to settings
      const settings = await loadProxySettings();
      const existingIds = new Set(settings.accounts.map((a) => a.id));
      const updatedAccounts = existingIds.has(newAccount.id)
        ? settings.accounts.map((a) => (a.id === newAccount.id ? newAccount : a))
        : [...settings.accounts, newAccount];

      await saveProxySettings({ ...settings, accounts: updatedAccounts });
      return newAccount;
    }

    return null;
  } finally {
    unsubscribe?.();
  }
}

/**
 * Cancel an in-progress OAuth flow.
 */
export async function cancelOAuthFlow(provider: ProxyProvider): Promise<void> {
  await desktopBridge.oauthCancel(provider);
}

/**
 * Remove a proxy account and persist the updated settings.
 */
export async function removeAccount(accountId: string): Promise<void> {
  await desktopBridge.proxyRemoveAccount(accountId);
  invalidateSettingsCache();
  const settings = await loadProxySettings();
  const updated: ProxySettings = {
    ...settings,
    accounts: settings.accounts.filter((a) => a.id !== accountId),
  };
  await saveProxySettings(updated);
}

/**
 * Get a summary of all connected accounts grouped by provider.
 */
export async function getConnectedAccountsSummary(): Promise<
  Record<ProxyProvider, { count: number; healthy: number }>
> {
  const settings = await loadProxySettings();
  const summary: Record<string, { count: number; healthy: number }> = {};

  for (const account of settings.accounts) {
    if (!summary[account.provider]) {
      summary[account.provider] = { count: 0, healthy: 0 };
    }
    summary[account.provider].count++;
    if (account.isHealthy && !account.isDisabled) {
      summary[account.provider].healthy++;
    }
  }

  return summary as Record<ProxyProvider, { count: number; healthy: number }>;
}

/**
 * Check whether any proxy accounts are connected and healthy.
 */
export async function hasAnyHealthyAccount(): Promise<boolean> {
  const settings = await loadProxySettings();
  return settings.accounts.some((a) => a.isHealthy && !a.isDisabled);
}

/**
 * Check whether the wizard has been completed before (first-run detection).
 */
export function isFirstRun(): boolean {
  try {
    return !localStorage.getItem('null-library-wizard-complete');
  } catch {
    return true;
  }
}

/**
 * Mark the setup wizard as completed so it doesn't show again on next launch.
 */
export function markWizardComplete(): void {
  try {
    localStorage.setItem('null-library-wizard-complete', '1');
  } catch {
    // localStorage unavailable — no-op
  }
}

/**
 * Reset the wizard completion state (for testing or re-running setup).
 */
export function resetWizardState(): void {
  try {
    localStorage.removeItem('null-library-wizard-complete');
  } catch {
    // no-op
  }
}
