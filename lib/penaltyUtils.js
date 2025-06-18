import { pool } from './database'

/**
 * Get the penalty fee percentage from settings
 * @returns {Promise<number>} The penalty fee percentage (default 1.00 if not found)
 */
export async function getPenaltyFeePercentage() {
  try {
    const result = await pool.query(`
      SELECT setting_value 
      FROM settings 
      WHERE setting_key = 'penalty_fee_percentage'
    `)
    
    return result.rows.length > 0 
      ? parseFloat(result.rows[0].setting_value) 
      : 1.00 // Default 1%
  } catch (error) {
    console.error('Error fetching penalty fee percentage:', error)
    return 1.00 // Default fallback
  }
}

/**
 * Calculate penalty fee for a bill amount
 * @param {number} billAmount - The bill amount to calculate penalty on
 * @param {number} [customPercentage] - Optional custom percentage, otherwise fetches from settings
 * @returns {Promise<number>} The rounded penalty fee amount
 */
export async function calculatePenaltyFee(billAmount, customPercentage = null) {
  try {
    const percentage = customPercentage !== null 
      ? customPercentage 
      : await getPenaltyFeePercentage()
    
    const penaltyAmount = parseFloat(billAmount) * (percentage / 100)
    
    // Round to whole number for cleaner billing
    return Math.round(penaltyAmount)
  } catch (error) {
    console.error('Error calculating penalty fee:', error)
    // Fallback calculation with 1%
    return Math.round(parseFloat(billAmount) * 0.01)
  }
}

/**
 * Check if a payment is late based on billing cycle
 * @param {Date} paymentDate - The actual payment date
 * @param {Date} rentToDate - The end date of the billing period
 * @param {number} [graceDays=10] - Number of grace days after billing period
 * @returns {boolean} True if payment is late
 */
export function isPaymentLate(paymentDate, rentToDate, graceDays = 10) {
  try {
    // Normalize dates to midnight for proper comparison
    const payment = new Date(paymentDate)
    payment.setHours(0, 0, 0, 0)
    
    const rentTo = new Date(rentToDate)
    rentTo.setHours(0, 0, 0, 0)
    
    // Calculate due date (grace days after billing period ends)
    const dueDate = new Date(rentTo.getTime() + (graceDays * 24 * 60 * 60 * 1000))
    dueDate.setHours(0, 0, 0, 0)
    
    return payment > dueDate
  } catch (error) {
    console.error('Error checking if payment is late:', error)
    return false // Default to not late if error
  }
} 