import React, { useState, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { CreditCard, BarChart3, Clock, Receipt } from 'lucide-react';
import type { TDialogProps } from '~/common';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useMediaQuery, useLocalize, TranslationKeys } from '~/hooks';
import { SubscriptionOverview, PlanSelection, UsageDashboard, BillingHistory } from '~/components/Subscription';
import { cn } from '~/utils';

export enum SubscriptionTabValues {
  OVERVIEW = 'overview',
  PLANS = 'plans',
  USAGE = 'usage',
  BILLING = 'billing',
}

export default function SubscriptionDialog({ open, onOpenChange }: TDialogProps) {
  const isSmallScreen = useMediaQuery('(max-width: 767px)');
  const localize = useLocalize();
  const [activeTab, setActiveTab] = useState(SubscriptionTabValues.OVERVIEW);
  const tabRefs = useRef({});

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabs: SubscriptionTabValues[] = [
      SubscriptionTabValues.OVERVIEW,
      SubscriptionTabValues.PLANS,
      SubscriptionTabValues.USAGE,
      SubscriptionTabValues.BILLING,
    ];
    const currentIndex = tabs.indexOf(activeTab);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex + 1) % tabs.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
        break;
      case 'Home':
        event.preventDefault();
        setActiveTab(tabs[0]);
        break;
      case 'End':
        event.preventDefault();
        setActiveTab(tabs[tabs.length - 1]);
        break;
    }
  };

  const subscriptionTabs: {
    value: SubscriptionTabValues;
    icon: React.JSX.Element;
    label: TranslationKeys;
  }[] = [
    {
      value: SubscriptionTabValues.OVERVIEW,
      icon: <CreditCard className="icon-sm" />,
      label: 'com_subscription_overview',
    },
    {
      value: SubscriptionTabValues.PLANS,
      icon: <BarChart3 className="icon-sm" />,
      label: 'com_subscription_plans',
    },
    {
      value: SubscriptionTabValues.USAGE,
      icon: <Clock className="icon-sm" />,
      label: 'com_subscription_usage',
    },
    {
      value: SubscriptionTabValues.BILLING,
      icon: <Receipt className="icon-sm" />,
      label: 'com_subscription_billing',
    },
  ];

  const handleTabChange = (value: string) => {
    setActiveTab(value as SubscriptionTabValues);
  };

  return (
    <Transition appear show={open}>
      <Dialog as="div" className="relative z-50" onClose={onOpenChange}>
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black opacity-50 dark:opacity-80" aria-hidden="true" />
        </TransitionChild>

        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className={cn('fixed inset-0 flex w-screen items-center justify-center p-4')}>
            <DialogPanel
              className={cn(
                'min-h-[700px] overflow-hidden rounded-xl rounded-b-lg bg-background pb-6 shadow-2xl backdrop-blur-2xl animate-in sm:rounded-2xl md:min-h-[500px] md:w-[900px] lg:w-[1000px]',
              )}
            >
              <DialogTitle
                className="mb-1 flex items-center justify-between p-6 pb-5 text-left"
                as="div"
              >
                <h2 className="text-lg font-medium leading-6 text-text-primary">
                  {localize('com_nav_subscription')}
                </h2>
                <button
                  type="button"
                  className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-border-xheavy focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-surface-primary dark:focus:ring-offset-surface-primary"
                  onClick={() => onOpenChange(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 text-text-primary"
                  >
                    <line x1="18" x2="6" y1="6" y2="18"></line>
                    <line x1="6" x2="18" y1="6" y2="18"></line>
                  </svg>
                  <span className="sr-only">{localize('com_ui_close')}</span>
                </button>
              </DialogTitle>
              <div className="max-h-[650px] overflow-auto px-6 md:max-h-[500px] md:min-h-[500px] md:w-[900px] lg:w-[1000px]">
                <Tabs.Root
                  value={activeTab}
                  onValueChange={handleTabChange}
                  className="flex flex-col gap-10 md:flex-row"
                  orientation="vertical"
                >
                  <Tabs.List
                    aria-label="Subscription"
                    className={cn(
                      'min-w-auto max-w-auto relative -ml-[8px] flex flex-shrink-0 flex-col flex-nowrap overflow-auto sm:max-w-none',
                      isSmallScreen
                        ? 'flex-row rounded-xl bg-surface-secondary'
                        : 'sticky top-0 h-full',
                    )}
                    onKeyDown={handleKeyDown}
                  >
                    {subscriptionTabs.map(({ value, icon, label }) => (
                      <Tabs.Trigger
                        key={value}
                        className={cn(
                          'group relative z-10 m-1 flex items-center justify-start gap-2 rounded-xl px-2 py-1.5 transition-all duration-200 ease-in-out',
                          isSmallScreen
                            ? 'flex-1 justify-center text-nowrap p-1 px-3 text-sm text-text-secondary radix-state-active:bg-surface-hover radix-state-active:text-text-primary'
                            : 'bg-transparent text-text-secondary radix-state-active:bg-surface-tertiary radix-state-active:text-text-primary',
                        )}
                        value={value}
                        ref={(el) => (tabRefs.current[value] = el)}
                      >
                        {icon}
                        {localize(label)}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <div className="overflow-auto sm:w-full sm:max-w-none md:pr-0.5 md:pt-0.5">
                    <Tabs.Content value={SubscriptionTabValues.OVERVIEW}>
                      <SubscriptionOverview />
                    </Tabs.Content>
                    <Tabs.Content value={SubscriptionTabValues.PLANS}>
                      <PlanSelection />
                    </Tabs.Content>
                    <Tabs.Content value={SubscriptionTabValues.USAGE}>
                      <UsageDashboard />
                    </Tabs.Content>
                    <Tabs.Content value={SubscriptionTabValues.BILLING}>
                      <BillingHistory />
                    </Tabs.Content>
                  </div>
                </Tabs.Root>
              </div>
            </DialogPanel>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}