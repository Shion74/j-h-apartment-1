import { NextResponse } from 'next/server'
import { pool } from '../../../../lib/database'
import { requireAuth } from '../../../../lib/auth'

export async function GET(request) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    // Get filter parameters from URL
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // Format: YYYY-MM
    const branchId = searchParams.get('branch_id')
    const roomNumber = searchParams.get('room_number')

    // Build WHERE conditions for filtering
    let whereConditions = []
    let queryParams = []
    let paramIndex = 1

    // Add month filter if provided
    if (month) {
      whereConditions.push(`DATE_TRUNC('month', COALESCE(actual_payment_date, payment_date)) = DATE_TRUNC('month', $${paramIndex}::date)`)
      queryParams.push(`${month}-01`) // Convert YYYY-MM to YYYY-MM-01 for proper date parsing
      paramIndex++
    }

    // Add branch filter if provided
    if (branchId) {
      whereConditions.push(`br.id = $${paramIndex}`)
      queryParams.push(branchId)
      paramIndex++
    }

    // Add room filter if provided
    if (roomNumber) {
      whereConditions.push(`r.room_number = $${paramIndex}`)
      queryParams.push(roomNumber)
      paramIndex++
    }

    // Combine all conditions
    const whereClause = whereConditions.length > 0 
      ? `AND ${whereConditions.join(' AND ')}`
      : ''

    // Get all paid bills from both active bills and bill_history tables
    const billsResult = await pool.query(`
      WITH combined_bills AS (
        -- Active paid bills (bills that are paid but still in bills table)
        SELECT 
          b.id,
          b.tenant_id,
          b.room_id,
          b.rent_from,
          b.rent_to,
          b.rent_amount,
          b.electric_previous_reading,
          b.electric_present_reading,
          b.electric_consumption,
          b.electric_amount,
          b.electric_reading_date,
          b.electric_previous_date,
          b.water_amount,
          b.extra_fee_amount,
          b.extra_fee_description,
          b.total_amount,
          b.bill_date,
          b.due_date,
          b.status,
          b.is_final_bill,
          b.penalty_applied,
          b.penalty_fee_amount,
          b.prepared_by,
          b.notes,
          b.created_at,
          b.updated_at,
          t.name as tenant_name,
          r.room_number,
          br.name as branch_name,
          br.id as branch_id,
          -- Get the actual payment date from payments or payment_history table
          COALESCE(
            (SELECT COALESCE(p.actual_payment_date, p.payment_date)
             FROM payments p 
             WHERE p.bill_id = b.id 
             ORDER BY COALESCE(p.actual_payment_date, p.payment_date) DESC NULLS LAST
             LIMIT 1),
            (SELECT COALESCE(ph.actual_payment_date, ph.payment_date)
             FROM payment_history ph 
             WHERE ph.original_bill_id = b.id 
             ORDER BY COALESCE(ph.actual_payment_date, ph.payment_date) DESC NULLS LAST
             LIMIT 1)
          ) as payment_date,
          'active' as source_table,
          (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.bill_id = b.id) as total_paid,
          0 as remaining_balance
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'paid' ${whereClause.replace(/actual_payment_date/g, `COALESCE(
            (SELECT COALESCE(p.actual_payment_date, p.payment_date)
             FROM payments p 
             WHERE p.bill_id = b.id 
             ORDER BY COALESCE(p.actual_payment_date, p.payment_date) DESC NULLS LAST
             LIMIT 1),
            (SELECT COALESCE(ph.actual_payment_date, ph.payment_date)
             FROM payment_history ph 
             WHERE ph.original_bill_id = b.id 
             ORDER BY COALESCE(ph.actual_payment_date, ph.payment_date) DESC NULLS LAST
             LIMIT 1)
          )`)}
        
        UNION ALL
        
        -- Archived paid bills from bill_history
        SELECT 
          bh.original_bill_id as id,
          bh.original_tenant_id as tenant_id,
          bh.room_id,
          bh.rent_from,
          bh.rent_to,
          bh.rent_amount,
          bh.electric_previous_reading,
          bh.electric_present_reading,
          bh.electric_consumption,
          bh.electric_amount,
          bh.electric_reading_date,
          bh.electric_previous_date,
          bh.water_amount,
          bh.extra_fee_amount,
          bh.extra_fee_description,
          bh.total_amount,
          bh.bill_date,
          bh.due_date,
          bh.status,
          bh.is_final_bill,
          bh.penalty_applied,
          bh.penalty_fee_amount,
          bh.prepared_by,
          bh.notes,
          bh.created_at,
          bh.updated_at,
          bh.tenant_name,
          bh.room_number,
          bh.branch_name,
          r.branch_id,
          COALESCE(bh.actual_payment_date, bh.payment_date) as payment_date,
          'archived' as source_table,
          bh.total_paid,
          bh.remaining_balance
        FROM bill_history bh
        JOIN rooms r ON bh.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE bh.status = 'paid' ${whereClause.replace(/actual_payment_date/g, 'bh.actual_payment_date')}
      )
      SELECT * FROM combined_bills
      ORDER BY 
        payment_date DESC,
        bill_date DESC
    `, queryParams)

    const bills = billsResult.rows

    // Get summary statistics
    const summaryResult = await pool.query(`
      WITH combined_bills AS (
        -- Active paid bills
        SELECT 
          br.id as branch_id,
          br.name as branch_name,
          r.room_number,
          b.total_amount,
          COALESCE(
            (SELECT COALESCE(p.actual_payment_date, p.payment_date)
             FROM payments p 
             WHERE p.bill_id = b.id 
             ORDER BY COALESCE(p.actual_payment_date, p.payment_date) DESC NULLS LAST
             LIMIT 1),
            (SELECT COALESCE(ph.actual_payment_date, ph.payment_date)
             FROM payment_history ph 
             WHERE ph.original_bill_id = b.id 
             ORDER BY COALESCE(ph.actual_payment_date, ph.payment_date) DESC NULLS LAST
             LIMIT 1)
          ) as payment_date
        FROM bills b
        JOIN rooms r ON b.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'paid' ${whereClause.replace(/actual_payment_date/g, `COALESCE(
            (SELECT COALESCE(p.actual_payment_date, p.payment_date)
             FROM payments p 
             WHERE p.bill_id = b.id 
             ORDER BY COALESCE(p.actual_payment_date, p.payment_date) DESC NULLS LAST
             LIMIT 1),
            (SELECT COALESCE(ph.actual_payment_date, ph.payment_date)
             FROM payment_history ph 
             WHERE ph.original_bill_id = b.id 
             ORDER BY COALESCE(ph.actual_payment_date, ph.payment_date) DESC NULLS LAST
             LIMIT 1)
          )`)}
        
        UNION ALL
        
        -- Archived paid bills
        SELECT 
          br.id as branch_id,
          bh.branch_name,
          bh.room_number,
          bh.total_amount,
          COALESCE(bh.actual_payment_date, bh.payment_date) as payment_date
        FROM bill_history bh
        JOIN rooms r ON bh.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE bh.status = 'paid' ${whereClause.replace(/actual_payment_date/g, 'bh.actual_payment_date')}
      )
      SELECT 
        COUNT(*) as total_bills,
        SUM(total_amount) as total_amount,
        COUNT(DISTINCT branch_id) as total_branches,
        COUNT(DISTINCT room_number) as total_rooms,
        MIN(payment_date) as earliest_payment,
        MAX(payment_date) as latest_payment
      FROM combined_bills
    `, queryParams)

    const summary = summaryResult.rows[0]

    return NextResponse.json({
      success: true,
      bills,
      summary: {
        ...summary,
        total_bills: parseInt(summary.total_bills),
        total_amount: parseFloat(summary.total_amount),
        total_branches: parseInt(summary.total_branches),
        total_rooms: parseInt(summary.total_rooms)
      }
    })

  } catch (error) {
    console.error('Paid bills fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 