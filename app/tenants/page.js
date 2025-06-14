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
  EnvelopeIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingTenant, setDeletingTenant] = useState(null)
  const [deletionInfo, setDeletionInfo] = useState(null)
  const [editingTenant, setEditingTenant] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    room_id: '',
    rent_start: '',
    initial_electric_reading: 0,
    advance_payment: 3500.00,
    security_deposit: 3500.00,
    advance_payment_status: 'unpaid',
    security_deposit_status: 'unpaid'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { api } = await import('../../lib/api')
      const [tenantsData, roomsData, branchesData] = await Promise.all([
        api.getTenants(),
        api.getRooms(),
        api.getBranches()
      ])
      
      setTenants(tenantsData.tenants || [])
      setRooms(roomsData.rooms?.filter(room => room.status === 'vacant') || [])
      setBranches(branchesData.branches || [])
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
        await api.updateTenant(editingTenant.id, formData)
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

  const handleEdit = (tenant) => {
    setEditingTenant(tenant)
    setFormData({
      name: tenant.name,
      mobile: tenant.mobile,
      email: tenant.email || '',
      address: tenant.address || '',
      room_id: tenant.room_id || '',
      rent_start: tenant.rent_start?.split('T')[0] || '',
      initial_electric_reading: tenant.initial_electric_reading || 0,
      advance_payment: tenant.advance_payment || 3500.00,
      security_deposit: tenant.security_deposit || 3500.00,
      advance_payment_status: tenant.advance_payment_status || 'unpaid',
      security_deposit_status: tenant.security_deposit_status || 'unpaid'
    })
    setShowModal(true)
  }

  const handleDelete = async (tenant) => {
    try {
      setDeletingTenant(tenant)
      const { api } = await import('../../lib/api')
      
      // Get deletion info first
      const info = await api.getTenantDeletionInfo(tenant.id)
      setDeletionInfo(info)
      setShowDeleteModal(true)
    } catch (error) {
      console.error('Error getting deletion info:', error)
      toast.error('Failed to get tenant information')
    }
  }

  const confirmDelete = async (deletionData = {}) => {
    if (!deletingTenant) return

    try {
      const { api } = await import('../../lib/api')
      const result = await api.deleteTenant(deletingTenant.id, deletionData)
      
      toast.success(result.message || 'Tenant moved to history successfully')
      
      // Show refund info if applicable
      if (result.tenant_history?.security_deposit_refund > 0) {
        toast.success(
          `Security deposit refund: ₱${result.tenant_history.security_deposit_refund.toLocaleString()}`,
          { duration: 5000 }
        )
      }
      
      setShowDeleteModal(false)
      setDeletingTenant(null)
      setDeletionInfo(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting tenant:', error)
      toast.error(error.message || 'Failed to delete tenant')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      email: '',
      address: '',
      room_id: '',
      rent_start: '',
      initial_electric_reading: 0,
      advance_payment: 3500.00,
      security_deposit: 3500.00,
      advance_payment_status: 'unpaid',
      security_deposit_status: 'unpaid'
    })
  }

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.mobile?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.room_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesBranch = !branchFilter || tenant.branch_name === branchFilter
    
    return matchesSearch && matchesBranch
  })

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
      <Toaster position="top-right" />
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

                  <div className="mt-4 flex justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tenant.contract_status === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {tenant.contract_status || 'inactive'}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tenant)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
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
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Mobile</label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Room</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.room_number} - {room.branch_name} (₱{parseFloat(room.monthly_rent).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rent Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.rent_start}
                    onChange={(e) => setFormData({...formData, rent_start: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {formData.room_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Initial Electric Reading</label>
                    <input
                      type="number"
                      value={formData.initial_electric_reading}
                      onChange={(e) => setFormData({...formData, initial_electric_reading: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Deposit Fields */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Deposit Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Advance Payment</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.advance_payment}
                        onChange={(e) => setFormData({...formData, advance_payment: parseFloat(e.target.value) || 0})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Security Deposit</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.security_deposit}
                        onChange={(e) => setFormData({...formData, security_deposit: parseFloat(e.target.value) || 0})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.advance_payment_status === 'paid'}
                          onChange={(e) => setFormData({...formData, advance_payment_status: e.target.checked ? 'paid' : 'unpaid'})}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Advance Payment Received</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.security_deposit_status === 'paid'}
                          onChange={(e) => setFormData({...formData, security_deposit_status: e.target.checked ? 'paid' : 'unpaid'})}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Security Deposit Received</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && deletingTenant && deletionInfo && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Confirm Tenant Removal - {deletingTenant.name}
                </h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tenant Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Tenant Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {deletionInfo.tenant_info.name}</div>
                    <div><span className="font-medium">Room:</span> {deletionInfo.tenant_info.room_number}</div>
                    <div><span className="font-medium">Branch:</span> {deletionInfo.tenant_info.branch_name}</div>
                    <div><span className="font-medium">Contract:</span> {new Date(deletionInfo.tenant_info.contract_start_date).toLocaleDateString()} - {new Date(deletionInfo.tenant_info.contract_end_date).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Payment Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Current Month:</span>
                      <span className={`font-medium ${deletionInfo.payment_status.current_month_paid ? 'text-green-600' : 'text-red-600'}`}>
                        {deletionInfo.payment_status.current_month_paid ? '✅ Paid' : '❌ Unpaid'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Unpaid Bills:</span>
                      <span className={`font-medium ${deletionInfo.payment_status.unpaid_bills_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {deletionInfo.payment_status.unpaid_bills_count} (₱{parseFloat(deletionInfo.payment_status.unpaid_bills_amount).toLocaleString()})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Paid Bills:</span>
                      <span className="text-green-600 font-medium">
                        {deletionInfo.payment_status.paid_bills_count} (₱{parseFloat(deletionInfo.payment_status.paid_bills_amount).toLocaleString()})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contract Status */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Contract Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-medium ${deletionInfo.contract_status.is_completed ? 'text-green-600' : 'text-orange-600'}`}>
                        {deletionInfo.contract_status.is_completed ? '✅ Completed' : '⏳ Active'}
                      </span>
                    </div>
                    {deletionInfo.contract_status.is_early_termination && (
                      <div className="flex justify-between">
                        <span>Days Remaining:</span>
                        <span className="text-orange-600 font-medium">{deletionInfo.contract_status.days_remaining} days</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Completion:</span>
                      <span className="font-medium">{deletionInfo.contract_status.completion_percentage}%</span>
                    </div>
                  </div>
                </div>

                {/* Deposit Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Deposit Information</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-700">Advance Payment:</div>
                      <div className="ml-2 space-y-1">
                        <div className="flex justify-between">
                          <span>Original:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.advance_payment.original_amount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Used for bills:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.advance_payment.used_for_bills).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Remaining:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.advance_payment.remaining_balance).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-500">⚠️ Advance payment is not refundable</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-700">Security Deposit:</div>
                      <div className="ml-2 space-y-1">
                        <div className="flex justify-between">
                          <span>Original:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.security_deposit.original_amount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Used for bills:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.security_deposit.used_for_bills).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium text-green-600">
                          <span>Refund Amount:</span>
                          <span>₱{parseFloat(deletionInfo.deposit_info.security_deposit.refund_amount).toLocaleString()}</span>
                        </div>
                        {deletionInfo.deposit_info.security_deposit.refundable && (
                          <div className="text-xs text-green-600">✅ Eligible for refund</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {deletionInfo.deletion_status.warnings.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notices:</h4>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {deletionInfo.deletion_status.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blocking Message */}
              {!deletionInfo.deletion_status.can_delete && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">❌ Cannot Remove Tenant</h4>
                  <p className="text-sm text-red-700">{deletionInfo.deletion_status.blocking_reason}</p>
                  <p className="text-xs text-red-600 mt-2">Please settle all outstanding payments before removing the tenant.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                
                {deletionInfo.deletion_status.can_delete && (
                  <button
                    onClick={() => confirmDelete({
                      reason_for_leaving: deletionInfo.contract_status.is_completed ? 'contract_completed' : 'early_termination',
                      notes: `Tenant removed on ${new Date().toLocaleDateString()}. ${deletionInfo.contract_status.is_early_termination ? 'Early termination.' : 'Contract completed.'}`
                    })}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                  >
                    Confirm Removal
                  </button>
                )}
                
                {!deletionInfo.deletion_status.can_delete && (
                  <button
                    onClick={() => confirmDelete({
                      reason_for_leaving: 'other',
                      notes: `Force removal on ${new Date().toLocaleDateString()}. Outstanding issues: ${deletionInfo.deletion_status.blocking_reason}`,
                      force_delete: true
                    })}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
                  >
                    Force Remove (Override)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
} 