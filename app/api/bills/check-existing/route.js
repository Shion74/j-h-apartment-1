import { verify } from 'jsonwebtoken'
import { pool } from '../../../../lib/database'

export async function GET(req) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const decoded = verify(token, process.env.JWT_SECRET)

    const { searchParams } = new URL(req.url)
    const tenant_id = searchParams.get('tenant_id')
    const rent_from = searchParams.get('rent_from')
    const rent_to = searchParams.get('rent_to')

    if (!tenant_id || !rent_from || !rent_to) {
      return Response.json({ 
        message: 'Tenant ID, rent_from, and rent_to are required' 
      }, { status: 400 })
    }

    // Check if a bill already exists for this tenant and date range
    const result = await pool.query(`
      SELECT id, status, total_amount 
      FROM bills 
      WHERE tenant_id = $1 AND rent_from = $2 AND rent_to = $3
    `, [tenant_id, rent_from, rent_to])
    
    const existingBills = result.rows

    if (existingBills.length > 0) {
      const bill = existingBills[0]
      return Response.json({
        exists: true,
        bill_id: bill.id,
        status: bill.status,
        total_amount: bill.total_amount
      })
    } else {
      return Response.json({
        exists: false
      })
    }

  } catch (error) {
    console.error('Check existing bill error:', error)
    return Response.json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
} 