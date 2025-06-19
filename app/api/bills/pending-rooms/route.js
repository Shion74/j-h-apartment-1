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

    // Get all rooms with their enhanced billing status
    const roomsResult = await pool.query(`
      SELECT 
        r.id as room_id,
        r.room_number,
        r.monthly_rent,
        r.status as room_status,
        b.name as branch_name,
        t.id as tenant_id,
        t.name as tenant_name,
        t.rent_start,
        t.initial_electric_reading,
        t.contract_start_date,
        t.contract_end_date,
        t.contract_status,
        -- Get previous electric reading (from last active bill, bill history, or initial reading)
        COALESCE(
          (SELECT electric_present_reading 
           FROM bills 
           WHERE tenant_id = t.id 
           ORDER BY bill_date DESC 
           LIMIT 1),
          (SELECT electric_present_reading 
           FROM bill_history 
           WHERE original_tenant_id = t.id 
           ORDER BY rent_to DESC 
           LIMIT 1),
          t.initial_electric_reading,
          0
        ) as previous_reading,
        -- Get previous reading date (from last active bill, bill history, or rent start date)
        COALESCE(
          (SELECT electric_reading_date 
           FROM bills 
           WHERE tenant_id = t.id 
           ORDER BY bill_date DESC 
           LIMIT 1),
          (SELECT electric_reading_date 
           FROM bill_history 
           WHERE original_tenant_id = t.id 
           ORDER BY rent_to DESC 
           LIMIT 1),
          t.rent_start
        ) as previous_reading_date,
        -- Calculate next billing period start based on tenant's billing cycle (consider both active bills and history)
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              -- If no bills exist in active table, check bill history for last period
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                CASE
                  -- Check if bills exist in history for this tenant
                  WHEN EXISTS (SELECT 1 FROM bill_history WHERE original_tenant_id = t.id) THEN
                    (SELECT TO_CHAR(rent_to + INTERVAL '1 day', 'YYYY-MM-DD')
                     FROM bill_history 
                     WHERE original_tenant_id = t.id 
                     ORDER BY rent_to DESC 
                     LIMIT 1)
                  -- No bills in history either, start from rent_start
                  ELSE TO_CHAR(t.rent_start, 'YYYY-MM-DD')
                END
              -- If active bills exist, start day after last active bill ended
              ELSE (
                SELECT TO_CHAR(rent_to + INTERVAL '1 day', 'YYYY-MM-DD')
                FROM bills 
                WHERE tenant_id = t.id 
                ORDER BY bill_date DESC 
                LIMIT 1
              )
            END
          ELSE TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
        END as next_period_start,
        -- Calculate next billing period end (maintains tenant's billing day pattern)
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              -- If no active bills, check history for pattern
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                CASE
                  -- If history exists, continue from last history bill
                  WHEN EXISTS (SELECT 1 FROM bill_history WHERE original_tenant_id = t.id) THEN
                    (SELECT TO_CHAR((rent_to + INTERVAL '1 day') + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
                     FROM bill_history 
                     WHERE original_tenant_id = t.id 
                     ORDER BY rent_to DESC 
                     LIMIT 1)
                  -- No history, first bill: one month from rent_start
                  ELSE TO_CHAR(t.rent_start + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
                END
              -- Active bills exist, continue from last active bill
              ELSE (
                SELECT TO_CHAR((rent_to + INTERVAL '1 day') + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
                FROM bills 
                WHERE tenant_id = t.id 
                ORDER BY bill_date DESC 
                LIMIT 1
              )
            END
          ELSE TO_CHAR(DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day', 'YYYY-MM-DD')
        END as next_period_end,
        -- Enhanced billing status logic (consider both active bills and history)
        CASE 
          WHEN t.id IS NULL THEN 'no_tenant'
          -- Check if tenant has unpaid bills (business rule: can't create new bills with unpaid bills)
          WHEN EXISTS (
            SELECT 1 FROM bills b2 
            WHERE b2.tenant_id = t.id 
            AND b2.status IN ('unpaid', 'partial')
          ) THEN 'has_unpaid_bills'
          -- Check if there's already a bill for the calculated next period
          WHEN EXISTS (
            SELECT 1 FROM bills b 
            WHERE b.tenant_id = t.id 
            AND b.rent_from::date = (
              CASE 
                -- No active bills, check history for next period start
                WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                  CASE
                    WHEN EXISTS (SELECT 1 FROM bill_history WHERE original_tenant_id = t.id) THEN
                      (SELECT (rent_to + INTERVAL '1 day')::date FROM bill_history WHERE original_tenant_id = t.id ORDER BY rent_to DESC LIMIT 1)
                    ELSE t.rent_start::date
                  END
                -- Active bills exist, use last active bill
                ELSE (SELECT (rent_to + INTERVAL '1 day')::date FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1)
              END
            )
          ) THEN 'already_billed'
          -- Check if tenant needs billing (only in last 3 days of CURRENT billing cycle)
          WHEN t.rent_start IS NOT NULL AND (
            -- Calculate current billing cycle end date
            CASE 
              -- If no active bills, check if we're in first billing cycle
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                CASE
                  -- If history exists, we're continuing from where history left off
                  WHEN EXISTS (SELECT 1 FROM bill_history WHERE original_tenant_id = t.id) THEN
                    -- Current cycle ends at: last_history_end + 1 month
                    CURRENT_DATE >= (SELECT rent_to + INTERVAL '1 day' + INTERVAL '1 month' - INTERVAL '1 day' - INTERVAL '3 days' 
                                   FROM bill_history 
                                   WHERE original_tenant_id = t.id 
                                   ORDER BY rent_to DESC 
                                   LIMIT 1)
                  -- No history, this is truly the first cycle
                  ELSE 
                    -- Current cycle ends at: rent_start + 1 month - 1 day
                    CURRENT_DATE >= (t.rent_start + INTERVAL '1 month' - INTERVAL '1 day' - INTERVAL '3 days')::date
                END
              -- Active bills exist, we're in the cycle that starts after the last bill
              ELSE 
                -- Current cycle ends at: last_bill_end + 1 month  
                CURRENT_DATE >= (SELECT rent_to + INTERVAL '1 day' + INTERVAL '1 month' - INTERVAL '1 day' - INTERVAL '3 days' 
                               FROM bills 
                               WHERE tenant_id = t.id 
                               ORDER BY bill_date DESC 
                               LIMIT 1)
            END
          ) THEN 'needs_billing'
          ELSE 'up_to_date'
        END as billing_status,
        -- Days until next due date (for display) - consider both active bills and history
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              -- If no active bills, check history for last period
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                CASE
                  -- If history exists, calculate from last history bill
                  WHEN EXISTS (SELECT 1 FROM bill_history WHERE original_tenant_id = t.id) THEN
                    EXTRACT(DAY FROM (
                      SELECT (rent_to + INTERVAL '1 day' + INTERVAL '1 month' - INTERVAL '1 day') - CURRENT_DATE 
                      FROM bill_history 
                      WHERE original_tenant_id = t.id 
                      ORDER BY rent_to DESC 
                      LIMIT 1
                    ))
                  -- No history, calculate from initial rent_start
                  ELSE EXTRACT(DAY FROM (t.rent_start + INTERVAL '1 month' - INTERVAL '1 day') - CURRENT_DATE)
                END
              -- Active bills exist, calculate from last active bill
              ELSE 
                EXTRACT(DAY FROM (SELECT (rent_to + INTERVAL '1 day' + INTERVAL '1 month' - INTERVAL '1 day') - CURRENT_DATE FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1))
            END
          ELSE NULL
        END as days_until_due
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND (t.contract_status = 'active' OR t.contract_status = 'renewed')
      ORDER BY b.name, r.room_number
    `)

    const rooms = roomsResult.rows

    return NextResponse.json({
      success: true,
      rooms
    })

  } catch (error) {
    console.error('Pending rooms fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 