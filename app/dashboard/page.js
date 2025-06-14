'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  BuildingOfficeIcon,
  HomeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  BellIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBranches: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    totalTenants: 0,
    monthlyRevenue: 0,
    pendingBills: 0,
    unpaidBills: 0
  })
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState([])
  const [unpaidBills, setUnpaidBills] = useState([])
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    address: '',
    monthly_rent: '',
    water_rate: '200',
    electricity_rate: '12',
    room_count: '',
    room_prefix: ''
  })
  const [billingReminders, setBillingReminders] = useState({
    loading: false,
    lastRun: null,
    stats: []
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Import api dynamically to avoid SSR issues
      const { api } = await import('../../lib/api')
      
      // Fetch dashboard statistics and unpaid bills
      const [statsData, branchesData, billsData] = await Promise.all([
        api.getDashboardStats(),
        api.getBranches(),
        api.getBills()
      ])

      setStats(statsData.stats)
      setBranches(branchesData.branches || [])
      
      // Filter unpaid bills (unpaid and partial)
      const unpaid = (billsData.bills || []).filter(bill => 
        bill.status === 'unpaid' || bill.status === 'partial' || bill.status === 'overdue'
      ).slice(0, 10) // Show only first 10 for dashboard
      
      setUnpaidBills(unpaid)

      // Fetch billing reminders data
      await fetchBillingRemindersData()

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const fetchBillingRemindersData = async () => {
    try {
      const response = await fetch('/api/bills/reminders', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setBillingReminders(prev => ({
          ...prev,
          stats: data.bills || []
        }))
      }
    } catch (error) {
      console.error('Error fetching billing reminders data:', error)
    }
  }

  const handleTriggerBillingReminders = async () => {
    setBillingReminders(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await fetch('/api/bills/reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(data.message)
        setBillingReminders(prev => ({
          ...prev,
          lastRun: new Date().toLocaleString()
        }))
        await fetchBillingRemindersData()
      } else {
        toast.error(data.message || 'Failed to send billing reminders')
      }
    } catch (error) {
      console.error('Error triggering billing reminders:', error)
      toast.error('Failed to trigger billing reminders')
    } finally {
      setBillingReminders(prev => ({ ...prev, loading: false }))
    }
  }

  const handleCreateBranch = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { api } = await import('../../lib/api')
      await api.createBranchWithRooms(branchFormData)
      
      toast.success('Branch created successfully with rooms!')
      setShowBranchModal(false)
      setBranchFormData({
        name: '',
        address: '',
        monthly_rent: '',
        water_rate: '200',
        electricity_rate: '12',
        room_count: '',
        room_prefix: ''
      })
      fetchDashboardData() // Refresh data
    } catch (error) {
      console.error('Error creating branch:', error)
      toast.error('Failed to create branch')
    } finally {
      setLoading(false)
    }
  }

  const statsCards = [
    {
      title: 'Total Branches',
      value: stats.totalBranches,
      icon: BuildingOfficeIcon,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      title: 'Total Rooms',
      value: stats.totalRooms,
      icon: HomeIcon,
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      title: 'Occupied Rooms',
      value: stats.occupiedRooms,
      icon: UsersIcon,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600'
    },
    {
      title: 'Unpaid Bills',
      value: stats.unpaidBills,
      icon: CurrencyDollarIcon,
      color: 'bg-red-500',
      textColor: 'text-red-600'
    }
  ]

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
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="px-4 sm:px-6 lg:px-8 pb-6">
        {/* Header */}
        <div className="mb-6 pt-6">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your apartment management system</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((card, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className={`${card.color} rounded-lg p-3`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Unpaid Bills Panel */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 text-red-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Unpaid Bills</h3>
              </div>
              <span className="text-sm text-gray-500">
                {stats.unpaidBills} pending
              </span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {stats.unpaidBills > 0 ? (
                unpaidBills.map((bill) => (
                  <div key={bill.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {bill.tenant_name} - Room {bill.room_number}
                          </p>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            bill.status === 'overdue' 
                              ? 'bg-red-100 text-red-800'
                              : bill.status === 'partial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {bill.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {bill.branch_name} • Due: {new Date(bill.rent_to).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {bill.status === 'partial' ? (
                            <span className="text-red-600">
                              ₱{(bill.remaining_balance || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span>₱{(bill.total_amount || 0).toLocaleString()}</span>
                          )}
                        </p>
                        {bill.status === 'partial' && (
                          <p className="text-xs text-gray-500">
                            of ₱{(bill.total_amount || 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <CurrencyDollarIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No unpaid bills</h3>
                  <p className="mt-1 text-sm text-gray-500">All bills are up to date!</p>
                </div>
              )}
            </div>
            
            {stats.unpaidBills > 0 && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => window.location.href = '/billing'}
                  className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
                >
                  View All Bills
                </button>
              </div>
            )}
          </div>

          {/* Branches Overview */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Branches Overview</h3>
              <button
                onClick={() => setShowBranchModal(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Branch
              </button>
            </div>
            <div className="space-y-4">
            {branches.length > 0 ? (
              branches.map((branch) => (
                <div key={branch.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{branch.name}</h4>
                      <p className="text-sm text-gray-600">{branch.address}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        <span>Rent: ₱{branch.monthly_rent?.toLocaleString()}</span>
                        <span className="mx-2">•</span>
                        <span>Water: ₱{branch.water_rate}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {branch.occupied_rooms || 0}/{branch.total_rooms || 0} Occupied
                      </p>
                      <p className="text-xs text-gray-500">
                        {branch.total_rooms ? Math.round(((branch.occupied_rooms || 0) / branch.total_rooms) * 100) : 0}% Occupancy
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No branches</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new branch.</p>
                <button
                  onClick={() => setShowBranchModal(true)}
                  className="mt-3 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Create First Branch
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* Billing Reminders Panel - Moved to Bottom */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Billing Reminders
              </h3>
              <button
                onClick={handleTriggerBillingReminders}
                disabled={billingReminders.loading}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {billingReminders.loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <BellIcon className="h-4 w-4 mr-2" />
                    Send Reminders
                  </>
                )}
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <InformationCircleIcon className="h-5 w-5 text-blue-400 mr-2" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Automatic Daily Reminders</p>
                    <p className="mt-1">
                      Emails are sent to <strong>official.jhapartment@gmail.com</strong> for bills due within 3 days.
                    </p>
                  </div>
                </div>
              </div>

              {billingReminders.lastRun && (
                <div className="text-sm text-gray-600">
                  <p><strong>Last Run:</strong> {billingReminders.lastRun}</p>
                </div>
              )}

              {billingReminders.stats.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Bills Needing Attention</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {billingReminders.stats.slice(0, 5).map((bill) => (
                      <div key={bill.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-900">
                          {bill.tenant_name} - Room {bill.room_number}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          bill.days_until_due <= 0 
                            ? 'bg-red-100 text-red-800' 
                            : bill.days_until_due <= 1
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bill.days_until_due <= 0 
                            ? `${Math.abs(bill.days_until_due)}d overdue`
                            : `${bill.days_until_due}d left`
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                  {billingReminders.stats.length > 5 && (
                    <p className="text-xs text-gray-500 mt-2">
                      +{billingReminders.stats.length - 5} more bills need attention
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create New Branch</h3>
              <button
                onClick={() => setShowBranchModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateBranch} className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Branch Name *</label>
                  <input
                    type="text"
                    value={branchFormData.name}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., JH Apartment Main"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Room Count *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={branchFormData.room_count}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, room_count: e.target.value }))}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Number of rooms"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Address *</label>
                <textarea
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                  rows={2}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Complete address"
                />
              </div>

              {/* Rates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Monthly Rent (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={branchFormData.monthly_rent}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, monthly_rent: e.target.value }))}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="5000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Water Rate (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={branchFormData.water_rate}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, water_rate: e.target.value }))}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="200"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Electricity Rate (₱/kWh) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={branchFormData.electricity_rate}
                    onChange={(e) => setBranchFormData(prev => ({ ...prev, electricity_rate: e.target.value }))}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12"
                  />
                </div>
              </div>

              {/* Room Prefix */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Room Number Prefix (Optional)</label>
                <input
                  type="text"
                  value={branchFormData.room_prefix}
                  onChange={(e) => setBranchFormData(prev => ({ ...prev, room_prefix: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., A, B, JH (rooms will be A01, A02, etc.)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty for simple numbering (1, 2, 3...) or add prefix for formatted numbers (A01, A02, A03...)
                </p>
              </div>

              {/* Preview */}
              {branchFormData.room_count && (
                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Preview:</strong> This will create {branchFormData.room_count} rooms numbered: 
                    {branchFormData.room_prefix ? (
                      <span className="font-mono ml-1">
                        {branchFormData.room_prefix}01, {branchFormData.room_prefix}02, {branchFormData.room_prefix}03...
                      </span>
                    ) : (
                      <span className="font-mono ml-1">1, 2, 3...</span>
                    )}
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Branch & Rooms'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
} 