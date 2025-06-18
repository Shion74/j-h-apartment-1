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

    // Get all paid bills from both active bills and bill_history tables
    const billsResult = await pool.query(`
      SELECT * FROM (
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
          -- Get the actual payment date from payments table
          (SELECT p.actual_payment_date 
           FROM payments p 
           WHERE p.bill_id = b.id 
           ORDER BY p.actual_payment_date DESC NULLS LAST
           LIMIT 1) as actual_payment_date,
          (SELECT p.payment_date 
           FROM payments p 
           WHERE p.bill_id = b.id 
           ORDER BY p.payment_date DESC 
           LIMIT 1) as last_payment_date,
          'active' as source_table,
          (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.bill_id = b.id) as total_paid,
          0 as remaining_balance
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        LEFT JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'paid'
        
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
          bh.payment_date as actual_payment_date,
          bh.payment_date as last_payment_date,
          'archived' as source_table,
          bh.total_paid,
          bh.remaining_balance
        FROM bill_history bh
        WHERE bh.status = 'paid'
      ) combined_bills
      ORDER BY 
        COALESCE(actual_payment_date, last_payment_date, updated_at) DESC,
        bill_date DESC
    `)

    const bills = billsResult.rows
    return NextResponse.json({
      success: true,
      bills
    })

  } catch (error) {
    console.error('Paid bills fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 