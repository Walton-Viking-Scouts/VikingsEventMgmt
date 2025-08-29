import React, { useState, useEffect } from 'react';
import { BellIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useNotification } from '../contexts/notifications/NotificationContext';
import { Button, Checkbox, Modal } from './ui';

const NotificationPreferences = ({ isOpen, onClose }) => {
  const { preferences, updatePreferences } = useNotification();
  const [localPreferences, setLocalPreferences] = useState(preferences);

  // Sync local state with context when preferences change
  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handlePreferenceChange = (key, value) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await Promise.resolve(updatePreferences(localPreferences));
      onClose();
    } catch (e) {
      // Optional: surface an error toast here
    }
  };

  const handleReset = () => {
    setLocalPreferences(preferences);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Cog6ToothIcon className="w-5 h-5 text-scout-blue" />
          <Modal.Title>Notification Preferences</Modal.Title>
        </div>
      </Modal.Header>
      
      <Modal.Body>
        <div className="space-y-6">
          {/* General Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-scout-blue" />
              General Settings
            </h3>
            <div className="space-y-4">
              <Checkbox
                checked={localPreferences.enabled}
                onChange={(e) => handlePreferenceChange('enabled', e.target.checked)}
                label="Enable notifications"
                description="Turn on/off all notification functionality"
              />
              
              <Checkbox
                checked={localPreferences.sound}
                onChange={(e) => handlePreferenceChange('sound', e.target.checked)}
                disabled={!localPreferences.enabled}
                label="Sound notifications"
                description="Play sound when notifications appear"
              />
              
              <Checkbox
                checked={localPreferences.persistent}
                onChange={(e) => handlePreferenceChange('persistent', e.target.checked)}
                disabled={!localPreferences.enabled}
                label="Persistent notifications"
                description="Keep notifications visible until manually dismissed"
              />
            </div>
          </div>

          {/* Notification Types */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Notification Types
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Checkbox
                  checked={localPreferences.types?.success !== false}
                  onChange={(e) => handlePreferenceChange('types', {
                    ...(localPreferences.types ?? {}),
                    success: e.target.checked,
                  })}
                  disabled={!localPreferences.enabled}
                  label="Success"
                  description="Operation completed successfully"
                />
                
                <Checkbox
                  checked={localPreferences.types?.error !== false}
                  onChange={(e) => handlePreferenceChange('types', {
                    ...(localPreferences.types ?? {}),
                    error: e.target.checked,
                  })}
                  disabled={!localPreferences.enabled}
                  label="Error"
                  description="Errors and failures"
                />
                
                <Checkbox
                  checked={localPreferences.types?.warning !== false}
                  onChange={(e) => handlePreferenceChange('types', {
                    ...(localPreferences.types ?? {}),
                    warning: e.target.checked,
                  })}
                  disabled={!localPreferences.enabled}
                  label="Warning"
                  description="Important warnings"
                />
                
                <Checkbox
                  checked={localPreferences.types?.info !== false}
                  onChange={(e) => handlePreferenceChange('types', {
                    ...(localPreferences.types ?? {}),
                    info: e.target.checked,
                  })}
                  disabled={!localPreferences.enabled}
                  label="Info"
                  description="General information"
                />
              </div>
            </div>
          </div>

          {/* Duration Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Display Duration
            </h3>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Auto-dismiss after (seconds)
              </label>
              <select
                value={localPreferences.duration || 5000}
                onChange={(e) => handlePreferenceChange('duration', parseInt(e.target.value))}
                disabled={!localPreferences.enabled || localPreferences.persistent}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-scout-blue focus:ring-scout-blue disabled:opacity-50"
              >
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={7000}>7 seconds</option>
                <option value={10000}>10 seconds</option>
              </select>
              <p className="text-sm text-gray-500">
                {localPreferences.persistent 
                  ? 'Disabled when persistent notifications are enabled'
                  : 'Time before notifications automatically disappear'
                }
              </p>
            </div>
          </div>

          {/* History Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              History & Storage
            </h3>
            <div className="space-y-4">
              <Checkbox
                checked={localPreferences.saveHistory !== false}
                onChange={(e) => handlePreferenceChange('saveHistory', e.target.checked)}
                disabled={!localPreferences.enabled}
                label="Save notification history"
                description="Keep a record of past notifications"
              />
              
              <div className="ml-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum history entries
                </label>
                <select
                  value={localPreferences.maxHistoryEntries || 100}
                  onChange={(e) => handlePreferenceChange('maxHistoryEntries', parseInt(e.target.value))}
                  disabled={!localPreferences.enabled || localPreferences.saveHistory === false}
                  className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-scout-blue focus:ring-scout-blue disabled:opacity-50"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button variant="scout-blue" onClick={handleSave}>
          Save Preferences
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NotificationPreferences;