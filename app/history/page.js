'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  UserPlusIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

export default function HistoryPage() {
  const [paidBills, setPaidBills] = useState([])
  const [tenantHistory, setTenantHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('bills') // 'bills' or 'tenants'
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch paid bills
      const billsResponse = await fetch('/api/bills', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const billsData = await billsResponse.json()
      
      if (billsData.success) {
        // Filter only paid bills
        const paid = billsData.bills.filter(bill => bill.status === 'paid')
        setPaidBills(paid)
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
                        <div className="text-right">
                          <p className="text-lg font-medium text-gray-900">
                            {formatCurrency(bill.total_amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Paid: {formatDate(bill.updated_at)}
                          </p>
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
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
} 