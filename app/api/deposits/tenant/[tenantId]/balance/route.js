import { NextResponse } from 'next/server'
import { pool } from '../../../../../../lib/database'
import { requireAuth } from '../../../../../../lib/auth'

export async function GET(request, { params }) {
  try {
    // Check authentication
    const authResult = requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(
        { success: false, message: authResult.error },
        { status: authResult.status }
      )
    }

    const { tenantId } = params
    console.log('Fetching deposits for tenant ID:', tenantId)

    // First check if tenant exists
    const tenantResult = await pool.query(`
      SELECT id, name FROM tenants WHERE id = $1
    `, [tenantId])

    if (tenantResult.rows.length === 0) {
      console.log(`❌ Tenant with ID ${tenantId} not found`)
      return NextResponse.json(
        { success: false, message: 'Tenant not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Found tenant: ${tenantResult.rows[0].name} (ID: ${tenantResult.rows[0].id})`)

    // Get tenant deposits from tenant_deposits table
    const depositsResult = await pool.query(`
      SELECT 
        deposit_type,
        initial_amount,
        remaining_balance,
        status
      FROM tenant_deposits 
      WHERE tenant_id = $1 AND status = 'active'
    `, [tenantId])

    console.log(`Found ${depositsResult.rows.length} deposit records for tenant ${tenantId}`)
    console.log('Raw deposits from database:', depositsResult.rows)

    // If no deposits found, check if they need to be created from migration
    if (depositsResult.rows.length === 0) {
      console.log(`⚠️ No deposits found for tenant ${tenantId}, checking if we need to create them`)
      
      // Check if there are any tenant_deposits records for this tenant (even inactive ones)
      const allDepositsResult = await pool.query(`
        SELECT COUNT(*) as count FROM tenant_deposits WHERE tenant_id = $1
      `, [tenantId])
      
      console.log(`Total deposit records (including inactive): ${allDepositsResult.rows[0].count}`)
      
      if (parseInt(allDepositsResult.rows[0].count) === 0) {
        console.log(`⚠️ No deposits at all for tenant ${tenantId}, should run migration script`)
        
        // For testing, let's create default deposits
        try {
          await pool.query(`
            INSERT INTO tenant_deposits (tenant_id, deposit_type, initial_amount, remaining_balance, status, notes)
            VALUES 
              ($1, 'advance', 3500.00, 3500.00, 'active', 'Auto-created by API'),
              ($1, 'security', 3500.00, 3500.00, 'active', 'Auto-created by API')
          `, [tenantId])
          console.log(`✅ Created default deposits for tenant ${tenantId}`)
          
          // Fetch the newly created deposits
          const newDepositsResult = await pool.query(`
            SELECT 
              deposit_type,
              initial_amount,
              remaining_balance,
              status
            FROM tenant_deposits 
            WHERE tenant_id = $1 AND status = 'active'
          `, [tenantId])
          
          console.log('Newly created deposits:', newDepositsResult.rows)
          depositsResult.rows = newDepositsResult.rows
        } catch (error) {
          console.error('Error creating default deposits:', error)
        }
      }
    }

    // Calculate balances for each deposit type
    const deposits = {
      advance: {
        total: 0,
        available: 0,
        status: 'active'
      },
      security: {
        total: 0,
        available: 0,
        status: 'active'
      }
    }

    // Process each deposit record
    depositsResult.rows.forEach(deposit => {
      if (deposit.deposit_type === 'advance' || deposit.deposit_type === 'security') {
        deposits[deposit.deposit_type] = {
          total: parseFloat(deposit.initial_amount) || 0,
          available: parseFloat(deposit.remaining_balance) || 0,
          status: deposit.status
        }
      }
    })

    console.log('Final processed deposits:', deposits)

    return NextResponse.json({
      success: true,
      deposits
    })

  } catch (error) {
    console.error('Deposit balance fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
} 