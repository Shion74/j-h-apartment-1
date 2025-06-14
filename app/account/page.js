'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import {
  UserIcon,
  KeyIcon,
  EnvelopeIcon,
  CogIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast, { Toaster } from 'react-hot-toast'

export default function AccountPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  
  // Account form data
  const [accountForm, setAccountForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // System email settings
  const [emailSettings, setEmailSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_from_email: '',
    smtp_from_name: 'J&H Apartment Management'
  })

  const [activeTab, setActiveTab] = useState('account')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        setAccountForm(prev => ({
          ...prev,
          username: parsedUser.username || '',
          email: parsedUser.email || ''
        }))
      }

      // Fetch system email settings
      const response = await fetch('/api/settings/email', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setEmailSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load account data')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    
    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (accountForm.newPassword && accountForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/account/update', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: accountForm.username,
          email: accountForm.email,
          currentPassword: accountForm.currentPassword,
          newPassword: accountForm.newPassword || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Account updated successfully')
        
        // Update local storage with new user data
        const updatedUser = { ...user, username: accountForm.username, email: accountForm.email }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        
        // Clear password fields
        setAccountForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } else {
        toast.error(data.message || 'Failed to update account')
      }
    } catch (error) {
      console.error('Error updating account:', error)
      toast.error('Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const handleEmailSettingsSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const response = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailSettings)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Email settings updated successfully')
      } else {
        toast.error(data.message || 'Failed to update email settings')
      }
    } catch (error) {
      console.error('Error updating email settings:', error)
      toast.error('Failed to update email settings')
    } finally {
      setSaving(false)
    }
  }

  const testEmailConnection = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailSettings)
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Email connection test successful!')
      } else {
        toast.error(data.message || 'Email connection test failed')
      }
    } catch (error) {
      console.error('Error testing email connection:', error)
      toast.error('Failed to test email connection')
    } finally {
      setSaving(false)
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
    <>
      <Toaster position="top-right" />
      <DashboardLayout>
        <div className="px-4 sm:px-6 lg:px-8 pb-6">
          {/* Header */}
          <div className="sm:flex sm:items-center mb-6 pt-6">
            <div className="sm:flex-auto">
              <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
              <p className="mt-2 text-sm text-gray-700">
                Manage your account information and system email settings
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('account')}
                className={`${
                  activeTab === 'account'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                <UserIcon className="h-5 w-5 inline mr-2" />
                Account Information
              </button>
              <button
                onClick={() => setActiveTab('email')}
                className={`${
                  activeTab === 'email'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm`}
              >
                <EnvelopeIcon className="h-5 w-5 inline mr-2" />
                Email Settings
              </button>
            </nav>
          </div>

          {/* Account Information Tab */}
          {activeTab === 'account' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Account Information
                </h3>
                <form onSubmit={handleAccountSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Username */}
                    <div>
                      <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                        Username
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="text"
                          id="username"
                          value={accountForm.username}
                          onChange={(e) => setAccountForm(prev => ({ ...prev, username: e.target.value }))}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          required
                        />
                        <UserIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <div className="mt-1 relative">
                        <input
                          type="email"
                          id="email"
                          value={accountForm.email}
                          onChange={(e) => setAccountForm(prev => ({ ...prev, email: e.target.value }))}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="admin@example.com"
                        />
                        <EnvelopeIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Password Change Section */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Change Password</h4>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                      {/* Current Password */}
                      <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                          Current Password
                        </label>
                        <div className="mt-1 relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="currentPassword"
                            value={accountForm.currentPassword}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <EyeIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                          New Password
                        </label>
                        <div className="mt-1 relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            id="newPassword"
                            value={accountForm.newPassword}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                            placeholder="Leave blank to keep current"
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
                              <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <EyeIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                          Confirm New Password
                        </label>
                        <div className="mt-1">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            id="confirmPassword"
                            value={accountForm.confirmPassword}
                            onChange={(e) => setAccountForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="loading-spinner mr-2"></div>
                          Updating...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Update Account
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {activeTab === 'email' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  System Email Settings
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Configure SMTP settings for sending system emails like receipts and notifications.
                </p>
                
                <form onSubmit={handleEmailSettingsSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* SMTP Host */}
                    <div>
                      <label htmlFor="smtp_host" className="block text-sm font-medium text-gray-700">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        id="smtp_host"
                        value={emailSettings.smtp_host}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_host: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    {/* SMTP Port */}
                    <div>
                      <label htmlFor="smtp_port" className="block text-sm font-medium text-gray-700">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        id="smtp_port"
                        value={emailSettings.smtp_port}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_port: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="587"
                      />
                    </div>

                    {/* SMTP Username */}
                    <div>
                      <label htmlFor="smtp_user" className="block text-sm font-medium text-gray-700">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        id="smtp_user"
                        value={emailSettings.smtp_user}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_user: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="your-email@gmail.com"
                      />
                    </div>

                    {/* SMTP Password */}
                    <div>
                      <label htmlFor="smtp_password" className="block text-sm font-medium text-gray-700">
                        SMTP Password
                      </label>
                      <input
                        type="password"
                        id="smtp_password"
                        value={emailSettings.smtp_password}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_password: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="App password or SMTP password"
                      />
                    </div>

                    {/* From Email */}
                    <div>
                      <label htmlFor="smtp_from_email" className="block text-sm font-medium text-gray-700">
                        From Email Address
                      </label>
                      <input
                        type="email"
                        id="smtp_from_email"
                        value={emailSettings.smtp_from_email}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_from_email: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="admin@jhapartment.com"
                      />
                    </div>

                    {/* From Name */}
                    <div>
                      <label htmlFor="smtp_from_name" className="block text-sm font-medium text-gray-700">
                        From Name
                      </label>
                      <input
                        type="text"
                        id="smtp_from_name"
                        value={emailSettings.smtp_from_name}
                        onChange={(e) => setEmailSettings(prev => ({ ...prev, smtp_from_name: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="J&H Apartment Management"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={testEmailConnection}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="loading-spinner mr-2"></div>
                          Testing...
                        </>
                      ) : (
                        <>
                          <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                          Test Connection
                        </>
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <>
                          <div className="loading-spinner mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 mr-2" />
                          Save Email Settings
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Email Settings Help */}
                <div className="mt-6 p-4 bg-blue-50 rounded-md">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Gmail Setup Instructions:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Use smtp.gmail.com as SMTP host</li>
                    <li>• Use port 587 for TLS</li>
                    <li>• Enable 2-factor authentication on your Gmail account</li>
                    <li>• Generate an App Password and use it as SMTP password</li>
                    <li>• Use your Gmail address as both username and from email</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </>
  )
} 