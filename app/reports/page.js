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
  const [downloadingPDF, setDownloadingPDF] = useState(false)

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
        toast.success('Report generated')
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
      toast.error('Enter valid email')
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
        toast.success('PDF report sent via email successfully!')
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

  const downloadPDFReport = async () => {
    setDownloadingPDF(true)
    try {
      const response = await fetch(`/api/reports/monthly/pdf?month=${selectedMonth}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `J&H_Monthly_Report_${reportData?.report_period?.month_name?.replace(/\s+/g, '_') || 'Report'}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast.success('PDF report downloaded successfully!')
      } else {
        toast.error('Failed to download PDF report')
      }
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Failed to download PDF report')
    } finally {
      setDownloadingPDF(false)
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
      <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                  <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 mr-2 sm:mr-3 text-blue-600" />
                  Monthly Business Reports
                </h1>
                <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
                  Comprehensive business analytics and performance metrics
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Report Options */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <CalendarIcon className="h-6 w-6 mr-2 text-blue-600" />
                Report Options
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Month
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value)
                      generateReport(e.target.value)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => generateReport(selectedMonth)}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <ChartBarIcon className="h-4 w-4 mr-2" />
                        Generate Report
                      </>
                    )}
                  </button>

                  {reportData && (
                    <button
                      onClick={downloadPDFReport}
                      disabled={downloadingPDF}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center"
                    >
                      {downloadingPDF ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                          Download PDF Report
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Email Section */}
            {reportData && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <EnvelopeIcon className="h-6 w-6 mr-2 text-blue-600" />
                    Email Report
                  </h2>
                  <DocumentArrowDownIcon className="h-6 w-6 text-gray-400" />
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <DocumentArrowDownIcon className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-blue-800">PDF Report Attachment</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Reports will be sent as professional PDF attachments with complete financial analysis, 
                        charts, and detailed breakdowns. The email will include a quick summary with the full 
                        report attached as a PDF file.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Recipients
                    </label>
                    {emailRecipients.map((email, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => updateEmailRecipient(index, e.target.value)}
                          placeholder="Enter email address"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {emailRecipients.length > 1 && (
                          <button
                            onClick={() => removeEmailRecipient(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={addEmailRecipient}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      + Add another recipient
                    </button>
                  </div>

                  <button
                    onClick={sendEmailReport}
                    disabled={sendingEmail || !reportData}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
                  >
                    {sendingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating PDF & Sending...
                      </>
                    ) : (
                      <>
                        <EnvelopeIcon className="h-4 w-4 mr-2" />
                        Send PDF Report via Email
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Report Content */}
          {reportData && (
            <div className="space-y-6 sm:space-y-8">
              {/* Executive Summary */}
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center">
                  <ArrowTrendingUpIcon className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-600" />
                  <span className="hidden sm:inline">Executive Summary - {reportData.report_period.month_name}</span>
                  <span className="sm:hidden">Summary - {reportData.report_period.month_name}</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Income Section */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600" />
                      Income
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Room Rental:</span>
                        <span className="font-medium">{formatCurrency(reportData.financial_summary.total_rent)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Extra Fees:</span>
                        <span className="font-medium">{formatCurrency(reportData.financial_summary.total_extra_fees)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center font-semibold">
                        <span className="text-gray-900">Total Income:</span>
                        <span className="text-green-600">{formatCurrency(reportData.financial_summary.total_income)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses Section */}
                  <div className="bg-red-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-600" />
                      Expenses
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Electricity:</span>
                        <span className="font-medium">{formatCurrency(reportData.financial_summary.total_electricity)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Water:</span>
                        <span className="font-medium">{formatCurrency(reportData.financial_summary.total_water)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center font-semibold">
                        <span className="text-gray-900">Total Expenses:</span>
                        <span className="text-red-600">{formatCurrency(reportData.financial_summary.total_expenses)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Income */}
                  <div className="md:col-span-2 bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">Net Income</h3>
                      <span className="text-xl font-bold text-blue-600">
                        {formatCurrency(reportData.financial_summary.net_income)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Financial Stats */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="text-sm font-medium text-gray-500">Total Revenue</h4>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{formatCurrency(reportData.financial_summary.total_revenue)}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="text-sm font-medium text-gray-500">Transactions</h4>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{reportData.financial_summary.total_transactions}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="text-sm font-medium text-gray-500">Unpaid Amount</h4>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{formatCurrency(reportData.financial_summary.unpaid_amount)}</p>
                  </div>
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="text-sm font-medium text-gray-500">Partial Amount</h4>
                    <p className="mt-1 text-xl font-semibold text-gray-900">{formatCurrency(reportData.financial_summary.partial_amount)}</p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {(reportData.outstanding_summary.total_outstanding > 0 || 
                reportData.tenant_statistics.expiring_contracts > 0 || 
                reportData.occupancy_metrics.occupancy_rate < 80) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-yellow-800 mb-3 sm:mb-4 flex items-center">
                    <ExclamationTriangleIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                    <span className="hidden sm:inline">Alerts & Recommendations</span>
                    <span className="sm:hidden">Alerts</span>
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {reportData.outstanding_summary.total_outstanding > 0 && (
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-red-500 rounded-full mt-1.5 sm:mt-2"></div>
                        <p className="text-yellow-800 text-sm sm:text-base">
                          <strong>Action Required:</strong> There are {formatCurrency(reportData.outstanding_summary.total_outstanding)} in outstanding payments that need attention.
                        </p>
                      </div>
                    )}
                    {reportData.tenant_statistics.expiring_contracts > 0 && (
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-1.5 sm:mt-2"></div>
                        <p className="text-yellow-800 text-sm sm:text-base">
                          <strong>Contract Renewals:</strong> {reportData.tenant_statistics.expiring_contracts} contracts are expiring in the next 30 days.
                        </p>
                      </div>
                    )}
                    {reportData.occupancy_metrics.occupancy_rate < 80 && (
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5 sm:mt-2"></div>
                        <p className="text-yellow-800 text-sm sm:text-base">
                          <strong>Occupancy Alert:</strong> Current occupancy rate is {reportData.occupancy_metrics.occupancy_rate}%. Consider marketing strategies to increase occupancy.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Performance */}
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Financial Performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-gray-900">{reportData.financial_summary.total_transactions}</p>
                    <p className="text-sm sm:text-base text-gray-600">Total Transactions</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(reportData.financial_summary.total_billed)}</p>
                    <p className="text-sm sm:text-base text-gray-600">Total Billed</p>
                  </div>
                  <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <p className="text-lg sm:text-2xl font-bold text-red-600 truncate">{formatCurrency(reportData.outstanding_summary.total_outstanding)}</p>
                    <p className="text-sm sm:text-base text-gray-600">Outstanding Amount</p>
                  </div>
                </div>

                {/* Payment Methods */}
                {reportData.payment_analysis.by_method.length > 0 && (
                  <div>
                    <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Payment Methods Breakdown</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {reportData.payment_analysis.by_method.map((method, index) => (
                            <tr key={index}>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                {method.payment_method}
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                {method.transaction_count}
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                {formatCurrency(method.total_amount)}
                              </td>
                              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
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
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Branch Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occupancy</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">New Tenants</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.branch_performance.map((branch, index) => (
                        <tr key={index}>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                            {branch.branch_name}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            {branch.occupied_rooms}/{branch.total_rooms}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${
                              branch.occupancy_rate >= 90 ? 'bg-green-100 text-green-800' :
                              branch.occupancy_rate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {branch.occupancy_rate}%
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                            <span className="hidden sm:inline">{formatCurrency(branch.revenue)}</span>
                            <span className="sm:hidden">{formatCurrency(branch.revenue).replace('₱', '₱')}</span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
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
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
                    <span className="hidden sm:inline">Top Paying Tenants</span>
                    <span className="sm:hidden">Top Tenants</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant Name</th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                          <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.top_performers.map((tenant, index) => (
                          <tr key={index}>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                              {tenant.tenant_name}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                              {tenant.room_number}
                            </td>
                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
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
            <div className="text-center py-8 sm:py-12">
              <ChartBarIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No report generated</h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 px-4">
                <span className="hidden sm:inline">Select a month and click "Generate Report" to view business analytics.</span>
                <span className="sm:hidden">Select month and generate report to view analytics.</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
} 