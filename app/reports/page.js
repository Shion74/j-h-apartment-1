'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import { 
  ChartBarIcon, 
  CalendarIcon, 
  EnvelopeIcon,
  DocumentArrowDownIcon,
  CurrencyDollarIcon,
  HomeIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState([''])
  const [sendingEmail, setSendingEmail] = useState(false)

  // Generate current month report on page load
  useEffect(() => {
    generateReport()
  }, [])

  const generateReport = async (month = selectedMonth) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/monthly?month=${month}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setReportData(data.report)
        toast.success('Report generated successfully!')
      } else {
        toast.error(data.message || 'Failed to generate report')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const sendEmailReport = async () => {
    const validEmails = emailRecipients.filter(email => email.trim() && email.includes('@'))
    
    if (validEmails.length === 0) {
      toast.error('Please enter at least one valid email address')
      return
    }

    setSendingEmail(true)
    try {
      const response = await fetch('/api/reports/monthly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          month: selectedMonth,
          email_recipients: validEmails
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success(`Report sent to ${validEmails.length} recipient(s)!`)
      } else {
        toast.error(data.message || 'Failed to send report')
      }
    } catch (error) {
      console.error('Error sending report:', error)
      toast.error('Failed to send report')
    } finally {
      setSendingEmail(false)
    }
  }

  const addEmailRecipient = () => {
    setEmailRecipients([...emailRecipients, ''])
  }

  const updateEmailRecipient = (index, value) => {
    const updated = [...emailRecipients]
    updated[index] = value
    setEmailRecipients(updated)
  }

  const removeEmailRecipient = (index) => {
    setEmailRecipients(emailRecipients.filter((_, i) => i !== index))
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const getGrowthColor = (growth) => {
    if (growth > 0) return 'text-green-600'
    if (growth < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getGrowthIcon = (growth) => {
    if (growth > 0) return '↗'
    if (growth < 0) return '↘'
    return '→'
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <ChartBarIcon className="h-8 w-8 mr-3 text-blue-600" />
                  Monthly Business Reports
                </h1>
                <p className="mt-2 text-gray-600">
                  Comprehensive business analytics and performance metrics
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Month
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="pt-6">
                  <button
                    onClick={() => generateReport(selectedMonth)}
                    disabled={loading}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Email Section */}
              {reportData && (
                <div className="border-l pl-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Recipients
                  </label>
                  <div className="space-y-2 mb-3">
                    {emailRecipients.map((email, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => updateEmailRecipient(index, e.target.value)}
                          placeholder="Enter email address"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        {emailRecipients.length > 1 && (
                          <button
                            onClick={() => removeEmailRecipient(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={addEmailRecipient}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      + Add Email
                    </button>
                    <button
                      onClick={sendEmailReport}
                      disabled={sendingEmail}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                    >
                      {sendingEmail ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-4 w-4 mr-2" />
                          Send Report
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report Content */}
          {reportData && (
            <div className="space-y-8">
              {/* Executive Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <ArrowTrendingUpIcon className="h-6 w-6 mr-2 text-blue-600" />
                  Executive Summary - {reportData.report_period.month_name}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Total Revenue</p>
                        <p className="text-2xl font-bold">{formatCurrency(reportData.financial_summary.total_revenue)}</p>
                        <p className={`text-sm ${getGrowthColor(reportData.financial_summary.revenue_growth)} bg-white bg-opacity-20 rounded px-2 py-1 mt-2 inline-block`}>
                          {getGrowthIcon(reportData.financial_summary.revenue_growth)} {Math.abs(reportData.financial_summary.revenue_growth)}% vs last month
                        </p>
                      </div>
                      <CurrencyDollarIcon className="h-12 w-12 text-blue-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Occupancy Rate</p>
                        <p className="text-2xl font-bold">{reportData.occupancy_metrics.occupancy_rate}%</p>
                        <p className="text-sm text-green-100 mt-2">
                          {reportData.occupancy_metrics.occupied_rooms}/{reportData.occupancy_metrics.total_rooms} rooms
                        </p>
                      </div>
                      <HomeIcon className="h-12 w-12 text-green-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Active Tenants</p>
                        <p className="text-2xl font-bold">{reportData.tenant_statistics.active_tenants}</p>
                        <p className="text-sm text-purple-100 mt-2">
                          Net change: {reportData.tenant_statistics.net_tenant_change >= 0 ? '+' : ''}{reportData.tenant_statistics.net_tenant_change}
                        </p>
                      </div>
                      <UsersIcon className="h-12 w-12 text-purple-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">Collection Rate</p>
                        <p className="text-2xl font-bold">{reportData.financial_summary.collection_rate}%</p>
                        <p className="text-sm text-orange-100 mt-2">
                          {formatCurrency(reportData.financial_summary.total_billed)} billed
                        </p>
                      </div>
                      <ChartBarIcon className="h-12 w-12 text-orange-200" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {(reportData.outstanding_summary.total_outstanding > 0 || 
                reportData.tenant_statistics.expiring_contracts > 0 || 
                reportData.occupancy_metrics.occupancy_rate < 80) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                    Alerts & Recommendations
                  </h3>
                  <div className="space-y-3">
                    {reportData.outstanding_summary.total_outstanding > 0 && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                        <p className="text-yellow-800">
                          <strong>Action Required:</strong> There are {formatCurrency(reportData.outstanding_summary.total_outstanding)} in outstanding payments that need attention.
                        </p>
                      </div>
                    )}
                    {reportData.tenant_statistics.expiring_contracts > 0 && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                        <p className="text-yellow-800">
                          <strong>Contract Renewals:</strong> {reportData.tenant_statistics.expiring_contracts} contracts are expiring in the next 30 days.
                        </p>
                      </div>
                    )}
                    {reportData.occupancy_metrics.occupancy_rate < 80 && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <p className="text-yellow-800">
                          <strong>Occupancy Alert:</strong> Current occupancy rate is {reportData.occupancy_metrics.occupancy_rate}%. Consider marketing strategies to increase occupancy.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Performance */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Financial Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{reportData.financial_summary.total_transactions}</p>
                    <p className="text-gray-600">Total Transactions</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(reportData.financial_summary.total_billed)}</p>
                    <p className="text-gray-600">Total Billed</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(reportData.outstanding_summary.total_outstanding)}</p>
                    <p className="text-gray-600">Outstanding Amount</p>
                  </div>
                </div>

                {/* Payment Methods */}
                {reportData.payment_analysis.by_method.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Payment Methods Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.payment_analysis.by_method.map((method, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {method.payment_method}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {method.transaction_count}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(method.total_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {method.percentage}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Branch Performance */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Branch Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occupancy</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Tenants</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.branch_performance.map((branch, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {branch.branch_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {branch.occupied_rooms}/{branch.total_rooms}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              branch.occupancy_rate >= 90 ? 'bg-green-100 text-green-800' :
                              branch.occupancy_rate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {branch.occupancy_rate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(branch.revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {branch.new_tenants}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Performers */}
              {reportData.top_performers.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">🌟 Top Paying Tenants</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.top_performers.map((tenant, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {tenant.tenant_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {tenant.room_number}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(tenant.total_paid)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {!reportData && !loading && (
            <div className="text-center py-12">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No report generated</h3>
              <p className="mt-1 text-sm text-gray-500">Select a month and click "Generate Report" to view business analytics.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
} 