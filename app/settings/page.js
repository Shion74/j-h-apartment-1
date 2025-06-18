'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  CogIcon,
  BuildingOfficeIcon,
  BoltIcon,
  CurrencyDollarIcon,
  HomeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function SettingsPage() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingBranch, setSavingBranch] = useState(null)
  const [globalSettings, setGlobalSettings] = useState({
    electric_rate_per_kwh: 11.00,
    water_fixed_amount: 200.00,
    penalty_fee_percentage: 1.00
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [branchesResponse, settingsResponse] = await Promise.all([
        fetch('/api/branches', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/settings/billing-rates', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ])

      const branchesData = await branchesResponse.json()
      const settingsData = await settingsResponse.json()

      if (branchesData.success) {
        setBranches(branchesData.branches || [])
      }

      if (settingsData.success) {
        setGlobalSettings(settingsData.rates || {})
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load settings data')
    } finally {
      setLoading(false)
    }
  }

  const handleBranchRateChange = (branchId, field, value) => {
    setBranches(prev => prev.map(branch => 
      branch.id === branchId 
        ? { ...branch, [field]: value === '' ? '' : (parseFloat(value) || 0) }
        : branch
    ))
  }

  const saveBranchRates = async (branchId, syncRooms = false) => {
    const branch = branches.find(b => b.id === branchId)
    if (!branch) return

    setSavingBranch(branchId)
    try {
      const response = await fetch(`/api/branches/${branchId}/rates`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          monthly_rent: branch.monthly_rent,
          water_rate: branch.water_rate,
          electricity_rate: branch.electricity_rate,
          sync_rooms: syncRooms
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        fetchData() // Refresh data
      } else {
        toast.error(data.message || 'Failed to update branch rates')
      }
    } catch (error) {
      console.error('Error saving branch rates:', error)
      toast.error('Failed to save branch rates')
    } finally {
      setSavingBranch(null)
    }
  }

  const updateGlobalSettings = async (setting, value) => {
    try {
      let endpoint, payload
      
      if (setting === 'electric_rate_per_kwh') {
        endpoint = 'electricity'
        payload = { rate: parseFloat(value) }
      } else if (setting === 'water_fixed_amount') {
        endpoint = 'water'
        payload = { amount: parseFloat(value) }
      } else if (setting === 'penalty_fee_percentage') {
        endpoint = 'penalty'
        payload = { percentage: parseFloat(value) }
      }

      const response = await fetch(`/api/settings/rates/${endpoint}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        toast.success(data.message)
        setGlobalSettings(prev => ({
          ...prev,
          [setting]: parseFloat(value)
        }))
      } else {
        toast.error(data.message || 'Failed to update setting')
      }
    } catch (error) {
      console.error('Error updating global setting:', error)
      toast.error('Failed to update setting')
    }
  }

  const updateAndSyncGlobalSettings = async (setting, value) => {
    const confirmMessage = setting === 'electric_rate_per_kwh' 
      ? `Update global electricity rate to ₱${value}/kWh and sync to all ${branches.length} branches?`
      : `Update global water rate to ₱${value}/room and sync to all ${branches.length} branches?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setLoading(true)
      
      // First update the global setting
      await updateGlobalSettings(setting, value)
      
      // Then sync to all branches
      const updates = branches.map(branch => {
        const updatedRates = { ...branch }
        if (setting === 'electric_rate_per_kwh') {
          updatedRates.electricity_rate = parseFloat(value)
        } else {
          updatedRates.water_rate = parseFloat(value)
        }

        return fetch(`/api/branches/${branch.id}/rates`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            monthly_rent: updatedRates.monthly_rent,
            water_rate: updatedRates.water_rate,
            electricity_rate: updatedRates.electricity_rate,
            sync_rooms: false
          })
        })
      })

      const results = await Promise.all(updates)
      const successCount = results.filter(r => r.ok).length
      
      if (successCount === branches.length) {
        toast.success('Settings updated successfully')
        fetchData() // Refresh data
      } else {
        toast.error('Partially updated')
        fetchData() // Refresh data anyway
      }
    } catch (error) {
      console.error('Error updating and syncing rates:', error)
      toast.error('Failed to update and sync rates')
    } finally {
      setLoading(false)
    }
  }

  const syncGlobalRatesToBranches = async (setting) => {
    const confirmMessage = setting === 'electric_rate_per_kwh' 
      ? `Are you sure you want to update ALL branches' electricity rates to ₱${globalSettings.electric_rate_per_kwh}/kWh?`
      : `Are you sure you want to update ALL branches' water rates to ₱${globalSettings.water_fixed_amount}/room?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setLoading(true)
      
      // Update each branch with the global rate
      const updates = branches.map(branch => {
        const updatedRates = { ...branch }
        if (setting === 'electric_rate_per_kwh') {
          updatedRates.electricity_rate = globalSettings.electric_rate_per_kwh
        } else {
          updatedRates.water_rate = globalSettings.water_fixed_amount
        }

        return fetch(`/api/branches/${branch.id}/rates`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            monthly_rent: updatedRates.monthly_rent,
            water_rate: updatedRates.water_rate,
            electricity_rate: updatedRates.electricity_rate,
            sync_rooms: false
          })
        })
      })

      const results = await Promise.all(updates)
      const successCount = results.filter(r => r.ok).length
      
      if (successCount === branches.length) {
        toast.success('Rates synced successfully')
        fetchData() // Refresh data
      } else {
        toast.error('Sync partially failed')
        fetchData() // Refresh data anyway
      }
    } catch (error) {
      console.error('Error syncing rates to branches:', error)
      toast.error('Failed to sync rates to branches')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
              <Toaster position="top-center" />
      <DashboardLayout>
        <div className="px-4 sm:px-6 lg:px-8 pb-6">
          {/* Header */}
          <div className="sm:flex sm:items-center mb-6 pt-6">
            <div className="sm:flex-auto">
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage branch-specific rates and global system settings
              </p>
            </div>
          </div>

          {/* Global Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Global Default Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Global Electricity Rate */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <BoltIcon className="h-6 w-6 text-yellow-500 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Default Electricity Rate</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Global default rate per kilowatt hour (kWh) - used when branch doesn't have specific rate
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">₱</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={globalSettings.electric_rate_per_kwh}
                          onChange={(e) => {
                            const value = e.target.value
                            setGlobalSettings(prev => ({
                              ...prev,
                              electric_rate_per_kwh: value === '' ? '' : (parseFloat(value) || 0)
                            }))
                          }}
                          className="pl-8 pr-16 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-3 text-gray-500">per kWh</span>
                      </div>
                    </div>
                    <button
                      onClick={() => updateAndSyncGlobalSettings('electric_rate_per_kwh', globalSettings.electric_rate_per_kwh)}
                      disabled={loading}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Updating...' : 'Update & Sync to Branches'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Global Water Rate */}
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <CurrencyDollarIcon className="h-6 w-6 text-blue-500 mr-3" />
                  <h3 className="text-lg font-medium text-gray-900">Default Water Rate</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Global default fixed water amount per room per month - used when branch doesn't have specific rate
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">₱</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={globalSettings.water_fixed_amount}
                          onChange={(e) => {
                            const value = e.target.value
                            setGlobalSettings(prev => ({
                              ...prev,
                              water_fixed_amount: value === '' ? '' : (parseFloat(value) || 0)
                            }))
                          }}
                          className="pl-8 pr-20 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="absolute right-3 top-3 text-gray-500">per room</span>
                      </div>
                    </div>
                    <button
                      onClick={() => updateAndSyncGlobalSettings('water_fixed_amount', globalSettings.water_fixed_amount)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Updating...' : 'Update & Sync to Branches'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Penalty Fee Rate */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center mb-4">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">Late Payment Penalty Fee</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Percentage fee applied to the total bill amount when payment is made more than 10 days after the billing period ends. Fee is automatically rounded to the nearest whole number.
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={globalSettings.penalty_fee_percentage}
                        onChange={(e) => {
                          const value = e.target.value
                          setGlobalSettings(prev => ({
                            ...prev,
                            penalty_fee_percentage: value === '' ? '' : (parseFloat(value) || 0)
                          }))
                        }}
                        className="pr-8 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      />
                      <span className="absolute right-3 top-3 text-gray-500">%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => updateGlobalSettings('penalty_fee_percentage', globalSettings.penalty_fee_percentage)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Penalty Rate'}
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  <p><strong>Example:</strong> If penalty is {globalSettings.penalty_fee_percentage}% and bill is ₱3,500, late fee = ₱{Math.round(3500 * (globalSettings.penalty_fee_percentage / 100)).toLocaleString()}</p>
                  <p><strong>Note:</strong> Penalty applies when payment is made more than 10 days after the billing period ends, not the bill generation date.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Branch-Specific Settings */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Branch-Specific Rates</h2>
            <div className="space-y-6">
              {branches.map((branch) => (
                <div key={branch.id} className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="h-6 w-6 text-gray-400 mr-3" />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{branch.name}</h3>
                          <p className="text-sm text-gray-600">
                            {branch.room_count} rooms • {branch.occupied_rooms} occupied • {branch.vacant_rooms} vacant
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Monthly Revenue</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(branch.occupied_rent || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Monthly Rent */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <HomeIcon className="h-4 w-4 inline mr-1" />
                          Monthly Rent per Room
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={branch.monthly_rent || 0}
                            onChange={(e) => handleBranchRateChange(branch.id, 'monthly_rent', e.target.value)}
                            className="pl-8 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Default rent for all rooms in this branch
                        </p>
                      </div>

                      {/* Water Rate */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <CurrencyDollarIcon className="h-4 w-4 inline mr-1" />
                          Water Rate per Room
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={branch.water_rate || 0}
                            onChange={(e) => handleBranchRateChange(branch.id, 'water_rate', e.target.value)}
                            className="pl-8 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Fixed monthly water charge per room
                        </p>
                      </div>

                      {/* Electricity Rate */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <BoltIcon className="h-4 w-4 inline mr-1" />
                          Electricity Rate per kWh
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-500">₱</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={branch.electricity_rate || 0}
                            onChange={(e) => handleBranchRateChange(branch.id, 'electricity_rate', e.target.value)}
                            className="pl-8 pr-16 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                          <span className="absolute right-3 top-3 text-gray-500 text-sm">per kWh</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Rate per kilowatt hour consumed
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => saveBranchRates(branch.id, false)}
                          disabled={savingBranch === branch.id}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingBranch === branch.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="h-4 w-4 mr-2" />
                              Save Rates
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => saveBranchRates(branch.id, true)}
                          disabled={savingBranch === branch.id}
                          className="inline-flex items-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <HomeIcon className="h-4 w-4 mr-2" />
                          Save & Sync All Rooms
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          "Sync All Rooms" will update all {branch.room_count} rooms in this branch
                        </p>
                        <p className="text-xs text-gray-500">
                          to use the monthly rent specified above
                        </p>
                      </div>
                    </div>

                    {/* Warning Notice */}
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="text-yellow-800 font-medium">Important Notes:</p>
                          <ul className="text-yellow-700 mt-1 list-disc list-inside space-y-1">
                            <li>Branch rates are used for new bills generated for rooms in this branch</li>
                            <li>"Save & Sync All Rooms" will update the monthly rent for ALL existing rooms in this branch</li>
                            <li>When adding new rooms to this branch, they will automatically use these rates</li>
                            <li>Existing unpaid bills will not be affected by rate changes</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
} 