'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  UsersIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  HomeIcon,
  PhoneIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])
  const [billingRates, setBillingRates] = useState({ electric_rate_per_kwh: 11.00 }) // Default fallback
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [showMoveOutOptionsModal, setShowMoveOutOptionsModal] = useState(false)
  const [deletingTenant, setDeletingTenant] = useState(null)
  const [renewingTenant, setRenewingTenant] = useState(null)
  const [deletionInfo, setDeletionInfo] = useState(null)
  const [renewalData, setRenewalData] = useState({ duration_months: 6 })
  const [moveOutOptions, setMoveOutOptions] = useState({
    reason_for_leaving: 'contract_completed',
    final_electric_reading: 0,
    notes: '',
    create_final_bill: true,
    final_bill_rent_from: '',
    final_bill_rent_to: '',
    water_amount: 0,
    extra_fee_amount: 0,
    extra_fee_description: '',
    can_complete_moveout: false,
    outstanding_amount: 0,
    deposit_balance: 0,
    breakdown: null
  })
  const [editingTenant, setEditingTenant] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    room_id: '',
    rent_start: '',
    initial_electric_reading: '',
    advance_payment: '',
    security_deposit: '',
    advance_payment_status: 'unpaid',
    security_deposit_status: 'unpaid'
  })
  const [roomBranchFilter, setRoomBranchFilter] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  // Helper function to get electricity rate for a tenant (branch-specific or global fallback)
  const getElectricityRate = (tenantInfo = null) => {
    if (tenantInfo && tenantInfo.room_id) {
      // Find the room for this tenant
      const allRooms = [...rooms, ...tenants.map(t => ({ id: t.room_id, branch_id: t.branch_id, branch_name: t.branch_name })).filter(Boolean)]
      const tenantRoom = allRooms.find(r => r.id === tenantInfo.room_id)
      
      if (tenantRoom && tenantRoom.branch_id) {
        // Find the branch to get its electricity rate
        const branch = branches.find(b => b.id === tenantRoom.branch_id)
        if (branch && branch.electricity_rate) {
          return parseFloat(branch.electricity_rate)
        }
      }
    }
    
    // Fallback to global billing rate or default
    return parseFloat(billingRates.electric_rate_per_kwh) || 11.00
  }

  const fetchData = async () => {
    try {
      const { api } = await import('../../lib/api')
      const [tenantsData, roomsData, branchesData, ratesData] = await Promise.all([
        api.getTenants(),
        api.getRooms(),
        api.getBranches(),
        fetch('/api/settings/billing-rates', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).then(res => res.json())
      ])
      
      setTenants(tenantsData.tenants || [])
      setRooms(roomsData.rooms?.filter(room => room.status === 'vacant') || [])
      setBranches(branchesData.branches || [])
      setBillingRates(ratesData.rates || { electric_rate_per_kwh: 11.00 })
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { api } = await import('../../lib/api')
      
      if (editingTenant) {
        // When updating, we need to handle room changes
        const roomChanged = editingTenant.room_id !== formData.room_id
        
        await api.updateTenant(editingTenant.id, {
          ...formData,
          previous_room_id: roomChanged ? editingTenant.room_id : undefined
        })
        toast.success('Tenant updated successfully')
      } else {
        await api.createTenant(formData)
        toast.success('Tenant created successfully')
      }
      
      setShowModal(false)
      setEditingTenant(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving tenant:', error)
      toast.error(error.message || 'Failed to save tenant')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (tenant) => {
    setEditingTenant(tenant)
    
    // First, fetch the current room if it exists
    if (tenant.room_id) {
      const { api } = await import('../../lib/api')
      const roomsData = await api.getRooms()
      const allRooms = roomsData.rooms || []
      
      // When editing, we need to include the tenant's current room in the room list
      // even if it's occupied (since it's occupied by this tenant)
      setRooms(allRooms.filter(room => 
        room.status === 'vacant' || room.id === tenant.room_id
      ))
      
      // Set the branch filter to match the tenant's current room's branch
      const currentRoom = allRooms.find(r => r.id === tenant.room_id)
      if (currentRoom) {
        setRoomBranchFilter(currentRoom.branch_name)
      }
    }
    
    // Set form data with existing tenant info - exclude deposit fields when editing
    setFormData({
      name: tenant.name || '',
      mobile: tenant.mobile ? tenant.mobile.replace(/^\+63/, '') : '9', // Remove +63 prefix if exists, default to '9'
      email: tenant.email || '',
      room_id: tenant.room_id || '',
      rent_start: tenant.rent_start?.split('T')[0] || '',
      initial_electric_reading: tenant.initial_electric_reading || 0
    })
    
    setShowModal(true)
  }

  const handleMoveOut = async (tenant) => {
    try {
      setDeletingTenant(tenant)
      const { api } = await import('../../lib/api')
      
      // Get deletion info first (with cache busting)
      const info = await api.getTenantDeletionInfo(tenant.id)
      setDeletionInfo(info)
      
      // Count paid billing cycles for this tenant
      const paidCyclesResult = await fetch(`/api/tenants/${tenant.id}/paid-cycles`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      const paidCyclesData = await paidCyclesResult.json()
      const paidCycles = paidCyclesData.paid_cycles || 0
      
      console.log('Tenant paid cycles:', paidCycles)
      
      // Determine termination type based on paid cycles
      // If tenant has completed 5 or more cycles, it's normal termination
      // Otherwise it's early termination
      const isNormalTermination = paidCycles >= 5
      const defaultReason = isNormalTermination ? 'normal_termination' : 'early_termination'
      
      console.log('Termination type:', {
        paidCycles,
        isNormalTermination,
        defaultReason
      })
      
      // Calculate final bill period - should start from CURRENT billing cycle start date
      const today = new Date()
      const todayString = today.toISOString().split('T')[0]
      
      // Get current billing cycle start date from API info
      let currentBillingStartDate = info.billing_info?.next_bill_start_date
      
      // Fallback calculation if API doesn't provide the correct date
      if (!currentBillingStartDate && info.billing_info?.last_bill_end_date) {
        const lastEndDate = new Date(info.billing_info.last_bill_end_date)
        lastEndDate.setDate(lastEndDate.getDate() + 1) // Add 1 day
        currentBillingStartDate = lastEndDate.toISOString().split('T')[0]
        console.log('Calculated fallback next bill start date:', currentBillingStartDate)
      }
      
      // Final bill should cover the current billing cycle from start to move-out date
      const finalBillStartDate = currentBillingStartDate
      const finalBillEndDate = todayString // Default to today, user can change
      
      console.log('Final billing period calculated:', {
        finalBillStartDate,
        finalBillEndDate,
        todayString,
        apiData: info.billing_info
      })
      
      setMoveOutOptions(prev => ({
        ...prev,
        reason_for_leaving: defaultReason,
        final_electric_reading: 0,
        notes: `Tenant moved out on ${new Date().toLocaleDateString()}`,
        create_final_bill: true,
        final_bill_rent_from: finalBillStartDate, // Start from current billing cycle start
        final_bill_rent_to: finalBillEndDate, // Default to today, user can adjust
        water_amount: 0, // Will be calculated based on prorated period
        extra_fee_amount: 0,
        extra_fee_description: '',
        can_complete_moveout: false, // Reset to false when opening modal
        outstanding_amount: 0,
        deposit_balance: 0,
        breakdown: null,
        paid_cycles: paidCycles,
        is_normal_termination: isNormalTermination
      }))
      
      setShowDeleteModal(true)
      
    } catch (error) {
      console.error('Error getting move-out info:', error)
      toast.error('Failed to get tenant information')
    }
  }

  const handleRenewContract = async (tenant) => {
    try {
      setRenewingTenant(tenant)
      setRenewalData({ duration_months: 6 })
      setShowRenewModal(true)
    } catch (error) {
      console.error('Error preparing contract renewal:', error)
      toast.error('Failed to prepare contract renewal')
    }
  }

  const confirmMoveOut = async () => {
    if (!deletingTenant) return

    try {
      setLoading(true)
      
      // Handle force termination differently - directly archive tenant without creating bills
      if (moveOutOptions.reason_for_leaving === 'force_termination') {
        const forceTerminationResponse = await fetch(`/api/tenants/${deletingTenant.id}/force-terminate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: moveOutOptions.notes || `Force terminated on ${new Date().toLocaleDateString()}`
          })
        })

        if (!forceTerminationResponse.ok) {
          throw new Error(`Failed to force terminate: ${forceTerminationResponse.status} ${forceTerminationResponse.statusText}`)
        }

        const terminationData = await forceTerminationResponse.json()
        
        if (terminationData.success) {
          toast.success('Tenant force terminated')
          setShowDeleteModal(false)
          setDeletingTenant(null)
          setDeletionInfo(null)
          fetchData()
          return
        } else {
          throw new Error(terminationData.message || 'Failed to force terminate tenant')
        }
      }
      
      // For normal and early termination, proceed with regular move-out process
      
      // Calculate prorated rent amount
      const fromDate = new Date(moveOutOptions.final_bill_rent_from)
      const toDate = new Date(moveOutOptions.final_bill_rent_to)
      const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
      const monthlyRent = parseFloat(deletionInfo.tenant_info.monthly_rent)
      const dailyRate = monthlyRent / 30
      const proratedRent = Math.round(dailyRate * daysDiff) // Round to whole number
      
      // Calculate electricity
      const electricConsumption = Math.max(0, moveOutOptions.final_electric_reading - (deletionInfo.billing_info?.last_electric_reading || 0))
      
      // Check if a final bill already exists for this period
      const checkBillResponse = await fetch(`/api/bills/check-existing?tenant_id=${deletingTenant.id}&rent_from=${moveOutOptions.final_bill_rent_from}&rent_to=${moveOutOptions.final_bill_rent_to}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      let data
      if (checkBillResponse.ok) {
        const checkData = await checkBillResponse.json()
        if (checkData.exists) {
          console.log('Final bill already exists:', checkData.bill_id)
          data = { success: true, bill_id: checkData.bill_id, message: 'Using existing final bill' }
        }
      }

      if (!data) {
        // Use intelligent move-out process
        const moveOutData = {
          reason_for_leaving: moveOutOptions.reason_for_leaving,
          notes: moveOutOptions.notes,
          final_electric_reading: moveOutOptions.final_electric_reading,
          final_bill_rent_from: moveOutOptions.final_bill_rent_from,
          final_bill_rent_to: moveOutOptions.final_bill_rent_to,
          water_amount: moveOutOptions.water_amount || 0,
          extra_fee_amount: moveOutOptions.extra_fee_amount || 0,
          extra_fee_description: moveOutOptions.extra_fee_description || '',
          paid_cycles: moveOutOptions.paid_cycles || 0,
          is_normal_termination: moveOutOptions.is_normal_termination || false
        }

        console.log('Processing move-out with data:', moveOutData)

        const moveOutResponse = await fetch(`/api/tenants/${deletingTenant.id}/move-out`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(moveOutData)
        })

        if (!moveOutResponse.ok) {
          let errorMessage = `Failed to process move-out: ${moveOutResponse.status} ${moveOutResponse.statusText}`
          try {
            const errorData = await moveOutResponse.json()
            if (errorData.message) {
              errorMessage = errorData.message
            }
          } catch (e) {
            console.error('Could not parse move-out error response:', e)
          }
          throw new Error(errorMessage)
        }

        data = await moveOutResponse.json()
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to process move-out')
        }
      }

      if (data.success) {
        if (data.action === 'refund_bill_created') {
          // Case: Deposits cover all bills + refund due - REFUND BILL created
          if (data.bill_type === 'refund') {
            toast.success('Refund bill created')
            
            setShowDeleteModal(false)
            setDeletingTenant(null)
            setDeletionInfo(null)
            fetchData()
            return
          }
        } else if (data.action === 'final_bill_created') {
          // Handle different types of final bills
          if (data.bill_type === 'final') {
            // Case: Outstanding balance - tenant must pay
            toast.success('Final bill created')
          } else if (data.bill_type === 'final_exact') {
            // Case: Deposits exactly cover bills
            toast.success('Final bill created')
          }
          
          // Common handling for final bills - simplified
          
          // Try to auto-pay with deposits if available (for contract completion)
          if (moveOutOptions.reason_for_leaving === 'contract_completed' && data.deposit_balance > 0) {
            try {
              const autoPayResponse = await fetch('/api/payments/auto-pay-with-deposits', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  bill_id: data.bill_id,
                  use_advance_deposit: true,
                  use_security_deposit: true
                })
              })
              
              const paymentData = await autoPayResponse.json()
              
              if (paymentData.success) {
                if (paymentData.fully_paid) {
                  toast.success('Bill paid successfully')
                } else {
                  toast.error('Partial payment made')
                }
              }
            } catch (paymentError) {
              console.error('Auto-payment error:', paymentError)
            }
          }
          
          setShowDeleteModal(false)
          setDeletingTenant(null)
          setDeletionInfo(null)
          fetchData()
          return
        }
      }

      setShowDeleteModal(false)
      setDeletingTenant(null)
      setDeletionInfo(null)
      fetchData()
    } catch (error) {
      console.error('Move-out error:', error)
      toast.error('Move-out failed')
    } finally {
      setLoading(false)
    }
  }

  const confirmRenewal = async () => {
    if (!renewingTenant) return

    try {
      const { api } = await import('../../lib/api')
      const result = await api.renewContract(renewingTenant.id, renewalData)
      
      toast.success('Contract renewed successfully')
      
      setShowRenewModal(false)
      setRenewingTenant(null)
      setRenewalData({ duration_months: 6 })
      fetchData()
    } catch (error) {
      console.error('Error renewing contract:', error)
      toast.error(error.message || 'Failed to renew contract')
    }
  }

  const handleCompleteMovOut = async () => {
    if (moveOutOptions.final_electric_reading === null || moveOutOptions.final_electric_reading === undefined || moveOutOptions.final_electric_reading === '' || moveOutOptions.final_electric_reading === 0) {
      toast.error('Enter electricity reading')
      return
    }

    setLoading(true)
    try {
      // Calculate final bill amounts
      const fromDate = new Date(moveOutOptions.final_bill_rent_from)
      const toDate = new Date(moveOutOptions.final_bill_rent_to)
      
      // Validate date range
      if (toDate < fromDate) {
        throw new Error('Invalid billing period: end date cannot be before start date')
      }
      
      const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
      const monthlyRent = parseFloat(deletionInfo.tenant_info.monthly_rent)
              const dailyRate = monthlyRent / 30
        const proratedRent = Math.max(Math.round(dailyRate * daysDiff), 1) // Round to whole number, ensure minimum ₱1
      
      const electricConsumption = Math.max(0, moveOutOptions.final_electric_reading - (deletionInfo.billing_info?.last_electric_reading || 0))
      
      console.log('Billing calculation:', {
        fromDate: moveOutOptions.final_bill_rent_from,
        toDate: moveOutOptions.final_bill_rent_to,
        daysDiff,
        monthlyRent,
        dailyRate,
        proratedRent,
        electricConsumption
      })

      // Check if a final bill already exists for this period
      const checkBillResponse = await fetch(`/api/bills/check-existing?tenant_id=${deletingTenant.id}&rent_from=${moveOutOptions.final_bill_rent_from}&rent_to=${moveOutOptions.final_bill_rent_to}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      let billResult
      if (checkBillResponse.ok) {
        const checkData = await checkBillResponse.json()
        if (checkData.exists) {
          console.log('Using existing final bill:', checkData.bill_id)
          billResult = { bill_id: checkData.bill_id, success: true }
        }
      }

      if (!billResult) {
        // Use intelligent move-out process
        const moveOutData = {
          reason_for_leaving: moveOutOptions.reason_for_leaving,
          notes: moveOutOptions.notes,
          final_electric_reading: moveOutOptions.final_electric_reading,
          final_bill_rent_from: moveOutOptions.final_bill_rent_from,
          final_bill_rent_to: moveOutOptions.final_bill_rent_to,
          water_amount: moveOutOptions.water_amount || 0,
          extra_fee_amount: moveOutOptions.extra_fee_amount || 0,
          extra_fee_description: moveOutOptions.extra_fee_description || ''
        }

        console.log('Creating final bill with deposits using intelligent move-out:', moveOutData)

        const billResponse = await fetch(`/api/tenants/${deletingTenant.id}/move-out`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(moveOutData)
        })

        if (!billResponse.ok) {
          let errorMessage = `Failed to process move-out: ${billResponse.status} ${billResponse.statusText}`
          try {
            const errorData = await billResponse.json()
            if (errorData.message) {
              errorMessage = errorData.message
            }
          } catch (e) {
            // If JSON parsing fails, use the status text
            console.error('Could not parse move-out error response:', e)
          }
          console.error('Move-out error:', billResponse.status, errorMessage)
          throw new Error(errorMessage)
        }

        billResult = await billResponse.json()

        if (!billResult.success) {
          throw new Error(billResult.message || 'Failed to process move-out')
        }

        console.log('Move-out processed:', billResult.action, billResult.bill_id)
      }

      // Now automatically process move out with advance deposit payment
      const moveOutResponse = await fetch('/api/tenants/complete-moveout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bill_id: billResult.bill_id,
          tenant_id: deletingTenant.id,
          termination_reason: moveOutOptions.reason_for_leaving
        })
      })

      if (!moveOutResponse.ok) {
        let errorMessage = `Failed to complete move out: ${moveOutResponse.status} ${moveOutResponse.statusText}`
        try {
          const errorData = await moveOutResponse.json()
          if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch (e) {
          // If JSON parsing fails, use the status text
          console.error('Could not parse error response:', e)
        }
        console.error('Move out error:', moveOutResponse.status, errorMessage)
        throw new Error(errorMessage)
      }

      const moveOutData = await moveOutResponse.json()

      if (moveOutData.success) {
        let message = '🏠 Move out completed successfully!\n\n'
        
        // Payment details
        if (moveOutData.advance_used > 0) {
          message += `💰 Advance deposit used: ₱${moveOutData.advance_used.toLocaleString()}\n`
        }
        
        if (moveOutData.advance_refund > 0) {
          message += `💵 Advance refund due: ₱${moveOutData.advance_refund.toLocaleString()}\n`
        }
        
        if (moveOutData.outstanding_balance > 0) {
          message += `⚠️ Outstanding balance: ₱${moveOutData.outstanding_balance.toLocaleString()} (bill sent to tenant)\n`
        }
        
        // Status update
        toast.success('Move-out completed')
        
        setShowDeleteModal(false)
        setDeletingTenant(null)
        setDeletionInfo(null)
        fetchData() // Refresh tenant list
      } else {
        throw new Error(moveOutData.message || 'Failed to complete move out')
      }
    } catch (error) {
      console.error('Error completing move out:', error)
      toast.error(error.message || 'Failed to complete move out')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '9', // Start with 9 (after +63 prefix)
      email: '',
      room_id: '',
      rent_start: '',
      initial_electric_reading: '', // Keep as empty string for better UX
      advance_payment: 3500.00, // Revert to default value
      security_deposit: 3500.00, // Revert to default value
      advance_payment_status: 'unpaid',
      security_deposit_status: 'unpaid'
    })
    setRoomBranchFilter('')
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.room_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBranch = !branchFilter || tenant.branch_name === branchFilter
    
    return matchesSearch && matchesBranch
  })

  // Function to get tenant deletion info
  const fetchDeletionInfo = async (tenantId) => {
    try {
      setLoading(true)
      console.log('Fetching deletion info for tenant ID:', tenantId)
      const response = await fetch(`/api/tenants/${tenantId}/deletion-info`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch tenant deletion info')
      }
      
      const data = await response.json()
      console.log('Tenant deletion info:', data)
      setDeletionInfo(data)
    } catch (error) {
      console.error('Error fetching tenant deletion info:', error)
      toast.error('Failed to load tenant information')
    } finally {
      setLoading(false)
    }
  }

  // Fetch tenants data
  const fetchTenantsData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tenants', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch tenants')
      }
      
      const data = await response.json()
      console.log('All tenants with IDs:', data.tenants.map(t => ({ id: t.id, name: t.name })))
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Error fetching tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  if (loading && tenants.length === 0) {
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
              <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage all tenants and their rental information
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <button
                onClick={() => {
                  resetForm()
                  setEditingTenant(null)
                  setRoomBranchFilter('')
                  setShowModal(true)
                }}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Tenant
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

          {/* Tenants Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTenants.map((tenant) => (
              <div key={tenant.id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <UsersIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {tenant.name}
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {tenant.room_number ? `Room ${tenant.room_number}` : 'No room assigned'}
                        </dd>
                      </dl>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center text-sm text-gray-500">
                      <PhoneIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                      {tenant.mobile}
                    </div>
                    {tenant.email && (
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <EnvelopeIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                        {tenant.email}
                      </div>
                    )}
                    {tenant.branch_name && (
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <HomeIcon className="flex-shrink-0 mr-1.5 h-4 w-4" />
                        {tenant.branch_name}
                      </div>
                    )}
                    {tenant.monthly_rent && (
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <span className="text-gray-400 mr-1.5">₱</span>
                        {parseFloat(tenant.monthly_rent).toLocaleString()}/month
                      </div>
                    )}
                  </div>

                  {/* Contract Status and Billing Progress */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        tenant.contract_status === 'active' || tenant.contract_status === 'renewed' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {tenant.contract_status || 'inactive'}
                      </span>
                      
                      {/* Billing Cycle Progress - Only show cycle count, no percentage */}
                      {(tenant.contract_status === 'active' || tenant.contract_status === 'renewed') && (
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-900">
                            {tenant.completed_cycles || 0}/{tenant.contract_duration_months || 6} cycles
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Edit Tenant"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      
                      {/* Contract Actions */}
                      {(tenant.contract_status === 'active' || tenant.contract_status === 'renewed') && (
                        <>
                          <button
                            onClick={() => handleRenewContract(tenant)}
                            className="text-green-600 hover:text-green-800 text-xs px-2 py-1 border border-green-300 rounded"
                            title="Renew Contract"
                          >
                            Renew
                          </button>
                          
                          <button
                            onClick={() => handleMoveOut(tenant)}
                            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-300 rounded flex items-center space-x-1"
                            title="Move Out Tenant"
                          >
                            <TrashIcon className="h-3 w-3" />
                            <span>Move Out</span>
                          </button>
                        </>
                      )}
                      
                      {tenant.contract_status !== 'active' && tenant.contract_status !== 'renewed' && (
                        <span className="text-gray-500 text-xs">
                          {tenant.contract_status === 'expired' ? 'Contract Expired' : 
                           tenant.contract_status === 'terminated' ? 'Terminated' : 
                           'Inactive'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTenants.length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tenants</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding a new tenant.
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {editingTenant ? 'Edit Tenant' : 'Add New Tenant'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Mobile *</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      +63
                    </span>
                    <input
                      type="tel"
                      required
                      value={formData.mobile}
                      onChange={(e) => {
                        const value = e.target.value
                        // Only allow digits and limit to 10 characters
                        const digitsOnly = value.replace(/\D/g, '')
                        if (digitsOnly.length <= 10) {
                          setFormData({...formData, mobile: digitsOnly})
                        }
                      }}
                      className="flex-1 block w-full rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="9XXXXXXXXX"
                      maxLength="10"
                      pattern="[0-9]{10}"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Enter 10 digits starting with 9 (e.g., 9171234567)
                    {editingTenant && formData.mobile && (
                      <span className="block mt-1 text-blue-600">
                        Current: +63{formData.mobile}
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Branch Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Filter by Branch</label>
                  <select
                    value={roomBranchFilter}
                    onChange={(e) => setRoomBranchFilter(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.name}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Room *</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a room</option>
                    {rooms
                      .filter(room => !roomBranchFilter || room.branch_name === roomBranchFilter)
                      .map(room => (
                        <option key={room.id} value={room.id}>
                          Room {room.room_number} - {room.branch_name} - ₱{parseFloat(room.monthly_rent || 0).toLocaleString()}/month
                        </option>
                      ))}
                  </select>
                  {roomBranchFilter ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Showing {rooms.filter(room => room.branch_name === roomBranchFilter).length} available rooms in {roomBranchFilter}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      Showing {rooms.length} available rooms from all branches
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rent Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.rent_start}
                    onChange={(e) => setFormData({...formData, rent_start: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Initial Electric Reading *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.initial_electric_reading}
                    onChange={(e) => setFormData({...formData, initial_electric_reading: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter initial electricity meter reading"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Record the electricity meter reading when the tenant moves in
                  </p>
                </div>

                {/* Only show deposit fields when creating a new tenant */}
                {!editingTenant && (
                  <>
                    <h4 className="block text-sm font-medium text-gray-700 mb-2">Deposit Information</h4>
                    <p className="text-xs text-gray-600 mb-4">
                      Please confirm that you have received the deposits by checking the boxes below
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Advance Payment */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Advance Payment</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.advance_payment}
                          onChange={(e) => {
                            const value = e.target.value
                            setFormData({...formData, advance_payment: value === '' ? '' : (parseFloat(value) || 0)})
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="mt-2">
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.advance_payment_status === 'paid'}
                              onChange={(e) => setFormData({
                                ...formData,
                                advance_payment_status: e.target.checked ? 'paid' : 'unpaid'
                              })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              required
                            />
                            <span className="ml-2 text-sm text-gray-600">Advance Payment Received *</span>
                          </label>
                        </div>
                      </div>

                      {/* Security Deposit */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Security Deposit</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.security_deposit}
                          onChange={(e) => {
                            const value = e.target.value
                            setFormData({...formData, security_deposit: value === '' ? '' : (parseFloat(value) || 0)})
                          }}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="mt-2">
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.security_deposit_status === 'paid'}
                              onChange={(e) => setFormData({
                                ...formData,
                                security_deposit_status: e.target.checked ? 'paid' : 'unpaid'
                              })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              required
                            />
                            <span className="ml-2 text-sm text-gray-600">Security Deposit Received *</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false)
                      resetForm()
                      setEditingTenant(null)
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : (editingTenant ? 'Update' : 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Move Out Modal */}
        {showDeleteModal && deletingTenant && deletionInfo && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Move-out Process - {deletingTenant.name} (Room {deletionInfo.tenant_info.room_number})
                </h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Add explanation of what will happen */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">What happens during move-out:</h4>
                <div className="text-sm text-blue-800">
                  {(() => {
                    if (moveOutOptions.final_bill_rent_from && moveOutOptions.final_bill_rent_to) {
                      const fromDate = new Date(moveOutOptions.final_bill_rent_from)
                      const toDate = new Date(moveOutOptions.final_bill_rent_to)
                      const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
                      const monthlyRent = parseFloat(deletionInfo.tenant_info.monthly_rent)
                      const dailyRate = monthlyRent / 30
                      const proratedRent = Math.round(dailyRate * daysDiff) // Round to whole number
                      const electricConsumption = Math.max(0, moveOutOptions.final_electric_reading - (deletionInfo.billing_info?.last_electric_reading || 0))
                      const electricRate = getElectricityRate(deletionInfo.tenant_info)
                      const electricAmount = electricConsumption * electricRate
                      const totalBillAmount = proratedRent + electricAmount + (moveOutOptions.water_amount || 0) + (moveOutOptions.extra_fee_amount || 0)
                      
                      // Calculate available deposits
                      const advanceBalance = deletionInfo.deposit_info?.advance_payment?.remaining_balance || 0
                      const securityBalance = deletionInfo.deposit_info?.security_deposit?.remaining_balance || 0
                      const usableDeposits = moveOutOptions.reason_for_leaving === 'early_termination' ? advanceBalance : (advanceBalance + securityBalance)
                      
                      if (totalBillAmount > 0) {
                        const refundableBalance = Math.max(0, usableDeposits - totalBillAmount)
                        const outstandingBalance = Math.max(0, totalBillAmount - usableDeposits)
                        const hasRefundableBalance = usableDeposits > totalBillAmount
                        const hasOutstandingBalance = totalBillAmount > usableDeposits
                        
                        if (hasRefundableBalance) {
                          return (
                            <div>
                              <p className="font-medium text-green-700">✅ Creating REFUND BILL</p>
                              <p>• Total bill amount: ₱{totalBillAmount.toFixed(2)}</p>
                              <p>• Available deposits: ₱{usableDeposits.toFixed(2)}</p>
                              <p>• Refund amount: ₱{refundableBalance.toFixed(2)}</p>
                              <p className="mt-2 text-sm">Deposits cover all bills. Admin will process the refund to complete move-out.</p>
                            </div>
                          )
                        } else if (hasOutstandingBalance) {
                          return (
                            <div>
                              <p className="font-medium text-orange-700">💳 Creating FINAL BILL</p>
                              <p>• Total bill amount: ₱{totalBillAmount.toFixed(2)}</p>
                              <p>• Available deposits: ₱{usableDeposits.toFixed(2)}</p>
                              <p>• Outstanding amount: ₱{outstandingBalance.toFixed(2)}</p>
                              <p className="mt-2 text-sm">Tenant must pay the outstanding amount to complete move-out.</p>
                            </div>
                          )
                        } else {
                          return (
                            <div>
                              <p className="font-medium text-blue-700">⚖️ Creating FINAL BILL</p>
                              <p>• Total bill amount: ₱{totalBillAmount.toFixed(2)}</p>
                              <p>• Available deposits: ₱{usableDeposits.toFixed(2)}</p>
                              <p>• Exact match - No outstanding or refund</p>
                              <p className="mt-2 text-sm">Deposits exactly cover all bills. Move-out will be completed automatically.</p>
                            </div>
                          )
                        }
                      } else {
                        return (
                          <div>
                            <p className="font-medium text-blue-700">ℹ️ No billing period to process</p>
                            <p>Tenant will be archived immediately.</p>
                          </div>
                        )
                      }
                    }
                    return <p>Configure the move-out details below to see what will happen.</p>
                  })()}
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); confirmMoveOut(); }} className="space-y-6">
                {/* Contract Termination Reason */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Contract Termination</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Leaving</label>
                    <select
                      value={moveOutOptions.reason_for_leaving}
                      onChange={(e) => setMoveOutOptions({...moveOutOptions, reason_for_leaving: e.target.value})}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      {moveOutOptions.paid_cycles >= 5 ? (
                        <option value="normal_termination">Normal Termination (5+ cycles completed)</option>
                      ) : (
                        <option value="early_termination">Early Termination (Less than 5 cycles)</option>
                      )}
                      <option value="force_termination">Force Termination (No bill, immediate archive)</option>
                    </select>
                    
                    {/* Add warning for early termination */}
                    {moveOutOptions.paid_cycles < 5 && moveOutOptions.reason_for_leaving === 'early_termination' && (
                      <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <div className="flex">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
                          <div>
                            <p className="font-medium">Early Termination Notice</p>
                            <p className="mt-1">Only {moveOutOptions.paid_cycles} out of 6 cycles completed. Under early termination:</p>
                            <ul className="mt-1 list-disc list-inside">
                              <li>Security deposit will be forfeited</li>
                              <li>Only advance deposit can be used for final bills</li>
                              <li>Any remaining advance deposit will be refunded</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Billing Period */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-3">Billing Period for Move-out</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From (Day after last bill ended)</label>
                      <input
                        type="date"
                        value={moveOutOptions.final_bill_rent_from}
                        onChange={(e) => setMoveOutOptions({...moveOutOptions, final_bill_rent_from: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Should be the day after your last billing period ended
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">To (Move-out Date)</label>
                      <input
                        type="date"
                        value={moveOutOptions.final_bill_rent_to}
                        onChange={(e) => setMoveOutOptions({...moveOutOptions, final_bill_rent_to: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This will create a prorated bill from your last billing period to the move-out date
                  </p>
                </div>

                {/* Electricity Reading */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-3">Final Electricity Reading</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Previous Reading</label>
                      <input
                        type="number"
                        value={deletionInfo.billing_info?.last_electric_reading || 0}
                        readOnly
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Final Reading *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={moveOutOptions.final_electric_reading}
                        onChange={(e) => {
                          const value = e.target.value
                          // Allow empty string, or valid numbers only
                          if (value === '' || (!isNaN(parseFloat(value)) && isFinite(value))) {
                            setMoveOutOptions({...moveOutOptions, final_electric_reading: value})
                          }
                        }}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter final meter reading"
                      />
                    </div>
                  </div>
                  {moveOutOptions.final_electric_reading !== '' && parseFloat(moveOutOptions.final_electric_reading) > 0 && (
                    <div className="mt-2 p-2 bg-white rounded border">
                      <span className="text-sm text-gray-700">
                        Consumption: {Math.max(0, parseFloat(moveOutOptions.final_electric_reading) - (deletionInfo.billing_info?.last_electric_reading || 0))} kWh
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional Charges */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Additional Charges (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Water Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={moveOutOptions.water_amount}
                        onChange={(e) => {
                          const value = e.target.value
                          setMoveOutOptions({...moveOutOptions, water_amount: value === '' ? '' : (parseFloat(value) || 0)})
                        }}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Extra Fee Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={moveOutOptions.extra_fee_amount}
                        onChange={(e) => {
                          const value = e.target.value
                          setMoveOutOptions({...moveOutOptions, extra_fee_amount: value === '' ? '' : (parseFloat(value) || 0)})
                        }}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Extra Fee Description</label>
                      <input
                        type="text"
                        value={moveOutOptions.extra_fee_description}
                        onChange={(e) => setMoveOutOptions({...moveOutOptions, extra_fee_description: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Cleaning fee"
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Preview */}
                {moveOutOptions.final_bill_rent_from && moveOutOptions.final_bill_rent_to && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-3">Final Bill Preview</h4>
                    {(() => {
                      const fromDate = new Date(moveOutOptions.final_bill_rent_from)
                      const toDate = new Date(moveOutOptions.final_bill_rent_to)
                      const daysDiff = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1
                      const monthlyRent = parseFloat(deletionInfo.tenant_info.monthly_rent)
                      const dailyRate = monthlyRent / 30
                      const proratedRent = Math.round(dailyRate * daysDiff) // Round to whole number
                      
                      const electricConsumption = Math.max(0, moveOutOptions.final_electric_reading - (deletionInfo.billing_info?.last_electric_reading || 0))
                      // Use branch-specific or global electric rate
                      const electricRate = getElectricityRate(deletionInfo.tenant_info)
                      const electricAmount = electricConsumption * electricRate
                      
                      const totalAmount = proratedRent + electricAmount + (moveOutOptions.water_amount || 0) + (moveOutOptions.extra_fee_amount || 0)
                      
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Prorated Rent ({daysDiff} days):</span>
                            <span className="font-medium">₱{proratedRent.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Electricity ({electricConsumption} kWh):</span>
                            <span className="font-medium">₱{electricAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Water:</span>
                            <span className="font-medium">₱{(moveOutOptions.water_amount || 0).toFixed(2)}</span>
                          </div>
                          {moveOutOptions.extra_fee_amount > 0 && (
                            <div className="flex justify-between">
                              <span>Extra Fee:</span>
                              <span className="font-medium">₱{moveOutOptions.extra_fee_amount.toFixed(2)}</span>
                            </div>
                          )}
                          <hr />
                          <div className="flex justify-between text-lg font-bold text-green-900">
                            <span>Total Amount:</span>
                            <span>₱{totalAmount.toFixed(2)}</span>
                          </div>
                          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
                            <strong>Note:</strong> This final bill will be sent to the tenant. Tenant will only be moved out after this bill is paid.
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={moveOutOptions.notes}
                    onChange={(e) => setMoveOutOptions({...moveOutOptions, notes: e.target.value})}
                    className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Add any additional notes about the move-out..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  
                  {/* Single, clear Move-out Button */}
                  <button
                    type="button"
                    onClick={confirmMoveOut}
                    disabled={loading || moveOutOptions.final_electric_reading === null || moveOutOptions.final_electric_reading === undefined || moveOutOptions.final_electric_reading === ''}
                    className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing Move-out...' : 'Process Move-out'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Contract Renewal Modal */}
        {showRenewModal && renewingTenant && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border max-w-md shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  🔄 Renew Contract - {renewingTenant.name}
                </h3>
                <button
                  onClick={() => setShowRenewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Current Contract</div>
                  <div className="font-medium">
                    {new Date(renewingTenant.contract_start_date).toLocaleDateString()} - 
                    {new Date(renewingTenant.contract_end_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">Room: {renewingTenant.room_number}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Contract Duration
                  </label>
                  <select
                    value={renewalData.duration_months}
                    onChange={(e) => setRenewalData({...renewalData, duration_months: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months</option>
                    <option value={24}>24 Months</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded border">
                  <div className="text-sm font-medium text-blue-800 mb-1">New Contract Period</div>
                  <div className="text-sm text-blue-600">
                    Start: {new Date(renewingTenant.contract_end_date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-blue-600">
                    End: {(() => {
                      const endDate = new Date(renewingTenant.contract_end_date)
                      endDate.setMonth(endDate.getMonth() + parseInt(renewalData.duration_months))
                      return endDate.toLocaleDateString()
                    })()}
                  </div>
                </div>

                <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                  <div className="text-sm text-yellow-800">
                    <strong>Important:</strong> Current deposits will be carried over to the new contract. 
                    No additional deposit collection required.
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
                <button
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRenewal}
                  className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  Renew Contract
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
} 