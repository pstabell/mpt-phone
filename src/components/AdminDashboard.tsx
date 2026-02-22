'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import TenantManagement from './TenantManagement';
import UserManagement from './UserManagement';
import ExtensionManagement from './ExtensionManagement';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  phone_number?: string;
  max_extensions: number;
  plan_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenant_users?: { count: number }[];
  extensions?: { count: number }[];
}

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalExtensions: number;
  activeExtensions: number;
}

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState('overview');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants();
    fetchStats();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data: tenantsData, error } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_users(count),
          extensions(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(tenantsData || []);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError('Failed to load tenants');
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Get tenant stats
      const { data: tenantStats, error: tenantError } = await supabase
        .from('tenants')
        .select('id, is_active');

      if (tenantError) throw tenantError;

      // Get user stats
      const { data: userStats, error: userError } = await supabase
        .from('tenant_users')
        .select('id, is_active');

      if (userError) throw userError;

      // Get extension stats
      const { data: extensionStats, error: extensionError } = await supabase
        .from('extensions')
        .select('id, is_active');

      if (extensionError) throw extensionError;

      const dashboardStats: DashboardStats = {
        totalTenants: tenantStats?.length || 0,
        activeTenants: tenantStats?.filter(t => t.is_active).length || 0,
        totalUsers: userStats?.length || 0,
        totalExtensions: extensionStats?.length || 0,
        activeExtensions: extensionStats?.filter(e => e.is_active).length || 0,
      };

      setStats(dashboardStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setCurrentView('tenant-detail');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              MPT Phone - Admin Portal
            </h1>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setCurrentView('overview');
                  setSelectedTenant(null);
                }}
                className={`px-4 py-2 rounded ${
                  currentView === 'overview'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setCurrentView('tenants')}
                className={`px-4 py-2 rounded ${
                  currentView === 'tenants'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tenants
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'overview' && (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Tenants</h3>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalTenants || 0}</p>
                <p className="text-sm text-green-600">
                  {stats?.activeTenants || 0} active
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">Total Extensions</h3>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalExtensions || 0}</p>
                <p className="text-sm text-green-600">
                  {stats?.activeExtensions || 0} active
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500">System Status</h3>
                <p className="text-3xl font-bold text-green-600">Online</p>
                <p className="text-sm text-gray-500">All services running</p>
              </div>
            </div>

            {/* Recent Tenants */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Recent Tenants</h2>
              </div>
              <div className="divide-y">
                {tenants.slice(0, 5).map((tenant) => (
                  <div key={tenant.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{tenant.name}</h3>
                        <p className="text-sm text-gray-500">
                          {tenant.slug} • {tenant.plan_type} plan
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tenant.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'tenants' && (
          <TenantManagement 
            tenants={tenants}
            onTenantSelect={handleTenantSelect}
            onRefresh={fetchTenants}
          />
        )}

        {currentView === 'tenant-detail' && selectedTenant && (
          <div className="space-y-8">
            {/* Tenant Info Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedTenant.name}</h2>
                  <p className="text-gray-600">
                    {selectedTenant.slug} • {selectedTenant.plan_type} plan
                  </p>
                </div>
                <button
                  onClick={() => setCurrentView('tenants')}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Back to Tenants
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Phone Number</p>
                  <p className="font-medium">{selectedTenant.phone_number || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Max Extensions</p>
                  <p className="font-medium">{selectedTenant.max_extensions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedTenant.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* User Management */}
            <UserManagement tenantId={selectedTenant.id} />

            {/* Extension Management */}
            <ExtensionManagement tenantId={selectedTenant.id} />
          </div>
        )}
      </div>
    </div>
  );
}