'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  UserPlusIcon,
  ArrowRightIcon,
  XMarkIcon,
  EyeIcon,
  EnvelopeIcon,
  PhoneIcon,
  HomeIcon
} from '@heroicons/react/24/outline'

export default function HistoryPage() {
  const [paidBills, setPaidBills] = useState([])
  const [tenantHistory, setTenantHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('bills') // 'bills' or 'tenants'
  const [searchTerm, setSearchTerm] = useState('')
  
  // Modal states
  const [showBillModal, setShowBillModal] = useState(false)
  const [showTenantModal, setShowTenantModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [selectedTenant, setSelectedTenant] = useState(null)
  const [tenantBills, setTenantBills] = useState([])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch paid bills (including archived bills)
      const paidBillsResponse = await fetch('/api/bills/paid', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const paidBillsData = await paidBillsResponse.json()
      
      if (paidBillsData.success) {
        setPaidBills(paidBillsData.bills || [])
      }

      // Fetch tenant history (archived tenants)
      const tenantHistoryResponse = await fetch('/api/tenants/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const tenantHistoryData = await tenantHistoryResponse.json()
      
      if (tenantHistoryData.success) {
        setTenantHistory(tenantHistoryData.tenant_history)
      }

    } catch (error) {
      console.error('Error fetching history data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(date))
  }

  // Filter paid bills based on search
  const filteredPaidBills = paidBills.filter(bill => {
    if (!searchTerm) return true
    return bill.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           bill.room_number?.toString().includes(searchTerm)
  })

  // Filter tenant history based on search
  const filteredTenantHistory = tenantHistory.filter(tenant => {
    if (!searchTerm) return true
    return tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           tenant.room_number?.toString().includes(searchTerm)
  })

  // Functions for viewing details
  const viewBillDetails = (bill) => {
    setSelectedBill(bill)
    setShowBillModal(true)
  }

  const viewTenantDetails = async (tenant) => {
    setSelectedTenant(tenant)
    setLoading(true)
    
    try {
      // Fetch all bills for this tenant
      const response = await fetch(`/api/tenants/${tenant.id}/bills`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      
      if (data.success) {
        setTenantBills(data.bills || [])
      } else {
        setTenantBills([])
      }
    } catch (error) {
      console.error('Error fetching tenant bills:', error)
      setTenantBills([])
    } finally {
      setLoading(false)
      setShowTenantModal(true)
    }
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
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-8 pb-6">
        {/* Header */}
        <div className="sm:flex sm:items-center mb-6 pt-6">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold text-gray-900">History</h1>
            <p className="mt-2 text-sm text-gray-700">
              View transaction history and tenant records
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('bills')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bills'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CurrencyDollarIcon className="h-5 w-5 inline mr-2" />
                Paid Bills ({filteredPaidBills.length})
              </button>
              <button
                onClick={() => setActiveTab('tenants')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'tenants'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserPlusIcon className="h-5 w-5 inline mr-2" />
                Tenant History ({filteredTenantHistory.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="max-w-md">
            <input
              type="text"
              placeholder={`Search ${activeTab === 'bills' ? 'bills' : 'tenants'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        {activeTab === 'bills' ? (
          /* Paid Bills History */
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Paid Bills History
              </h3>
              {filteredPaidBills.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No paid bills found</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredPaidBills.map((bill) => (
                    <li key={bill.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <DocumentTextIcon className="h-8 w-8 text-green-500" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">
                                {bill.tenant_name} - Room {bill.room_number}
                              </p>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Paid
                              </span>
                            </div>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                              <p>
                                {formatDate(bill.rent_from)} - {formatDate(bill.rent_to)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-lg font-medium text-gray-900">
                              {formatCurrency(bill.total_amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              Paid: {formatDate(bill.actual_payment_date || bill.payment_date || bill.last_payment_date || bill.updated_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => viewBillDetails(bill)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          /* Tenant History */
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Archived Tenant History
              </h3>
              {filteredTenantHistory.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No archived tenant records found</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {filteredTenantHistory.map((tenant) => (
                    <li key={tenant.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <UserPlusIcon className="h-8 w-8 text-gray-500" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">
                                {tenant.name}
                              </p>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                tenant.contract_completed 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tenant.contract_completed ? 'Contract Completed' : 'Early Departure'}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <p className="mr-4">
                                {tenant.room_number ? `Room ${tenant.room_number}` : 'No room assigned'}
                              </p>
                              <p className="mr-4">
                                {tenant.branch_name || 'Unknown Branch'}
                              </p>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              <p>
                                <CalendarIcon className="h-4 w-4 inline mr-1" />
                                {formatDate(tenant.rent_start)} 
                                <ArrowRightIcon className="h-4 w-4 inline mx-2" />
                                {formatDate(tenant.rent_end)}
                              </p>
                              <p className="mt-1">
                                Reason: {tenant.reason_for_leaving?.replace('_', ' ') || 'Not specified'}
                              </p>
                              {tenant.security_deposit_refund_amount > 0 && (
                                <p className="mt-1 text-green-600 font-medium">
                                  Security Deposit Refund: {formatCurrency(tenant.security_deposit_refund_amount)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(tenant.total_bills_paid || 0)}
                            </p>
                            <p className="text-xs text-gray-500">Total Paid</p>
                            {tenant.total_bills_unpaid > 0 && (
                              <>
                                <p className="text-sm font-medium text-red-600 mt-1">
                                  {formatCurrency(tenant.total_bills_unpaid)}
                                </p>
                                <p className="text-xs text-gray-500">Unpaid</p>
                              </>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Archived: {formatDate(tenant.deleted_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => viewTenantDetails(tenant)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            View Tenant
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Bill Details Modal */}
        {showBillModal && selectedBill && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border max-w-3xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Bill Details</h3>
                <button
                  onClick={() => setShowBillModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Bill Header */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-medium text-green-900">
                        {selectedBill.tenant_name} - Room {selectedBill.room_number}
                      </h4>
                      <p className="text-sm text-green-700">
                        {selectedBill.branch_name}
                      </p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                        Paid
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-900">
                        {formatCurrency(selectedBill.total_amount)}
                      </p>
                      <p className="text-sm text-green-700">
                        Paid on: {formatDate(selectedBill.actual_payment_date || selectedBill.last_payment_date || selectedBill.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Billing Period */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Billing Period</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">From:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedBill.rent_from)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">To:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedBill.rent_to)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Bill Date:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedBill.bill_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Due Date:</span>
                      <span className="ml-2 font-medium">{formatDate(selectedBill.due_date)}</span>
                    </div>
                  </div>
                </div>

                {/* Bill Breakdown */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Bill Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Monthly Rent:</span>
                      <span className="font-medium">{formatCurrency(selectedBill.rent_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Electricity ({selectedBill.electric_consumption || 0} kWh):</span>
                      <span className="font-medium">{formatCurrency(selectedBill.electric_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Water (Fixed):</span>
                      <span className="font-medium">{formatCurrency(selectedBill.water_amount)}</span>
                    </div>
                    {selectedBill.extra_fee_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Extra Fee ({selectedBill.extra_fee_description}):</span>
                        <span className="font-medium">{formatCurrency(selectedBill.extra_fee_amount)}</span>
                      </div>
                    )}
                    {selectedBill.penalty_fee_amount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Penalty Fee (Late Payment):</span>
                        <span className="font-medium">{formatCurrency(selectedBill.penalty_fee_amount)}</span>
                      </div>
                    )}
                    <hr />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(selectedBill.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Electricity Reading */}
                {selectedBill.electric_present_reading && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-yellow-900 mb-3">Electricity Reading</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Previous Reading:</span>
                        <span className="ml-2 font-medium">{selectedBill.electric_previous_reading || 0} kWh</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Present Reading:</span>
                        <span className="ml-2 font-medium">{selectedBill.electric_present_reading} kWh</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Consumption:</span>
                        <span className="ml-2 font-medium">{selectedBill.electric_consumption || 0} kWh</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Reading Date:</span>
                        <span className="ml-2 font-medium">{formatDate(selectedBill.electric_reading_date)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tenant Details Modal */}
        {showTenantModal && selectedTenant && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border max-w-5xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Tenant Details & Bill History</h3>
                <button
                  onClick={() => setShowTenantModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tenant Information */}
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-3">Tenant Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center">
                        <UserPlusIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-medium">{selectedTenant.name}</span>
                      </div>
                      {selectedTenant.email && (
                        <div className="flex items-center">
                          <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{selectedTenant.email}</span>
                        </div>
                      )}
                      {selectedTenant.phone && (
                        <div className="flex items-center">
                          <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{selectedTenant.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <HomeIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span>Room {selectedTenant.room_number} - {selectedTenant.branch_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-3">Tenancy Period</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Start Date:</span>
                        <span className="font-medium">{formatDate(selectedTenant.rent_start)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">End Date:</span>
                        <span className="font-medium">{formatDate(selectedTenant.rent_end)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reason for Leaving:</span>
                        <span className="font-medium">{selectedTenant.reason_for_leaving?.replace('_', ' ') || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Archived Date:</span>
                        <span className="font-medium">{formatDate(selectedTenant.deleted_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-3">Financial Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Bills Paid:</span>
                        <span className="font-medium text-green-600">{formatCurrency(selectedTenant.total_bills_paid || 0)}</span>
                      </div>
                      {selectedTenant.total_bills_unpaid > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Unpaid:</span>
                          <span className="font-medium text-red-600">{formatCurrency(selectedTenant.total_bills_unpaid)}</span>
                        </div>
                      )}
                      {selectedTenant.security_deposit_refund_amount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Security Deposit Refund:</span>
                          <span className="font-medium text-blue-600">{formatCurrency(selectedTenant.security_deposit_refund_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bill History */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Bill History</h4>
                  <div className="bg-white border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                    {tenantBills.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        No bills found for this tenant
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {tenantBills.map((bill) => (
                          <li key={bill.id} className="p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {formatDate(bill.rent_from)} - {formatDate(bill.rent_to)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Bill Date: {formatDate(bill.bill_date)}
                                </p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                                  bill.status === 'paid' 
                                    ? 'bg-green-100 text-green-800'
                                    : bill.status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">
                                  {formatCurrency(bill.total_amount)}
                                </p>
                                {bill.status === 'paid' && (
                                  <p className="text-xs text-gray-500">
                                    Paid: {formatDate(bill.actual_payment_date || bill.last_payment_date || bill.updated_at)}
                                  </p>
                                )}
                                {bill.status === 'partial' && (
                                  <p className="text-xs text-red-600">
                                    Remaining: {formatCurrency(bill.remaining_balance)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
} 