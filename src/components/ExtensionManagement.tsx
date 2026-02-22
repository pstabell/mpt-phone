'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PresenceIndicator from './PresenceIndicator';

interface Extension {
  id: string;
  tenant_id: string;
  extension_number: string;
  extension_name?: string;
  user_id?: string;
  direct_dial_number?: string;
  voicemail_enabled: boolean;
  call_forwarding_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenant_users?: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  }[];
  user_presence?: {
    status: string;
    status_message?: string;
    last_activity: string;
  }[];
}

interface TenantUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface ExtensionManagementProps {
  tenantId: string;
}

export default function ExtensionManagement({ tenantId }: ExtensionManagementProps) {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [availableUsers, setAvailableUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExtension, setEditingExtension] = useState<Extension | null>(null);
  const [formData, setFormData] = useState({
    extension_number: '',
    extension_name: '',
    user_id: '',
    direct_dial_number: '',
    call_forwarding_number: '',
    voicemail_enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExtensions();
    fetchAvailableUsers();
  }, [tenantId]);

  const fetchExtensions = async () => {
    try {
      const response = await fetch(`/api/extensions?tenant_id=${tenantId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch extensions');
      }
      
      setExtensions(data.extensions || []);
    } catch (err) {
      console.error('Error fetching extensions:', err);
      setError('Failed to load extensions');
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('tenant_users')
        .select('id, email, first_name, last_name, role')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = editingExtension 
        ? `/api/extensions/${editingExtension.id}`
        : '/api/extensions';
      
      const method = editingExtension ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        tenant_id: tenantId,
        user_id: formData.user_id || null
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save extension');
      }

      // Reset form and refresh
      setFormData({
        extension_number: '',
        extension_name: '',
        user_id: '',
        direct_dial_number: '',
        call_forwarding_number: '',
        voicemail_enabled: true
      });
      setShowCreateForm(false);
      setEditingExtension(null);
      fetchExtensions();
    } catch (err: any) {
      console.error('Error saving extension:', err);
      setError(err.message || 'Failed to save extension');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (extension: Extension) => {
    setEditingExtension(extension);
    setFormData({
      extension_number: extension.extension_number,
      extension_name: extension.extension_name || '',
      user_id: extension.user_id || '',
      direct_dial_number: extension.direct_dial_number || '',
      call_forwarding_number: extension.call_forwarding_number || '',
      voicemail_enabled: extension.voicemail_enabled
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (extension: Extension) => {
    if (!confirm(`Are you sure you want to delete extension ${extension.extension_number}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/extensions/${extension.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete extension');
      }

      fetchExtensions();
    } catch (err: any) {
      console.error('Error deleting extension:', err);
      setError(err.message || 'Failed to delete extension');
    }
  };

  const handleToggleActive = async (extension: Extension) => {
    try {
      const response = await fetch(`/api/extensions/${extension.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !extension.is_active
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update extension');
      }

      fetchExtensions();
    } catch (err: any) {
      console.error('Error toggling extension:', err);
      setError(err.message || 'Failed to update extension');
    }
  };

  const getUserDisplayName = (user?: { id: string; email: string; first_name?: string; last_name?: string }) => {
    if (!user) return 'Unassigned';
    
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || user.email;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Extension Management ({extensions.length})
        </h3>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingExtension(null);
            setFormData({
              extension_number: '',
              extension_name: '',
              user_id: '',
              direct_dial_number: '',
              call_forwarding_number: '',
              voicemail_enabled: true
            });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Add Extension
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="px-6 py-4 border-b bg-gray-50">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            {editingExtension ? 'Edit Extension' : 'Add New Extension'}
          </h4>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension Number *
                </label>
                <input
                  type="text"
                  name="extension_number"
                  value={formData.extension_number}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingExtension}
                  pattern="[0-9]{3,4}"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="101"
                />
                <p className="text-xs text-gray-500 mt-1">3-4 digits</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension Name
                </label>
                <input
                  type="text"
                  name="extension_name"
                  value={formData.extension_name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sales Desk"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned User
                </label>
                <select
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {getUserDisplayName(user)} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direct Dial Number
                </label>
                <input
                  type="tel"
                  name="direct_dial_number"
                  value={formData.direct_dial_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Forwarding Number
                </label>
                <input
                  type="tel"
                  name="call_forwarding_number"
                  value={formData.call_forwarding_number}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="voicemail_enabled"
                  checked={formData.voicemail_enabled}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Voicemail Enabled
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingExtension(null);
                  setError(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingExtension ? 'Update Extension' : 'Add Extension')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Extensions List */}
      <div className="px-6 py-4">
        {extensions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No extensions found. Add your first extension to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extension
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Presence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Features
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {extensions.map((extension) => (
                  <tr key={extension.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {extension.extension_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {extension.extension_name || 'No name'}
                        </div>
                        {extension.direct_dial_number && (
                          <div className="text-xs text-gray-400">
                            DID: {extension.direct_dial_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {getUserDisplayName(extension.tenant_users?.[0])}
                      </div>
                      {extension.tenant_users?.[0] && (
                        <div className="text-xs text-gray-500">
                          {extension.tenant_users[0].email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {extension.user_presence?.[0] ? (
                        <PresenceIndicator 
                          status={extension.user_presence[0].status as 'available' | 'busy' | 'dnd' | 'offline'}
                          message={extension.user_presence[0].status_message}
                          lastActivity={extension.user_presence[0].last_activity}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">No presence</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col space-y-1">
                        {extension.voicemail_enabled && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            Voicemail
                          </span>
                        )}
                        {extension.call_forwarding_number && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            Forwarding
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        extension.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {extension.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(extension)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(extension)}
                          className={`${
                            extension.is_active
                              ? 'text-red-600 hover:text-red-900'
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {extension.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDelete(extension)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}