import { NextResponse } from 'next/server'
import { pool } from '../../../../../lib/database'
import { requireAuth } from '../../../../../lib/auth'
import { saveReceiptToFile } from '../../../../../services/receiptService'
import path from 'path'
import fs from 'fs'

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

    const { billId } = params

    // Get bill details
    const [billRows] = await pool.execute(`
      SELECT 
        b.*,
        t.name as tenant_name,
        r.room_number,
        br.name as branch_name,
        br.address as branch_address
      FROM bills b
      JOIN tenants t ON b.tenant_id = t.id
      JOIN rooms r ON b.room_id = r.id
      LEFT JOIN branches br ON r.branch_id = br.id
      WHERE b.id = ?
    `, [billId])

    if (billRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Bill not found' },
        { status: 404 }
      )
    }

    const bill = billRows[0]

    if (bill.status !== 'paid') {
      return NextResponse.json(
        { success: false, message: 'Receipt only available for fully paid bills' },
        { status: 400 }
      )
    }

    // Get payments for this bill
    const [payments] = await pool.execute(
      'SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date',
      [billId]
    )

    // Check if receipt already exists
    const receiptsDir = path.join(process.cwd(), 'public', 'receipts')
    
    try {
      await fs.promises.access(receiptsDir)
    } catch {
      await fs.promises.mkdir(receiptsDir, { recursive: true })
    }

    const files = await fs.promises.readdir(receiptsDir)
    const receiptFile = files.find(file => file.startsWith(`receipt-${billId}-`))

    let filePath

    if (receiptFile) {
      // Use existing receipt
      filePath = path.join(receiptsDir, receiptFile)
    } else {
      // Generate new receipt
      const receiptResult = await saveReceiptToFile(bill, payments)
      
      if (!receiptResult.success) {
        return NextResponse.json(
          { success: false, message: 'Failed to generate receipt' },
          { status: 500 }
        )
      }

      filePath = receiptResult.filepath
    }

    // Read file and return as response
    const fileBuffer = await fs.promises.readFile(filePath)
    const filename = `receipt-room-${bill.room_number}-${bill.id}.pdf`

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Receipt download error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
} 