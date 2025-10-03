import React, { useMemo, useState } from 'react';
import type { ModelSelectorProps } from '~/common';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { ModelSelectorChatProvider} from './ModelSelectorChatContext';
import { renderModelSpecs, renderEndpoints, renderSearchResults } from './components';
import { getSelectedIcon, getDisplayValue } from './utils';
import { CustomMenu as Menu } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';

function ModelSelectorContent() {
  const localize = useLocalize();
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const [basicPreference, setBasicPreference] = useState<'auto' | 'standard' | 'premium'>('auto');

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    searchResults,
    selectedValues,

    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig],
  );
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  const trigger = (
    <button
      className="my-1 flex h-10 w-full max-w-[70vw] items-center justify-center gap-2 rounded-xl border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary hover:bg-surface-tertiary"
      aria-label={localize('com_ui_select_model')}
    >
      {selectedIcon && React.isValidElement(selectedIcon) && (
        <div className="flex flex-shrink-0 items-center justify-center overflow-hidden">
          {selectedIcon}
        </div>
      )}
      <span className="flex-grow truncate text-left">{selectedDisplayValue}</span>
    </button>
  );

  // Render basic mode options (Auto, Standard, Premium) with proper hover animations
  const renderBasicModeOptions = () => {
    const options = [
      { value: 'auto', label: localize('com_paddle_mode_auto') },
      { value: 'standard', label: localize('com_paddle_mode_standard') },
      { value: 'premium', label: localize('com_paddle_mode_premium') },
    ];

    return options.map((option) => {
      const isSelected = basicPreference === option.value;
      // Apply colors from the top (horizontal) selector to the bottom vertical options when selected.
      // Keep hover animations like when selecting models.
      const baseClass =
        'flex h-9 w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors duration-200';
      const hoverClass = 'hover:bg-surface-tertiary';
      const selectedClass =
        'bg-blue-50 text-blue-700 border border-blue-200'; // color treatment borrowed from top selector style
      return (
        <div
          key={option.value}
          className={`${baseClass} ${hoverClass} ${isSelected ? selectedClass : 'bg-transparent'}`}
          onClick={() => setBasicPreference(option.value as 'auto' | 'standard' | 'premium')}
          role="button"
          aria-pressed={isSelected}
        >
          <span>{option.label}</span>
          {isSelected ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="block"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM16.0755 7.93219C16.5272 8.25003 16.6356 8.87383 16.3178 9.32549L11.5678 16.0755C11.3931 16.3237 11.1152 16.4792 10.8123 16.4981C10.5093 16.517 10.2142 16.3973 10.0101 16.1727L7.51006 13.4227C7.13855 13.014 7.16867 12.3816 7.57733 12.0101C7.98598 11.6386 8.61843 11.6687 8.98994 12.0773L10.6504 13.9039L14.6822 8.17451C15 7.72284 15.6238 7.61436 16.0755 7.93219Z"
                fill="currentColor"
              />
            </svg>
          ) : null}
        </div>
      );
    });
  };

  // Filter endpoints to only show Plugins and My Agents in basic mode
  const filteredEndpoints = mappedEndpoints?.filter(endpoint =>
    endpoint.value === 'gptPlugins' || endpoint.value === 'agents'
  ) ?? [];

  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-2">
      <Menu
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        // Only allow search when in advanced mode
        onSearch={mode === 'advanced' ? (value) => setSearchValue(value) : undefined}
        combobox={mode === 'advanced' ? <input placeholder={localize('com_endpoint_search_models')} /> : undefined}
        trigger={trigger}
      >
        {/* Compact Advanced toggle (replaces the top horizontal selector). Kept non-sticky and placed above options. */}
        <div className="px-2 py-2 w-full">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-text-secondary">{localize('com_paddle_advanced_mode')}</div>
            <button
              type="button"
              onClick={() => setMode(prev => (prev === 'advanced' ? 'basic' : 'advanced'))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ${
                mode === 'advanced' ? 'bg-blue-600' : 'bg-border-light'
              }`}
              aria-pressed={mode === 'advanced'}
              aria-label={localize('com_paddle_toggle_advanced')}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
                  mode === 'advanced' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {searchResults ? (
          renderSearchResults(searchResults, localize, searchValue)
        ) : mode === 'basic' ? (
          <>
            {/* Basic mode: Show only Auto/Standard/Premium options */}
            <div className="p-2 w-full">
              {renderBasicModeOptions()}
            </div>

            {/* Separator */}
            <div className="border-t border-border-light my-2 w-full"></div>

            {/* Still show Plugins and My Agents in basic mode */}
            {renderEndpoints(filteredEndpoints)}
          </>
        ) : (
          <>
            {/* Advanced mode: Show full selection */}
            {renderModelSpecs(modelSpecs, selectedValues.modelSpec || '')}
            {renderEndpoints(mappedEndpoints ?? [])}
          </>
        )}
      </Menu>

      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}

