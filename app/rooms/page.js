'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  HomeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  UsersIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function RoomsPage() {
  const [rooms, setRooms] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [formData, setFormData] = useState({
    room_number: '',
    monthly_rent: '',
    branch_id: '',
    description: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const { api } = await import('../../lib/api')
      const [roomsData, branchesData] = await Promise.all([
        api.getRooms(),
        api.getBranches()
      ])
      
      setRooms(roomsData.rooms || [])
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
      
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, formData)
        toast.success('Room updated')
      } else {
        await api.createRoom(formData)
        toast.success('Room created')
      }
      
      setShowModal(false)
      setEditingRoom(null)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Error saving room:', error)
      toast.error(error.message || 'Failed to save room')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (room) => {
    setEditingRoom(room)
    setFormData({
      room_number: room.room_number,
      monthly_rent: room.monthly_rent,
      branch_id: room.branch_id,
      description: room.description || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (room) => {
    if (!confirm(`Are you sure you want to delete Room ${room.room_number}?`)) return

    try {
      const { api } = await import('../../lib/api')
      await api.deleteRoom(room.id)
              toast.success('Room deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting room:', error)
      toast.error('Failed to delete room')
    }
  }

  const resetForm = () => {
    setFormData({
      room_number: '',
      monthly_rent: '',
      branch_id: '',
      description: ''
    })
  }

  const handleBranchChange = (branchId) => {
    const selectedBranch = branches.find(b => b.id.toString() === branchId)
    setFormData(prev => ({
      ...prev,
      branch_id: branchId,
      monthly_rent: selectedBranch ? selectedBranch.monthly_rent || '' : ''
    }))
  }

  const getSelectedBranch = () => {
    return branches.find(b => b.id.toString() === formData.branch_id)
  }

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.branch_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesBranch = !filterBranch || room.branch_id?.toString() === filterBranch
    const matchesStatus = !filterStatus || room.status === filterStatus
    
    return matchesSearch && matchesBranch && matchesStatus
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  if (loading && rooms.length === 0) {
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
              <h1 className="text-3xl font-bold text-gray-900">Rooms</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage all rooms, occupancy, and rental rates
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <button
                onClick={() => {
                  resetForm()
                  setEditingRoom(null)
                  setShowModal(true)
                }}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Room
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <div className="text-sm text-gray-600 flex items-center">
              <InformationCircleIcon className="h-4 w-4 mr-1" />
              {filteredRooms.length} room(s) found
            </div>
          </div>

          {/* Room Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <div key={room.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <HomeIcon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Room {room.room_number}
                        </h3>
                        <p className="text-sm text-gray-500">{room.branch_name}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      room.status === 'occupied' 
                        ? 'bg-red-100 text-red-800'
                        : room.status === 'vacant'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {room.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Monthly Rent</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(room.monthly_rent)}
                      </span>
                    </div>

                    {room.tenant_name && (
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">{room.tenant_name}</span>
                      </div>
                    )}

                    {room.contract_end_date && (
                      <div className="text-xs text-gray-500">
                        Contract ends: {new Date(room.contract_end_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(room)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <PencilIcon className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(room)}
                      className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      <TrashIcon className="h-3 w-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRooms.length === 0 && (
            <div className="text-center py-12">
              <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No rooms found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterBranch || filterStatus 
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating a new room.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Add/Edit Room Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingRoom ? 'Edit Room' : 'Add New Room'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Branch</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Number
                    </label>
                    <input
                      type="text"
                      value={formData.room_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, room_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 101, A1, etc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monthly Rent (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthly_rent}
                      onChange={(e) => setFormData(prev => ({ ...prev, monthly_rent: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="3500.00"
                      required
                    />
                    {getSelectedBranch() && (
                      <p className="mt-1 text-xs text-gray-500">
                        Branch default: ₱{getSelectedBranch().monthly_rent || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      placeholder="Additional details about the room..."
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false)
                        setEditingRoom(null)
                        resetForm()
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : (editingRoom ? 'Update' : 'Create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  )
} 