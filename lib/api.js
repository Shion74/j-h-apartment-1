// API utility functions for making authenticated requests

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Get auth headers with token
const getAuthHeaders = () => {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' }
  
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  }
}

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  
  const config = {
    headers: getAuthHeaders(),
    ...options,
    ...(options.body && typeof options.body === 'object' && {
      body: JSON.stringify(options.body)
    })
  }

  const response = await fetch(url, config)
  
  // Handle authentication errors
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('Authentication failed')
  }

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}

// API methods
export const api = {
  // Authentication
  login: (credentials) => 
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    }).then(res => res.json()),

  // Dashboard
  getDashboardStats: () => apiRequest('/api/dashboard/stats'),
  
  // Branches
  getBranches: () => apiRequest('/api/branches'),
  createBranch: (branchData) => apiRequest('/api/branches', {
    method: 'POST',
    body: branchData
  }),
  createBranchWithRooms: (branchData) => apiRequest('/api/branches', {
    method: 'POST',
    body: branchData
  }),
  updateBranch: (id, branchData) => apiRequest(`/api/branches/${id}`, {
    method: 'PUT',
    body: branchData
  }),
  deleteBranch: (id) => apiRequest(`/api/branches/${id}`, {
    method: 'DELETE'
  }),

  // Tenants
  getTenants: () => apiRequest('/api/tenants'),
  getTenant: (id) => apiRequest(`/api/tenants/${id}`),
  createTenant: (tenantData) => apiRequest('/api/tenants', {
    method: 'POST',
    body: tenantData
  }),
  updateTenant: (id, tenantData) => apiRequest(`/api/tenants/${id}`, {
    method: 'PUT',
    body: tenantData
  }),
  getTenantDeletionInfo: (id) => apiRequest(`/api/tenants/${id}/deletion-info`),
  deleteTenant: (id, deletionData = {}) => apiRequest(`/api/tenants/${id}`, {
    method: 'DELETE',
    body: deletionData
  }),
  getTenantHistory: (params = {}) => {
    const searchParams = new URLSearchParams(params)
    return apiRequest(`/api/tenants/history?${searchParams}`)
  },
  renewContract: (tenantId, renewalData) => apiRequest(`/api/contracts/renew/${tenantId}`, {
    method: 'POST',
    body: renewalData
  }),

  // Rooms
  getRooms: () => apiRequest('/api/rooms'),
  createRoom: (roomData) => apiRequest('/api/rooms', {
    method: 'POST',
    body: roomData
  }),
  updateRoom: (id, roomData) => apiRequest(`/api/rooms/${id}`, {
    method: 'PUT',
    body: roomData
  }),
  deleteRoom: (id) => apiRequest(`/api/rooms/${id}`, {
    method: 'DELETE'
  }),

  // Bills
  getBills: () => apiRequest('/api/bills'),
  createBill: (billData) => apiRequest('/api/bills', {
    method: 'POST',
    body: billData
  }),
  updateBill: (id, billData) => apiRequest(`/api/bills/${id}`, {
    method: 'PUT',
    body: billData
  }),
  deleteBill: (id) => apiRequest(`/api/bills/${id}`, {
    method: 'DELETE'
  }),


  // Payments
  getPayments: () => apiRequest('/api/payments'),
  createPayment: (paymentData) => apiRequest('/api/payments', {
    method: 'POST',
    body: paymentData
  }),

  // Settings
  getSettings: () => apiRequest('/api/settings'),
  updateSettings: (settingsData) => apiRequest('/api/settings', {
    method: 'PUT',
    body: settingsData
  })
}

export default api 