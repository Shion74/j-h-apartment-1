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
    const [rooms] = await pool.execute(`
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
        -- Get previous electric reading (from last bill or initial reading)
        COALESCE(
          (SELECT electric_present_reading 
           FROM bills 
           WHERE tenant_id = t.id 
           ORDER BY bill_date DESC 
           LIMIT 1), 
          t.initial_electric_reading,
          0
        ) as previous_reading,
        -- Get previous reading date (from last bill or rent start date)
        COALESCE(
          (SELECT electric_reading_date 
           FROM bills 
           WHERE tenant_id = t.id 
           ORDER BY bill_date DESC 
           LIMIT 1), 
          t.rent_start
        ) as previous_reading_date,
        -- Calculate next billing period start based on tenant's billing cycle
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              -- If no bills exist, start from rent_start date
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN t.rent_start
              -- If bills exist, start day after last bill ended
              ELSE DATE_ADD(
                (SELECT rent_to 
                 FROM bills 
                 WHERE tenant_id = t.id 
                 ORDER BY bill_date DESC 
                 LIMIT 1), 
                INTERVAL 1 DAY
              )
            END
          ELSE CURDATE()
        END as next_period_start,
        -- Calculate next billing period end (maintains tenant's billing day pattern)
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              -- For first bill: one month from rent_start, same day of month
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                DATE_SUB(
                  DATE_ADD(t.rent_start, INTERVAL 1 MONTH), 
                  INTERVAL 1 DAY
                )
              -- For subsequent bills: one month from next period start, same day pattern
              ELSE 
                DATE_SUB(
                  DATE_ADD(
                    DATE_ADD(
                      (SELECT rent_to 
                       FROM bills 
                       WHERE tenant_id = t.id 
                       ORDER BY bill_date DESC 
                       LIMIT 1), 
                      INTERVAL 1 DAY
                    ),
                    INTERVAL 1 MONTH
                  ),
                  INTERVAL 1 DAY
                )
            END
          ELSE LAST_DAY(CURDATE())
        END as next_period_end,
        -- Enhanced billing status logic
        CASE 
          WHEN t.id IS NULL THEN 'no_tenant'
          WHEN EXISTS (
            SELECT 1 FROM bills b 
            WHERE b.tenant_id = t.id 
            AND b.status IN ('unpaid', 'partial')
          ) THEN 'already_billed'
          -- Check if cycle is ending (3 days before due date)
          WHEN t.rent_start IS NOT NULL AND EXISTS (
            SELECT 1 FROM bills b 
            WHERE b.tenant_id = t.id 
            AND b.status = 'paid'
            AND DATEDIFF(
              DATE_SUB(
                DATE_ADD(
                  DATE_ADD(b.rent_to, INTERVAL 1 DAY),
                  INTERVAL 1 MONTH
                ),
                INTERVAL 1 DAY
              ), 
              CURDATE()
            ) <= 3
            AND DATEDIFF(
              DATE_SUB(
                DATE_ADD(
                  DATE_ADD(b.rent_to, INTERVAL 1 DAY),
                  INTERVAL 1 MONTH
                ),
                INTERVAL 1 DAY
              ), 
              CURDATE()
            ) >= 0
            ORDER BY b.bill_date DESC 
            LIMIT 1
          ) THEN 'needs_billing'
          -- For first-time tenants, check if it's time for first bill (3 days before first cycle ends)
          WHEN t.rent_start IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM bills WHERE tenant_id = t.id
          ) AND DATEDIFF(
            DATE_SUB(
              DATE_ADD(t.rent_start, INTERVAL 1 MONTH), 
              INTERVAL 1 DAY
            ), 
            CURDATE()
          ) <= 3
          AND DATEDIFF(
            DATE_SUB(
              DATE_ADD(t.rent_start, INTERVAL 1 MONTH), 
              INTERVAL 1 DAY
            ), 
            CURDATE()
          ) >= 0 THEN 'needs_billing'
          -- On due date, definitely needs billing
          WHEN t.rent_start IS NOT NULL AND (
            -- First bill due date reached
            (NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) 
             AND CURDATE() >= DATE_SUB(DATE_ADD(t.rent_start, INTERVAL 1 MONTH), INTERVAL 1 DAY))
            OR
            -- Subsequent bill due date reached
            (EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id AND status = 'paid')
             AND CURDATE() >= DATE_SUB(
               DATE_ADD(
                 DATE_ADD(
                   (SELECT rent_to FROM bills WHERE tenant_id = t.id AND status = 'paid' ORDER BY bill_date DESC LIMIT 1), 
                   INTERVAL 1 DAY
                 ),
                 INTERVAL 1 MONTH
               ),
               INTERVAL 1 DAY
             ))
          ) THEN 'needs_billing'
          ELSE 'up_to_date'
        END as billing_status,
        -- Days until next due date (for display)
        CASE 
          WHEN t.rent_start IS NOT NULL THEN
            CASE 
              WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                DATEDIFF(
                  DATE_SUB(DATE_ADD(t.rent_start, INTERVAL 1 MONTH), INTERVAL 1 DAY), 
                  CURDATE()
                )
              ELSE 
                DATEDIFF(
                  DATE_SUB(
                    DATE_ADD(
                      DATE_ADD(
                        (SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1), 
                        INTERVAL 1 DAY
                      ),
                      INTERVAL 1 MONTH
                    ),
                    INTERVAL 1 DAY
                  ), 
                  CURDATE()
                )
            END
          ELSE NULL
        END as days_until_due
      FROM rooms r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
      ORDER BY b.name, r.room_number
    `)

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