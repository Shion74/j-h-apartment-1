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
    unpaidBills: []
  })
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState([])
  const [showBranchModal, setShowBranchModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'regular',
    payment_type: 'cash',
    actual_payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  })
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
  const [penaltyPercentage, setPenaltyPercentage] = useState(1.00) // Will be fetched from settings

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

      // Fetch penalty percentage from settings
      try {
        const ratesResponse = await fetch('/api/settings/billing-rates', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        
        if (ratesResponse.ok) {
          const ratesData = await ratesResponse.json()
          if (ratesData.success) {
            setPenaltyPercentage(ratesData.rates.penalty_fee_percentage || 1.00)
          }
        }
      } catch (error) {
        console.error('Error fetching penalty percentage:', error)
      }

      setStats(statsData.stats)
      setBranches(branchesData.branches || [])
      
      // Filter unpaid bills (unpaid and partial)
      const unpaid = (billsData.bills || []).filter(bill => 
        bill.status === 'unpaid' || bill.status === 'partial' || bill.status === 'overdue'
      ).slice(0, 10) // Show only first 10 for dashboard
      
      setStats(prev => ({ ...prev, unpaidBills: unpaid }))

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
      
              toast.success('Branch created')
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

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    setPaymentLoading(true)

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bill_id: selectedBill.id,
          payment_amount: parseFloat(paymentFormData.payment_amount),
          payment_method: 'regular',
          payment_type: paymentFormData.payment_type,
          actual_payment_date: paymentFormData.actual_payment_date,
          notes: paymentFormData.notes
        })
      })

      const data = await response.json()

      if (data.success) {
        // Show single consolidated success message
        let message = '✅ Payment processed'
        
        // Add final bill or archiving info
        if (data.bill_paid && data.is_final_bill && data.tenant_moved_out) {
          message += ' - tenant moved out and room is now available'
        } else if (data.bill_paid && data.bill_archived) {
          message += ' - bill archived'
        }
        
        // If the bill is paid, automatically send a receipt email
        if (data.bill_paid) {
          try {
            const receiptResponse = await fetch('/api/payments/send-receipt', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ bill_id: selectedBill.id })
            })
            
            const receiptData = await receiptResponse.json()
            
            if (receiptData.success) {
              // Add receipt info to the success message
              message += ' and receipt email sent to tenant'
            } else {
              console.error('Failed to send receipt email:', receiptData.message)
              
              // If the error is because the bill was archived, try with the original bill ID
              if (receiptData.message && receiptData.message.includes('not found')) {
                console.log('Attempting to send receipt for archived bill...')
                
                // Small delay to ensure archiving is complete
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                const retryResponse = await fetch('/api/payments/send-receipt', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                  },
                  body: JSON.stringify({ bill_id: selectedBill.id })
                })
                
                const retryData = await retryResponse.json()
                
                if (retryData.success) {
                  // Add receipt info to the success message after retry
                  message += ' and receipt email sent to tenant'
                } else {
                  console.error('Failed to send receipt on retry:', retryData.message)
                  message += ' but receipt email failed to send'
                }
              } else {
                message += ' but receipt email failed to send'
              }
            }
          } catch (receiptError) {
            console.error('Receipt sending error:', receiptError)
            message += ' but receipt email failed to send'
          }
        }
        
        toast.success('Payment processed')
        
        setShowPaymentModal(false)
        setPaymentFormData({
          payment_amount: '',
          payment_method: 'regular',
          payment_type: 'cash',
          actual_payment_date: new Date().toISOString().split('T')[0],
          notes: ''
        })
        fetchDashboardData()
      } else {
        toast.error('Error: ' + data.message)
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed')
    } finally {
      setPaymentLoading(false)
    }
  }

  // Calculate penalty fee for late payments
  const calculatePenaltyFee = (bill, actualPaymentDate) => {
    if (!actualPaymentDate || bill.penalty_applied) return 0
    
    // Normalize dates to midnight for proper comparison
    const paymentDate = new Date(actualPaymentDate)
    paymentDate.setHours(0, 0, 0, 0)
    
    // Calculate proper due date based on billing cycle
    // Due date should be 10 days after the end of the billing period (rent_to)
    const rentToDate = new Date(bill.rent_to)
    rentToDate.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(rentToDate.getTime() + (10 * 24 * 60 * 60 * 1000)) // 10 days after rent period ends
    dueDate.setHours(0, 0, 0, 0)
    
    // Always use calculated due date based on billing cycle, ignore database due_date
    // This ensures penalty is always calculated correctly based on rent cycle
    const finalDueDate = dueDate
    finalDueDate.setHours(0, 0, 0, 0)
    
    if (paymentDate > finalDueDate) {
      // Use configurable penalty percentage and round to whole number
      const penaltyAmount = parseFloat(bill.total_amount) * (penaltyPercentage / 100)
      return Math.round(penaltyAmount)
    }
    
    return 0
  }

  // Update openPaymentModal to handle penalty fee
  const openPaymentModal = (bill) => {
    console.log('Opening payment modal for bill:', bill)
    setSelectedBill(bill)
    const paymentAmount = bill.status === 'partial' ? bill.remaining_balance : bill.total_amount
    setPaymentFormData({
      payment_amount: paymentAmount.toString(),
      payment_method: 'regular',
      payment_type: 'cash',
      actual_payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    })
    setShowPaymentModal(true)
  }

  // Auto-update payment amount when penalty fee is calculated
  useEffect(() => {
    if (selectedBill && paymentFormData.actual_payment_date) {
      const penaltyFee = calculatePenaltyFee(selectedBill, paymentFormData.actual_payment_date)
      const originalAmount = selectedBill.status === 'partial' ? selectedBill.remaining_balance : selectedBill.total_amount
      const newAmount = parseFloat(originalAmount) + penaltyFee
      
      // Only update if the calculated amount is different from current amount
      if (Math.abs(parseFloat(paymentFormData.payment_amount) - newAmount) > 0.01) {
        setPaymentFormData(prev => ({
          ...prev,
          payment_amount: newAmount.toFixed(2)
        }))
      }
    }
  }, [selectedBill, paymentFormData.actual_payment_date])

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH')
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
      value: stats.pendingBills,
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
              <Toaster position="top-center" />
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
                {stats.pendingBills} pending
              </span>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {stats.unpaidBills && stats.unpaidBills.length > 0 ? (
                stats.unpaidBills.map((bill) => (
                  <div key={bill.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {bill.tenant_name} - Room {bill.room_number}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {bill.branch_name} • {new Date(bill.rent_from).toLocaleDateString()} to {new Date(bill.rent_to).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            ₱{(bill.total_amount || 0).toLocaleString()}
                          </p>
                        </div>
                        <button 
                          onClick={() => openPaymentModal(bill)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          title="Process Payment"
                        >
                          Pay
                        </button>
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
            
            {stats.unpaidBills && stats.unpaidBills.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Link
                  href="/billing"
                  className="w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
                >
                  View All Bills
                </Link>
              </div>
            )}
          </div>

          {/* Payment Modal */}
          {showPaymentModal && selectedBill && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Process Payment - {selectedBill.tenant_name} (Room {selectedBill.room_number})
                  </h3>
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Bill Summary */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Bill Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Period:</span>
                      <span className="ml-2">{formatDate(selectedBill.rent_from)} - {formatDate(selectedBill.rent_to)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Amount:</span>
                      <span className="ml-2 font-medium">{formatCurrency(selectedBill.total_amount)}</span>
                    </div>
                    {selectedBill.status === 'partial' && (
                      <>
                        <div>
                          <span className="text-gray-500">Total Paid:</span>
                          <span className="ml-2 font-medium text-green-600">{formatCurrency(selectedBill.total_paid)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Remaining:</span>
                          <span className="ml-2 font-medium text-red-600">{formatCurrency(selectedBill.remaining_balance)}</span>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-gray-500">Due Date:</span>
                      <span className="ml-2">{selectedBill.due_date ? formatDate(selectedBill.due_date) : 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        selectedBill.status === 'paid' ? 'bg-green-100 text-green-800' :
                        selectedBill.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        selectedBill.is_overdue ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {selectedBill.is_overdue ? 'Overdue' : selectedBill.status}
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  {/* Payment Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={paymentFormData.payment_amount}
                      onChange={(e) => {
                        const inputAmount = parseFloat(e.target.value)
                        const penaltyFee = calculatePenaltyFee(selectedBill, paymentFormData.actual_payment_date)
                        const baseAmount = selectedBill.status === 'partial' ? selectedBill.remaining_balance : selectedBill.total_amount
                        const maxAmount = parseFloat(baseAmount) + penaltyFee
                        
                        // Check if this is a refund bill (negative amounts)
                        const isRefundBill = selectedBill.is_refund_bill || parseFloat(selectedBill.total_amount) < 0
                        
                        if (isRefundBill) {
                          // For refund bills, validate absolute values
                          const maxRefundAmount = Math.abs(maxAmount)
                          const inputRefundAmount = Math.abs(inputAmount)
                          
                          if (inputRefundAmount > (maxRefundAmount + 0.01)) {
                            toast.error('Refund amount exceeded')
                            return
                          }
                        } else {
                          // For regular bills, use original validation
                          if (inputAmount > (maxAmount + 0.01)) {
                            toast.error('Payment amount exceeded')
                            return
                          }
                        }
                        
                        setPaymentFormData(prev => ({...prev, payment_amount: e.target.value}))
                      }}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter payment amount"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const penaltyFee = calculatePenaltyFee(selectedBill, paymentFormData.actual_payment_date)
                        const baseAmount = selectedBill.status === 'partial' ? selectedBill.remaining_balance : selectedBill.total_amount
                        const totalWithPenalty = parseFloat(baseAmount) + penaltyFee
                        
                        if (penaltyFee > 0) {
                          return `Total with penalty: ${formatCurrency(totalWithPenalty)}`
                        } else {
                          return selectedBill.status === 'partial'
                            ? `Remaining balance: ${formatCurrency(selectedBill.remaining_balance)}`
                            : `Full amount: ${formatCurrency(selectedBill.total_amount)}`
                        }
                      })()}
                    </p>
                  </div>

                  {/* Payment Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Type *
                    </label>
                    <select
                      value={paymentFormData.payment_type}
                      onChange={(e) => setPaymentFormData(prev => ({...prev, payment_type: e.target.value}))}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="check">Check</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Actual Payment Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Payment Date *
                    </label>
                    <input
                      type="date"
                      value={paymentFormData.actual_payment_date}
                      onChange={(e) => setPaymentFormData(prev => ({...prev, actual_payment_date: e.target.value}))}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Date when tenant actually made the payment. Late payments (more than 10 days after billing period ends) will incur a 1% penalty fee.
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData(prev => ({...prev, notes: e.target.value}))}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Add any payment notes..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={paymentLoading}
                      className={`px-4 py-2 text-white text-sm font-medium rounded-md disabled:opacity-50 ${
                        selectedBill.is_final_bill 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {paymentLoading ? 'Processing...' : selectedBill.is_final_bill ? 'Complete Final Payment' : 'Process Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

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
                    placeholder="11"
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