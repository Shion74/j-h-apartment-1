-- Manual SQL script to fix orphaned rooms
-- Run this in phpMyAdmin to fix rooms that are marked as occupied but have no active tenants

-- First, let's see which rooms are orphaned
SELECT 
    r.id, 
    r.room_number, 
    b.name as branch_name, 
    r.status,
    'ORPHANED - No active tenant' as issue
FROM rooms r
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
WHERE r.status = 'occupied' AND t.id IS NULL
ORDER BY b.name, r.room_number;

-- Now fix the orphaned rooms by setting them to vacant
UPDATE rooms r
LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
SET r.status = 'vacant', r.updated_at = CURRENT_TIMESTAMP
WHERE r.status = 'occupied' AND t.id IS NULL;

-- Verify the fix - this should return no results if successful
SELECT 
    r.id, 
    r.room_number, 
    b.name as branch_name, 
    r.status
FROM rooms r
LEFT JOIN branches b ON r.branch_id = b.id
LEFT JOIN tenants t ON r.id = t.room_id AND t.contract_status = 'active'
WHERE r.status = 'occupied' AND t.id IS NULL
ORDER BY b.name, r.room_number;

-- Show current room statistics
SELECT 
    COUNT(*) as total_rooms,
    SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
    SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant,
    SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
FROM rooms; 