import React, { useEffect } from 'react';
import { cn } from '~/utils';

// Storage keys - completely separate from existing system to avoid collisions
const MODE_STORAGE_KEY = 'paddle_model_mode';
const BASIC_PREFERENCE_KEY = 'paddle_basic_preference';

interface ModelModeSwitcherProps {
  mode: 'basic' | 'advanced';
  onModeChange: (mode: 'basic' | 'advanced') => void;
  basicPreference?: 'auto' | 'standard' | 'premium';
  onPreferenceChange?: (preference: 'auto' | 'standard' | 'premium') => void;
  conversationId?: string | null;
  className?: string;
}

export function ModelModeSwitcher({
  mode,
  onModeChange,
  basicPreference = 'auto',
  onPreferenceChange,
  conversationId,
  className,
}: ModelModeSwitcherProps) {
  // Session-scoped storage keys using conversationId
  const modeSessionKey = conversationId ? `${MODE_STORAGE_KEY}_${conversationId}` : null;
  const preferenceSessionKey = conversationId ? `${BASIC_PREFERENCE_KEY}_${conversationId}` : null;

  // Load mode and preference from session storage on mount
  useEffect(() => {
    if (!modeSessionKey || !preferenceSessionKey) return;

    const savedMode = localStorage.getItem(modeSessionKey);
    const savedPreference = localStorage.getItem(preferenceSessionKey);

    // Default to basic mode if no saved mode
    if (!savedMode) {
      onModeChange('basic');
    } else if (savedMode === 'basic' || savedMode === 'advanced') {
      onModeChange(savedMode);
    }

    if (savedPreference && (savedPreference === 'auto' || savedPreference === 'standard' || savedPreference === 'premium')) {
      onPreferenceChange?.(savedPreference);
    }
  }, [modeSessionKey, preferenceSessionKey, onModeChange, onPreferenceChange]);

  // Save mode and preference to session storage when they change
  useEffect(() => {
    if (!modeSessionKey) return;
    localStorage.setItem(modeSessionKey, mode);
  }, [mode, modeSessionKey]);

  useEffect(() => {
    if (!preferenceSessionKey || !onPreferenceChange) return;
    localStorage.setItem(preferenceSessionKey, basicPreference);
  }, [basicPreference, preferenceSessionKey, onPreferenceChange]);

  const handleModeToggle = () => {
    const newMode = mode === 'basic' ? 'advanced' : 'basic';
    onModeChange(newMode);
  };

  const handlePreferenceChange = (preference: 'auto' | 'standard' | 'premium') => {
    onPreferenceChange?.(preference);
  };

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)}>
      {/* Simple mode toggle switch */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">Advanced mode</span>
        <button
          onClick={handleModeToggle}
          className={cn(
            'relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
            mode === 'advanced' ? 'bg-green-600' : 'bg-gray-400'
          )}
          title={mode === 'advanced' ? 'Switch to Basic Mode' : 'Switch to Advanced Mode'}
        >
          <span
            className={cn(
              'inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm',
              mode === 'advanced' ? 'translate-x-4' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Basic mode options - only show when in basic mode */}
      {mode === 'basic' && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex gap-1">
            <button
              onClick={() => handlePreferenceChange('auto')}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors hover:bg-surface-hover',
                basicPreference === 'auto'
                  ? 'bg-green-100 border-green-300 text-green-800'
                  : 'bg-surface-tertiary border-border-light text-text-secondary'
              )}
            >
              Auto
            </button>
            <button
              onClick={() => handlePreferenceChange('standard')}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors hover:bg-surface-hover',
                basicPreference === 'standard'
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-surface-tertiary border-border-light text-text-secondary'
              )}
            >
              Standard
            </button>
            <button
              onClick={() => handlePreferenceChange('premium')}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors hover:bg-surface-hover',
                basicPreference === 'premium'
                  ? 'bg-purple-100 border-purple-300 text-purple-800'
                  : 'bg-surface-tertiary border-border-light text-text-secondary'
              )}
            >
              Premium
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
