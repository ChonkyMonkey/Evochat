import { atom } from 'recoil';
import type { ISubscription, IPlan, SubscriptionStatus, UsageSummary } from 'librechat-data-provider';

// Core subscription atoms
const subscription = atom<ISubscription | undefined>({
  key: 'subscription',
  default: undefined,
});

const availablePlans = atom<IPlan[]>({
  key: 'availablePlans',
  default: [],
});

const subscriptionStatus = atom<SubscriptionStatus | undefined>({
  key: 'subscriptionStatus',
  default: undefined,
});

const usageData = atom<UsageSummary | undefined>({
  key: 'usageData',
  default: undefined,
});

// UI state atoms
const showSubscriptionDialog = atom<boolean>({
  key: 'showSubscriptionDialog',
  default: false,
});

const showUpgradeDialog = atom<boolean>({
  key: 'showUpgradeDialog',
  default: false,
});

const showUsageDialog = atom<boolean>({
  key: 'showUsageDialog',
  default: false,
});

const selectedPlan = atom<IPlan | undefined>({
  key: 'selectedPlan',
  default: undefined,
});

// Loading states
const subscriptionLoading = atom<boolean>({
  key: 'subscriptionLoading',
  default: false,
});

const plansLoading = atom<boolean>({
  key: 'plansLoading',
  default: false,
});

const checkoutLoading = atom<boolean>({
  key: 'checkoutLoading',
  default: false,
});

// Error states
const subscriptionError = atom<string | undefined>({
  key: 'subscriptionError',
  default: undefined,
});

const plansError = atom<string | undefined>({
  key: 'plansError',
  default: undefined,
});

const checkoutError = atom<string | undefined>({
  key: 'checkoutError',
  default: undefined,
});

export default {
  // Core data
  subscription,
  availablePlans,
  subscriptionStatus,
  usageData,
  
  // UI state
  showSubscriptionDialog,
  showUpgradeDialog,
  showUsageDialog,
  selectedPlan,
  
  // Loading states
  subscriptionLoading,
  plansLoading,
  checkoutLoading,
  
  // Error states
  subscriptionError,
  plansError,
  checkoutError,
};