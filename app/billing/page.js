'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  DocumentTextIcon,
  EyeIcon,
  EnvelopeIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  HomeIcon,
  BoltIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function BillingPage() {
  const [bills, setBills] = useState([])
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showBillModal, setShowBillModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [billFormData, setBillFormData] = useState({
    tenant_id: '',
    room_id: '',
    rent_from: '',
    rent_to: '',
    rent_amount: '',
    electric_previous_reading: 0,
    electric_present_reading: '',
    electric_consumption: 0,
    electric_amount: 0,
    electric_reading_date: '',
    electric_previous_date: '',
    water_amount: 200,
    extra_fee_amount: 0,
    extra_fee_description: '',
    total_amount: 0
  })
  
  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'regular',
    payment_type: 'cash',
    actual_payment_date: new Date().toISOString().split('T')[0], // Default to today
    notes: ''
  })
  const [currentElectricRate, setCurrentElectricRate] = useState(12.00) // Will be fetched from settings

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch billing rates first
      const ratesResponse = await fetch('/api/settings/billing-rates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (ratesResponse.ok) {
        const ratesData = await ratesResponse.json()
        if (ratesData.success) {
          setCurrentElectricRate(ratesData.rates.electric_rate_per_kwh)
          console.log('Current electric rate loaded:', ratesData.rates.electric_rate_per_kwh)
        }
      }

      // Fetch branches data
      const branchesResponse = await fetch('/api/branches', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (branchesResponse.ok) {
        const branchesData = await branchesResponse.json()
        if (branchesData.success) {
          setBranches(branchesData.branches || [])
          console.log('Branches loaded:', branchesData.branches.length)
        }
      } else {
        console.error('Failed to fetch branches:', branchesResponse.status)
      }

      // Fetch rooms data
      const roomsResponse = await fetch('/api/bills/pending-rooms', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json()
        setRooms(roomsData.rooms || [])
      }

      // Fetch bills data
      const billsResponse = await fetch('/api/bills', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (billsResponse.ok) {
        const billsData = await billsResponse.json()
        setBills(billsData.bills || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }

  const resetBillForm = () => {
    setBillFormData({
      tenant_id: '',
      room_id: '',
      rent_from: '',
      rent_to: '',
      rent_amount: '',
      electric_previous_reading: 0,
      electric_present_reading: '',
      electric_consumption: 0,
      electric_amount: 0,
      electric_reading_date: '',
      electric_previous_date: '',
      water_amount: 200,
      extra_fee_amount: 0,
      extra_fee_description: '',
      total_amount: 0
    })
    setSelectedRoom(null)
  }

  const openGenerateBillModal = (room) => {
    setSelectedRoom(room)
    const today = new Date().toISOString().split('T')[0]
    
    console.log('Room data received:', room)
    
    // Use the calculated dates from the API (which follow tenant's billing cycle)
    let rentFrom = room.next_period_start
    let rentTo = room.next_period_end
    
    // Format dates if they exist but are not in the right format
    if (rentFrom && typeof rentFrom === 'string') {
      rentFrom = new Date(rentFrom).toISOString().split('T')[0]
    }
    if (rentTo && typeof rentTo === 'string') {
      rentTo = new Date(rentTo).toISOString().split('T')[0]
    }
    
    console.log('Processed dates from API - From:', rentFrom, 'To:', rentTo)
    
    // Only use fallback if API data is completely missing or invalid
    if (!rentFrom || !rentTo || rentFrom === 'Invalid Date' || rentTo === 'Invalid Date') {
      console.warn('API billing period data missing or invalid, using fallback calculation')
      
      // Fallback: Try to calculate based on tenant's rent_start if available
      if (room.rent_start) {
        const rentStartDate = new Date(room.rent_start)
        const rentStartDay = rentStartDate.getDate()
        
        // Calculate current billing period based on tenant's rent start day
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()
        
        // Start from the tenant's billing day in current month
        let periodStart = new Date(currentYear, currentMonth, rentStartDay)
        
        // If we're past the billing day, move to next month
        if (now.getDate() > rentStartDay) {
          periodStart = new Date(currentYear, currentMonth + 1, rentStartDay)
        }
        
        // End date is one day before next month's billing day
        const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, rentStartDay - 1)
        
        rentFrom = periodStart.toISOString().split('T')[0]
        rentTo = periodEnd.toISOString().split('T')[0]
        
        console.log('Calculated fallback dates based on rent_start - From:', rentFrom, 'To:', rentTo)
      } else {
        // Last resort: use current month (1st to last day)
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        
        rentFrom = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
        rentTo = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
        
        console.warn('Using last resort fallback dates (current month) - From:', rentFrom, 'To:', rentTo)
      }
    }
    
    const formData = {
      tenant_id: room.tenant_id,
      room_id: room.room_id,
      rent_from: rentFrom,
      rent_to: rentTo,
      rent_amount: room.monthly_rent,
      electric_previous_reading: room.previous_reading || 0,
      electric_present_reading: '',
      electric_consumption: 0,
      electric_amount: 0,
      electric_reading_date: today,
      electric_previous_date: room.previous_reading_date || rentFrom,
      water_amount: 200,
      extra_fee_amount: 0,
      extra_fee_description: '',
      total_amount: parseFloat(room.monthly_rent) + 200
    }
    
    console.log('Final form data:', formData)
    setBillFormData(formData)
    setShowBillModal(true)
  }

  const calculateElectricAmount = (presentReading) => {
    const present = parseFloat(presentReading) || 0
    const previous = parseFloat(billFormData.electric_previous_reading) || 0
    const consumption = Math.max(0, present - previous)
    const rate = currentElectricRate
    const amount = consumption * rate
    
    setBillFormData(prev => ({
      ...prev,
      electric_present_reading: presentReading,
      electric_consumption: consumption,
      electric_amount: amount,
      total_amount: parseFloat(prev.rent_amount) + amount + parseFloat(prev.water_amount) + parseFloat(prev.extra_fee_amount || 0)
    }))
  }

  const handleBillSubmit = async (e) => {
    e.preventDefault()
    
    if (!billFormData.electric_present_reading) {
      toast.error('Please enter the present electricity reading')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...billFormData,
          bill_date: new Date().toISOString().split('T')[0],
          status: 'unpaid',
          prepared_by: 'Admin'
        })
      })

      const data = await response.json()
      
      if (data.success) {
        toast.success('Bill created and sent to tenant successfully!')
        setShowBillModal(false)
        resetBillForm()
        fetchData()
      } else {
        toast.error(data.message || 'Failed to create bill')
      }
    } catch (error) {
      console.error('Error creating bill:', error)
      toast.error('Failed to create bill')
    } finally {
      setLoading(false)
    }
  }

  // Payment functions
  const openPaymentModal = (bill) => {
    setSelectedBill(bill)
    setPaymentFormData({
      payment_amount: bill.status === 'partial' ? bill.remaining_balance : bill.total_amount,
      payment_method: 'regular',
      payment_type: 'cash',
      actual_payment_date: new Date().toISOString().split('T')[0], // Default to today
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

  // Filter active bills (unpaid and partial) bills
  const activeBills = bills.filter(bill => bill.status !== 'paid')

  // Filter rooms and bills by branch
  const filteredRooms = branchFilter 
    ? rooms.filter(room => room.branch_name === branchFilter)
    : rooms

  const filteredActiveBills = branchFilter
    ? activeBills.filter(bill => bill.branch_name === branchFilter)
    : activeBills

  // Filter ALL bills by branch (for comprehensive view)
  const filteredAllBills = branchFilter
    ? bills.filter(bill => bill.branch_name === branchFilter)
    : bills

  // Debug logging for filtering
  if (branchFilter) {
    console.log('Branch filter applied:', branchFilter)
    console.log('Total rooms:', rooms.length)
    console.log('Filtered rooms:', filteredRooms.length)
    console.log('Sample room branch names:', rooms.slice(0, 3).map(r => ({ room: r.room_number, branch: r.branch_name })))
    console.log('Total bills:', bills.length)
    console.log('Filtered bills:', filteredAllBills.length)
  }

  // Sort bills: unpaid first, then partial, then paid
  const sortedFilteredBills = filteredAllBills.sort((a, b) => {
    const statusOrder = { 'unpaid': 0, 'overdue': 1, 'partial': 2, 'paid': 3 }
    return statusOrder[a.status] - statusOrder[b.status]
  })

  const handlePaymentSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

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
          payment_method: paymentFormData.payment_method,
          payment_type: paymentFormData.payment_type,
          actual_payment_date: paymentFormData.actual_payment_date,
          notes: paymentFormData.notes
        })
      })

      const data = await response.json()

      if (data.success) {
        // Show success message with receipt status
        let message = 'Payment processed successfully!'
        if (data.receipt) {
          if (data.receipt.email_sent) {
            message += ` Receipt sent to ${data.receipt.recipient}.`
          } else if (data.receipt.recipient) {
            message += ` Note: Receipt email failed to send to ${data.receipt.recipient}.`
          } else {
            message += ' Note: No email address on file for receipt.'
          }
        }
        
        toast.success(message)
        setShowPaymentModal(false)
        setPaymentFormData({
          payment_amount: '',
          payment_method: 'regular',
          payment_type: 'cash',
          actual_payment_date: new Date().toISOString().split('T')[0],
          notes: ''
        })
        fetchData() // Refresh data
      } else {
        toast.error('Error: ' + data.message)
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Error processing payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sendReceipt = async (billId) => {
    try {
      setLoading(true)
      const response = await fetch('/api/payments/send-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ bill_id: billId })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Receipt sent successfully!')
      } else {
        toast.error('Error: ' + data.message)
      }
    } catch (error) {
      console.error('Send receipt error:', error)
      toast.error('Error sending receipt. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-PH')
  }

  // Calculate penalty fee for late payments
  const calculatePenaltyFee = (bill, actualPaymentDate) => {
    if (!actualPaymentDate || bill.penalty_applied) return 0
    
    // Normalize dates to midnight for proper comparison
    const paymentDate = new Date(actualPaymentDate)
    paymentDate.setHours(0, 0, 0, 0)
    
    const billDate = new Date(bill.bill_date)
    billDate.setHours(0, 0, 0, 0)
    
    const dueDate = new Date(bill.due_date || billDate.getTime() + (10 * 24 * 60 * 60 * 1000))
    dueDate.setHours(0, 0, 0, 0)
    
    if (paymentDate > dueDate) {
      return parseFloat(bill.total_amount) * 0.01 // 1% penalty
    }
    
    return 0
  }

  const getBillingStatusBadge = (status, daysUntilDue) => {
    switch (status) {
      case 'needs_billing':
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            daysUntilDue <= 0 ? 'bg-red-100 text-red-800' : 
            daysUntilDue <= 3 ? 'bg-orange-100 text-orange-800' : 
            'bg-green-100 text-green-800'
          }`}>
            {daysUntilDue <= 0 ? 'Overdue' : daysUntilDue <= 3 ? 'Due Soon' : 'Needs Bill'}
          </span>
        )
      case 'already_billed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Billed</span>
      case 'no_tenant':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">No Tenant</span>
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Up to Date</span>
    }
  }

  if (loading && bills.length === 0) {
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
      <Toaster position="top-right" />
      <DashboardLayout>
        <div className="px-4 sm:px-6 lg:px-8 pb-6">
          {/* Header */}
          <div className="sm:flex sm:items-center mb-6 pt-6">
            <div className="sm:flex-auto">
              <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
              <p className="mt-2 text-sm text-gray-700">
                Generate bills for each room individually using the room cards below
              </p>
            </div>
          </div>

          {/* Branch Filter */}
          <div className="mb-6">
            <div className="max-w-sm">
              <label htmlFor="branch-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Branch
              </label>
              <select
                id="branch-filter"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Room Cards Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Room Billing Status
              {branchFilter && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  - {branchFilter} ({filteredRooms.length} rooms)
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRooms.map((room) => (
                <div
                  key={room.room_id}
                  className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <HomeIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">Room {room.room_number}</h3>
                          {room.tenant_name && room.days_until_due !== null && (
                            <div className={`text-xs font-medium ${
                              room.days_until_due <= 0 ? 'text-red-600' : 
                              room.days_until_due <= 3 ? 'text-orange-600' : 
                              'text-green-600'
                            }`}>
                              {room.days_until_due <= 0 ? 
                                `⚠️ ${Math.abs(room.days_until_due)} day${Math.abs(room.days_until_due) !== 1 ? 's' : ''} overdue` : 
                                `📅 Due in ${room.days_until_due} day${room.days_until_due !== 1 ? 's' : ''}`
                              }
                            </div>
                          )}
                        </div>
                      </div>
                      {getBillingStatusBadge(room.billing_status, room.days_until_due)}
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Tenant:</span>
                        <span className="font-medium">{room.tenant_name || 'No Tenant'}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Branch:</span>
                        <span className="font-medium text-blue-600">{room.branch_name}</span>
                      </div>
                      
                      {room.tenant_name && (
                        <>
                          {/* Current Billing Cycle - Minimal Gray */}
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                            <div className="text-xs text-gray-600 font-medium flex items-center">
                              <CalendarIcon className="h-3 w-3 mr-1 text-gray-400" />
                              {room.next_period_start ? formatDate(room.next_period_start) : formatDate(new Date())} - {room.next_period_end ? formatDate(room.next_period_end) : formatDate(new Date(Date.now() + 30*24*60*60*1000))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      {room.billing_status === 'needs_billing' && room.tenant_name ? (
                        <button
                          onClick={() => openGenerateBillModal(room)}
                          className={`w-full inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white ${
                            room.days_until_due <= 0 ? 'bg-red-600 hover:bg-red-700' : 
                            room.days_until_due <= 3 ? 'bg-orange-600 hover:bg-orange-700' : 
                            'bg-green-600 hover:bg-green-700'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                        >
                          <BoltIcon className="h-4 w-4 mr-1" />
                          Generate Bill
                        </button>
                      ) : room.billing_status === 'already_billed' ? (
                        <button
                          disabled
                          className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
                        >
                          Bill Sent
                        </button>
                      ) : room.billing_status === 'no_tenant' ? (
                        <button
                          disabled
                          className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
                        >
                          No Tenant
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-500 bg-gray-100 cursor-not-allowed"
                        >
                          Up to Date
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bills List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                All Bills
                {branchFilter && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    - {branchFilter} ({sortedFilteredBills.length} bills)
                  </span>
                )}
              </h3>
              
              {branchFilter && sortedFilteredBills.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 text-xs">
                  {['unpaid', 'overdue', 'partial', 'paid'].map(status => {
                    const count = sortedFilteredBills.filter(bill => bill.status === status).length
                    if (count === 0) return null
                    return (
                      <span key={status} className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${
                        status === 'paid' ? 'bg-green-100 text-green-800' :
                        status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {count} {status}
                      </span>
                    )
                  })}
                </div>
              )}
              
              <ul className="divide-y divide-gray-200">
                {sortedFilteredBills.map((bill) => (
                  <li key={bill.id}>
                    <div className="px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <DocumentTextIcon className="h-10 w-10 text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-blue-600">
                                {bill.tenant_name} - Room {bill.room_number}
                              </p>
                              <span className="ml-2 text-xs text-gray-500">
                                ({bill.branch_name})
                              </span>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                bill.status === 'paid' 
                                  ? 'bg-green-100 text-green-800'
                                  : bill.status === 'partial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : bill.status === 'overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
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
                              {bill.status === 'partial' ? (
                                <>
                                  <span className="text-red-600">{formatCurrency(bill.remaining_balance)}</span>
                                  <span className="text-sm text-gray-500 block">
                                    of {formatCurrency(bill.total_amount)}
                                  </span>
                                </>
                              ) : (
                                formatCurrency(bill.total_amount)
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              Bill Date: {formatDate(bill.bill_date)}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            {(bill.status === 'unpaid' || bill.status === 'partial') && (
                              <button 
                                onClick={() => openPaymentModal(bill)}
                                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                title="Process Payment"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Bill breakdown */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Rent:</span>
                          <span className="ml-2 font-medium">{formatCurrency(bill.rent_amount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Electric:</span>
                          <span className="ml-2 font-medium">{formatCurrency(bill.electric_amount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Water:</span>
                          <span className="ml-2 font-medium">{formatCurrency(bill.water_amount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Extra:</span>
                          <span className="ml-2 font-medium">{formatCurrency(bill.extra_fee_amount || 0)}</span>
                        </div>
                      </div>
                      
                      {/* Payment information for partial payments */}
                      {bill.status === 'partial' && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Total Paid:</span>
                              <span className="ml-2 font-medium text-green-600">{formatCurrency(bill.total_paid)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Remaining:</span>
                              <span className="ml-2 font-medium text-red-600">{formatCurrency(bill.remaining_balance)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Generate Bill Modal */}
        {showBillModal && selectedRoom && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Generate Bill - Room {selectedRoom.room_number}</h3>
                <button
                  onClick={() => {
                    setShowBillModal(false)
                    resetBillForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleBillSubmit} className="space-y-6">
                {/* Billing Period */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Billing Period</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From</label>
                      <input
                        type="date"
                        value={billFormData.rent_from}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">To</label>
                      <input
                        type="date"
                        value={billFormData.rent_to}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Monthly Rent</label>
                      <input
                        type="number"
                        value={billFormData.rent_amount}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Electricity Section */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-3">Electricity Reading</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Previous Reading</label>
                      <input
                        type="number"
                        value={billFormData.electric_previous_reading}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Date: {billFormData.electric_previous_date}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Present Reading *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={billFormData.electric_present_reading}
                        onChange={(e) => calculateElectricAmount(e.target.value)}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter current meter reading"
                      />
                      <p className="text-xs text-gray-500 mt-1">Date: {billFormData.electric_reading_date}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Consumption</label>
                      <input
                        type="number"
                        value={billFormData.electric_consumption}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">kWh consumed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Electric Amount</label>
                      <input
                        type="number"
                        value={billFormData.electric_amount}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">₱{currentElectricRate.toLocaleString('en-PH', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })} per kWh</p>
                    </div>
                  </div>
                </div>

                {/* Water Section */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Water (Fixed Rate)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Water Amount</label>
                      <input
                        type="number"
                        value={billFormData.water_amount}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Fixed monthly rate</p>
                    </div>
                  </div>
                </div>

                {/* Extra Fees Section */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Extra Fees (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={billFormData.extra_fee_amount}
                        onChange={(e) => {
                          setBillFormData(prev => ({
                            ...prev, 
                            extra_fee_amount: e.target.value,
                            total_amount: parseFloat(prev.rent_amount) + parseFloat(prev.electric_amount) + parseFloat(prev.water_amount) + parseFloat(e.target.value || 0)
                          }))
                        }}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <input
                        type="text"
                        value={billFormData.extra_fee_description}
                        onChange={(e) => setBillFormData(prev => ({...prev, extra_fee_description: e.target.value}))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Maintenance fee"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Amount */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="text-lg font-bold text-green-900">Total Amount Due</h4>
                    <span className="text-2xl font-bold text-green-900">{formatCurrency(billFormData.total_amount)}</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBillModal(false)
                      resetBillForm()
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !billFormData.electric_present_reading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending...' : 'Send Bill to Tenant'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
                  {selectedBill.penalty_fee_amount > 0 && (
                    <div className="col-span-2">
                      <span className="text-red-600 font-medium">Penalty Fee Applied:</span>
                      <span className="ml-2 text-red-600 font-medium">{formatCurrency(selectedBill.penalty_fee_amount)}</span>
                      <span className="ml-2 text-xs text-gray-500">(1% late payment fee)</span>
                    </div>
                  )}
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
                    onChange={(e) => setPaymentFormData(prev => ({...prev, payment_amount: e.target.value}))}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter payment amount"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedBill.status === 'partial' 
                      ? `Remaining balance: ${formatCurrency(selectedBill.remaining_balance)} (editable for partial payments)`
                      : `Full amount: ${formatCurrency(selectedBill.total_amount)} (editable for partial payments)`
                    }
                  </p>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={paymentFormData.payment_method}
                    onChange={(e) => {
                      setPaymentFormData(prev => ({
                        ...prev, 
                        payment_method: e.target.value,
                        payment_type: e.target.value === 'regular' ? 'cash' : 'advance'
                      }))
                    }}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="regular">Regular Payment</option>
                    <option value="deposit">Use Deposit</option>
                  </select>
                </div>

                {/* Payment Type */}
                {paymentFormData.payment_method === 'regular' ? (
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
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deposit Type *
                    </label>
                    <select
                      value={paymentFormData.payment_type}
                      onChange={(e) => setPaymentFormData(prev => ({...prev, payment_type: e.target.value}))}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="advance">Advance Deposit (Rent Only)</option>
                      <option value="security">Security Deposit (All Fees)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {paymentFormData.payment_type === 'advance' 
                        ? 'Advance deposit can only be used for monthly rent'
                        : 'Security deposit can be used for rent, electricity, and other fees'
                      }
                    </p>
                  </div>
                )}

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
                    Date when tenant actually made the payment. Late payments (more than 10 days after bill date) will incur a 1% penalty fee.
                  </p>
                </div>

                {/* Penalty Fee Warning */}
                {(() => {
                  const penaltyFee = calculatePenaltyFee(selectedBill, paymentFormData.actual_payment_date)
                  if (penaltyFee > 0) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <h4 className="text-sm font-medium text-red-800">Late Payment Penalty</h4>
                            <p className="text-sm text-red-700 mt-1">
                              A 1% penalty fee of <strong>{formatCurrency(penaltyFee)}</strong> will be added to this bill for late payment.
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                              New total: <strong>{formatCurrency(parseFloat(selectedBill.total_amount) + penaltyFee)}</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

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
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Process Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </DashboardLayout>
    </>
  )
} 