(()=>{var e={};e.id=2642,e.ids=[2642,9300],e.modules={47495:e=>{function t(e){var t=Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}t.keys=()=>[],t.resolve=t,t.id=47495,e.exports=t},67096:e=>{"use strict";e.exports=require("bcrypt")},20399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},45184:e=>{"use strict";e.exports=require("nodemailer")},78893:e=>{"use strict";e.exports=require("buffer")},84770:e=>{"use strict";e.exports=require("crypto")},17702:e=>{"use strict";e.exports=require("events")},32615:e=>{"use strict";e.exports=require("http")},35240:e=>{"use strict";e.exports=require("https")},98216:e=>{"use strict";e.exports=require("net")},68621:e=>{"use strict";e.exports=require("punycode")},76162:e=>{"use strict";e.exports=require("stream")},82452:e=>{"use strict";e.exports=require("tls")},17360:e=>{"use strict";e.exports=require("url")},21764:e=>{"use strict";e.exports=require("util")},71568:e=>{"use strict";e.exports=require("zlib")},8678:e=>{"use strict";e.exports=import("pg")},58359:()=>{},93739:()=>{},39499:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{originalPathname:()=>m,patchFetch:()=>d,requestAsyncStorage:()=>u,routeModule:()=>c,serverHooks:()=>E,staticGenerationAsyncStorage:()=>_});var n=r(49303),i=r(88716),s=r(60670),l=r(72087),o=e([l]);l=(o.then?(await o)():o)[0];let c=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/bills/reminders/route",pathname:"/api/bills/reminders",filename:"route",bundlePath:"app/api/bills/reminders/route"},resolvedPagePath:"C:\\Users\\joshu_mnu8z3u\\Downloads\\j-h-apartment-main-1\\app\\api\\bills\\reminders\\route.js",nextConfigOutput:"",userland:l}),{requestAsyncStorage:u,staticGenerationAsyncStorage:_,serverHooks:E}=c,m="/api/bills/reminders/route";function d(){return(0,s.patchFetch)({serverHooks:E,staticGenerationAsyncStorage:_})}a()}catch(e){a(e)}})},72087:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.r(t),r.d(t,{GET:()=>u,POST:()=>c});var n=r(87070),i=r(97175),s=r(77999),l=r(94976),o=r(58515),d=e([i,o]);async function c(e){try{let t=(0,s.requireAuth)(e);if(t.error)return n.NextResponse.json({success:!1,message:t.error},{status:t.status});console.log("\uD83D\uDD14 Processing billing reminders...");let r=await o.Z.getBillsNeedingReminders();if(0===r.length)return console.log("✅ No tenants need bill creation reminders today"),n.NextResponse.json({success:!0,message:"No tenants need bill creation reminders today",tenants_processed:0,reminders_sent:0});console.log(`📋 Found ${r.length} tenants needing bill creation reminders`);let a=new Date().toISOString().split("T")[0],d=[];for(let e of r){let t=(await i.d_.query(`
        SELECT id FROM billing_reminders 
        WHERE tenant_id = $1 AND reminder_date = $2 AND reminder_type = 'bill_creation'
      `,[e.tenant_id,a])).rows;0===t.length&&d.push(e)}if(0===d.length)return console.log("✅ All bill creation reminders for today have already been sent"),n.NextResponse.json({success:!0,message:"All bill creation reminders for today have already been sent",tenants_processed:r.length,reminders_sent:0});console.log(`📧 Sending bill creation reminder for ${d.length} tenants`);let c=await l.default.sendBillingReminderToManagement(d),u=0,_=[];if(c.success){for(let e of d)try{await i.d_.query(`
            INSERT INTO billing_reminders 
            (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at, reminder_type) 
            VALUES ($1, $2, $3, TRUE, NOW(), 'bill_creation') RETURNING id
          `,[e.tenant_id,a,e.days_until_due]),await i.d_.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, sent_at) 
            VALUES ($1, 'bill_creation_reminder', $2, 'official.jhapartment@gmail.com', 'sent', NOW()) RETURNING id
          `,[e.tenant_id,`Bill Creation Reminder - ${e.tenant_name} - Room ${e.room_number}`]),u++}catch(t){console.error(`❌ Failed to record reminder for tenant ${e.tenant_id}:`,t),_.push({tenant_id:e.tenant_id,tenant_name:e.tenant_name,error:t.message})}console.log(`✅ Successfully sent bill creation reminder email for ${u} tenants`)}else for(let e of(console.error("❌ Failed to send bill creation reminder email:",c.error),d))try{await i.d_.query(`
            INSERT INTO billing_reminders 
            (tenant_id, reminder_date, days_before_due, email_sent, email_sent_at, reminder_type) 
            VALUES ($1, $2, $3, FALSE, NULL, 'bill_creation') RETURNING id
          `,[e.tenant_id,a,e.days_until_due]),await i.d_.query(`
            INSERT INTO email_notifications 
            (tenant_id, email_type, email_subject, recipient_email, status, error_message) 
            VALUES ($1, 'bill_creation_reminder', $2, 'official.jhapartment@gmail.com', 'failed', $3) RETURNING id
          `,[e.tenant_id,`Bill Creation Reminder - ${e.tenant_name} - Room ${e.room_number}`,c.error])}catch(t){console.error(`❌ Failed to record failed reminder for tenant ${e.tenant_id}:`,t)}return n.NextResponse.json({success:!0,message:c.success?`Bill creation reminder sent successfully for ${u} tenants`:`Failed to send bill creation reminder: ${c.error}`,tenants_processed:r.length,tenants_to_remind:d.length,reminders_sent:u,email_result:c,errors:_.length>0?_:void 0})}catch(e){return console.error("❌ Billing reminders error:",e),n.NextResponse.json({success:!1,message:"Internal server error",error:e.message},{status:500})}}async function u(e){try{let t=(0,s.requireAuth)(e);if(t.error)return n.NextResponse.json({success:!1,message:t.error},{status:t.status});let r=await o.Z.getBillsNeedingReminders(),a=new Date().toISOString().split("T")[0],l=[];for(let e of r){let t=(await i.d_.query(`
        SELECT id, email_sent, email_sent_at FROM billing_reminders 
        WHERE tenant_id = $1 AND reminder_date = $2 AND reminder_type = 'bill_creation'
      `,[e.tenant_id,a])).rows;l.push({...e,reminder_sent_today:t.length>0,reminder_details:t[0]||null})}return n.NextResponse.json({success:!0,tenants_needing_reminders:r.length,tenants_without_reminders_today:l.filter(e=>!e.reminder_sent_today).length,tenants:l})}catch(e){return console.error("❌ Get billing reminders error:",e),n.NextResponse.json({success:!1,message:"Internal server error",error:e.message},{status:500})}}[i,o]=d.then?(await d)():d,a()}catch(e){a(e)}})},77999:(e,t,r)=>{"use strict";let a=r(41482),n=r(67096),i="your-jwt-secret-here";function s(e){try{return a.verify(e,i)}catch(e){return null}}async function l(e){try{return await n.hash(e,10)}catch(e){throw Error("Error hashing password")}}async function o(e,t){try{return await n.compare(e,t)}catch(e){throw Error("Error comparing passwords")}}e.exports={generateToken:function(e){return a.sign({id:e.id,username:e.username,role:e.role},i,{expiresIn:"24h"})},verifyToken:s,hashPassword:l,comparePassword:o,requireAuth:function(e){let t=e.headers.get?e.headers.get("authorization"):e.headers.authorization,r=t?.replace("Bearer ","");if(!r)return{error:"No token provided",status:401};let a=s(r);return a?{user:a}:{error:"Invalid token",status:401}}}},97175:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.d(t,{M7:()=>l,d_:()=>c});var n=r(8678),i=r(40785),s=e([n]);n=(s.then?(await s)():s)[0];let o=process.env.SUPABASE_KEY||"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbHhvaGV5a2tkZnFzYWt2Y2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5MjI4ODAsImV4cCI6MjA2NTQ5ODg4MH0.i-Mc45-v-j14QLidCt73idarVbvEMzVVWwtDM1ROCWA";(0,i.createClient)("https://qalxoheykkdfqsakvcad.supabase.co",o);let d=`postgresql://postgres.qalxoheykkdfqsakvcad:${process.env.SUPABASE_DB_PASSWORD||"E$rNc9z?Wtpgq&%"}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,c=new n.Pool({connectionString:d,ssl:{rejectUnauthorized:!1},max:1,idleTimeoutMillis:1e3,connectionTimeoutMillis:1e4,acquireTimeoutMillis:1e4});async function l(){try{let e=await c.connect();return console.log("PostgreSQL database connection successful"),e.release(),!0}catch(e){return console.error("Database connection failed:",e),!1}}a()}catch(e){a(e)}})},58515:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.d(t,{Z:()=>o});var n=r(97175),i=r(89300),s=e([n,i]);[n,i]=s.then?(await s)():s;class l{static async findAll(){try{return(await n.d_.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        ORDER BY b.bill_date DESC
      `)).rows}catch(e){throw console.error("Error finding all bills:",e),e}}static async findUnpaid(){try{return(await n.d_.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'unpaid' OR b.status = 'partial'
        ORDER BY b.bill_date
      `)).rows}catch(e){throw console.error("Error finding unpaid bills:",e),e}}static async findActive(){try{return(await n.d_.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.status IN ('unpaid', 'partial')
        ORDER BY b.bill_date DESC
      `)).rows}catch(e){throw console.error("Error finding active bills:",e),e}}static async findPaid(){try{return(await n.d_.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name,
               p.payment_date as paid_date
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        LEFT JOIN (
          SELECT bill_id, MAX(payment_date) as payment_date
          FROM payments
          GROUP BY bill_id
        ) p ON b.id = p.bill_id
        WHERE b.status = 'paid'
        ORDER BY b.bill_date DESC
      `)).rows}catch(e){throw console.error("Error finding paid bills:",e),e}}static async findByTenantId(e){try{return(await n.d_.query(`
        SELECT b.*, r.room_number, br.name as branch_name,
          (SELECT SUM(amount) FROM payments WHERE bill_id = b.id) as paid_amount
        FROM bills b
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.tenant_id = $1
        ORDER BY b.bill_date DESC
      `,[e])).rows}catch(e){throw console.error("Error finding bills by tenant ID:",e),e}}static async findById(e){try{let t=await n.d_.query(`
        SELECT b.*, t.name as tenant_name, r.room_number, br.name as branch_name
        FROM bills b
        JOIN tenants t ON b.tenant_id = t.id
        JOIN rooms r ON b.room_id = r.id
        JOIN branches br ON r.branch_id = br.id
        WHERE b.id = $1
      `,[e]);if(!t.rows.length)return null;let r=t.rows[0],a=await n.d_.query("SELECT * FROM payments WHERE bill_id = $1 ORDER BY payment_date DESC",[e]);return r.payments=a.rows,r.paid_amount=a.rows.reduce((e,t)=>e+Number(t.amount),0),r}catch(e){throw console.error("Error finding bill by ID:",e),e}}static async create(e){let{tenant_id:t,room_id:r,bill_date:a,rent_from:s,rent_to:l,rent_amount:o,electric_present_reading:d=0,electric_previous_reading:c=0,electric_consumption:u=0,electric_amount:_=0,electric_reading_date:E,electric_previous_date:m,water_amount:b,extra_fee_amount:p=0,extra_fee_description:N=null,total_amount:h,status:R="unpaid",notes:y,prepared_by:g}=e;try{let T=await i.default.getBillingRates(),O=e.electric_rate_per_kwh||T.electric_rate_per_kwh,w=b||T.water_fixed_amount;return{id:(await n.d_.query(`
        INSERT INTO bills (
          tenant_id, room_id, bill_date, rent_from, rent_to, rent_amount,
          electric_present_reading, electric_previous_reading, electric_consumption, 
          electric_rate_per_kwh, electric_amount, electric_reading_date, electric_previous_date,
          water_amount, extra_fee_amount, extra_fee_description, total_amount, status, notes, prepared_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
      `,[t??null,r??null,a??null,s??null,l??null,o??null,d??0,c??0,u??0,O??null,_??0,E??null,m??null,w??null,p??0,N??null,h??null,R??"unpaid",y??null,g??null])).rows[0].id,...e,electric_rate_per_kwh:O,water_amount:w}}catch(e){throw console.error("Error creating new bill:",e),e}}static async update(e,t){let{bill_date:r,rent_from:a,rent_to:i,rent_amount:s,electric_present_reading:l,electric_previous_reading:o,electric_consumption:d,electric_rate_per_kwh:c,electric_amount:u,electric_reading_date:_,electric_previous_date:E,water_amount:m,total_amount:b,status:p,notes:N,prepared_by:h}=t;try{return await n.d_.query(`
        UPDATE bills SET 
          bill_date = $1, rent_from = $2, rent_to = $3, rent_amount = $4,
          electric_present_reading = $5, electric_previous_reading = $6, electric_consumption = $7, 
          electric_rate_per_kwh = $8, electric_amount = $9, electric_reading_date = $10, electric_previous_date = $11,
          water_amount = $12, total_amount = $13, status = $14, notes = $15, prepared_by = $16
        WHERE id = $17
      `,[r??null,a??null,i??null,s??null,l??null,o??null,d??null,c??null,u??null,_??null,E??null,m??null,b??null,p??null,N??null,h??null,e]),{id:e,...t}}catch(e){throw console.error("Error updating bill:",e),e}}static async delete(e){try{return await n.d_.query("DELETE FROM bills WHERE id = $1",[e]),!0}catch(e){throw console.error("Error deleting bill:",e),e}}static async updateStatus(e,t){try{return await n.d_.query("UPDATE bills SET status = $1 WHERE id = $2",[t,e]),!0}catch(e){throw console.error("Error updating bill status:",e),e}}static async calculateUtilityAmounts(e,t){try{let r=await i.default.getBillingRates(),a=Math.max(0,e-t),n=a*r.electric_rate_per_kwh;return{consumption:a,electricAmount:n,waterAmount:r.water_fixed_amount,electricRate:r.electric_rate_per_kwh}}catch(e){throw console.error("Error calculating utility amounts:",e),e}}static async getStats(){try{return(await n.d_.query(`
        SELECT
          COUNT(*) as total_bills,
          SUM(total_amount) as total_amount,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
          SUM(CASE WHEN status = 'unpaid' THEN total_amount ELSE 0 END) as unpaid_amount,
          SUM(CASE WHEN status = 'partial' THEN total_amount ELSE 0 END) as partial_amount,
          AVG(total_amount) as average_bill_amount,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
          COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_bills,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_bills
        FROM bills
      `)).rows[0]}catch(e){throw console.error("Error getting bill statistics:",e),e}}static async getBillsNeedingElectricUpdate(){try{return(await n.d_.query(`
        SELECT 
          b.*,
          t.name as tenant_name,
          t.email as tenant_email,
          r.room_number,
          r.monthly_rent,
          br.name as branch_name,
          br.address as branch_address
        FROM bills b
        INNER JOIN tenants t ON b.tenant_id = t.id
        INNER JOIN rooms r ON b.room_id = r.id
        INNER JOIN branches br ON r.branch_id = br.id
        WHERE b.status = 'unpaid'
        AND b.electric_consumption = 0
        AND EXTRACT(DAY FROM (b.rent_to - CURRENT_DATE)) <= 3
        AND EXTRACT(DAY FROM (b.rent_to - CURRENT_DATE)) >= 0
        ORDER BY b.rent_to ASC
      `)).rows}catch(e){throw console.error("Error finding bills needing electric update:",e),e}}static async updateElectricReading(e,t,r){try{let a=await this.findById(e);if(!a)throw Error("Bill not found");let s=parseFloat(a.electric_previous_reading)||0,l=parseFloat(t)||0,o=Math.max(0,l-s),d=await i.default.getBillingRates(),c=o*d.electric_rate_per_kwh,u=parseFloat(a.rent_amount)+c+parseFloat(a.water_amount);return await n.d_.query(`
        UPDATE bills SET 
          electric_present_reading = $1,
          electric_consumption = $2,
          electric_amount = $3,
          electric_reading_date = $4,
          total_amount = $5,
          notes = COALESCE(notes, '') || ' | Electric reading updated: ' || $6 || ' kWh on ' || $7
        WHERE id = $8
      `,[l,o,c,r,u,l,r,e]),{success:!0,previousReading:s,currentReading:l,consumption:o,electricAmount:c,newTotal:u,message:`Electric reading updated: ${o} kWh consumed, ₱${c.toFixed(2)} charged`}}catch(e){throw console.error("Error updating electric reading:",e),e}}static async markAsReadyToSend(e){try{return(await n.d_.query(`
        UPDATE bills SET 
          notes = COALESCE(notes, '') || ' | Bill finalized and ready to send',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,[e])).rowCount>0}catch(e){throw console.error("Error marking bill as ready to send:",e),e}}static async getBillsNeedingReminders(){try{return(await n.d_.query(`
        SELECT 
          t.id as tenant_id,
          t.name as tenant_name,
          t.email as tenant_email,
          t.rent_start,
          r.id as room_id,
          r.room_number,
          r.monthly_rent,
          br.name as branch_name,
          br.address as branch_address,
          -- Calculate next billing period end date
          CASE 
            WHEN t.rent_start IS NOT NULL THEN
              CASE 
                -- For first bill: one month from rent_start, same day of month
                WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                  (t.rent_start + INTERVAL '1 month') - INTERVAL '1 day'
                -- For subsequent bills: one month from last bill end date
                ELSE 
                  ((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day'
              END
            ELSE DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
          END as next_bill_due_date,
          -- Calculate days until billing cycle ends
          CASE 
            WHEN t.rent_start IS NOT NULL THEN
              CASE 
                WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
                  EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE)
                ELSE 
                  EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE)
              END
            ELSE NULL
          END as days_until_due,
          -- Check if tenant already has an unpaid bill
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM bills b2 
              WHERE b2.tenant_id = t.id 
              AND b2.status IN ('unpaid', 'partial')
            ) THEN 'already_has_unpaid_bill'
            ELSE 'needs_billing'
          END as billing_status,
          -- Get last electric reading
          COALESCE(
            (SELECT electric_present_reading 
             FROM bills 
             WHERE tenant_id = t.id 
             ORDER BY bill_date DESC 
             LIMIT 1), 
            t.initial_electric_reading,
            0
          ) as last_electric_reading
        FROM tenants t
        INNER JOIN rooms r ON t.room_id = r.id
        INNER JOIN branches br ON r.branch_id = br.id
        WHERE t.contract_status = 'active'
        AND t.rent_start IS NOT NULL
        -- Only tenants who don't already have unpaid bills
        AND NOT EXISTS (
          SELECT 1 FROM bills b2 
          WHERE b2.tenant_id = t.id 
          AND b2.status IN ('unpaid', 'partial')
        )
        -- Only tenants whose billing cycle is ending in 3 days or less (but not overdue)
        AND CASE 
          WHEN NOT EXISTS (SELECT 1 FROM bills WHERE tenant_id = t.id) THEN
            EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) <= 3
            AND EXTRACT(DAY FROM ((t.rent_start + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) >= 0
          ELSE 
            EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) <= 3
            AND EXTRACT(DAY FROM (((SELECT rent_to FROM bills WHERE tenant_id = t.id ORDER BY bill_date DESC LIMIT 1) + INTERVAL '1 day' + INTERVAL '1 month') - INTERVAL '1 day') - CURRENT_DATE) >= 0
        END
        ORDER BY br.name, r.room_number
      `)).rows}catch(e){throw console.error("Error finding tenants needing bill creation reminders:",e),e}}}let o=l;a()}catch(e){a(e)}})},89300:(e,t,r)=>{"use strict";r.a(e,async(e,a)=>{try{r.d(t,{default:()=>l});var n=r(97175),i=e([n]);n=(i.then?(await i)():i)[0];class s{static async findAll(){try{return(await n.d_.query("SELECT * FROM settings ORDER BY setting_key")).rows}catch(e){throw console.error("Error finding all settings:",e),e}}static async findByKey(e){try{return(await n.d_.query("SELECT * FROM settings WHERE setting_key = $1",[e])).rows[0]||null}catch(e){throw console.error("Error finding setting by key:",e),e}}static async getValue(e){try{let t=await this.findByKey(e);return t?parseFloat(t.setting_value):null}catch(e){throw console.error("Error getting setting value:",e),e}}static async updateValue(e,t,r=null){try{console.log("Setting.updateValue called:",{key:e,value:t,description:r});let a=await n.d_.query(`
        INSERT INTO settings (setting_key, setting_value, description) 
        VALUES ($1, $2, $3)
        ON CONFLICT (setting_key) DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        description = COALESCE(EXCLUDED.description, settings.description)
      `,[e,t.toString(),r]);return console.log("Database update result:",a),!0}catch(e){throw console.error("Error updating setting:",e),e}}static async create(e,t,r=null){try{return{id:(await n.d_.query("INSERT INTO settings (setting_key, setting_value, description) VALUES ($1, $2, $3) RETURNING id",[e,t,r])).rows[0].id,setting_key:e,setting_value:t,description:r}}catch(e){throw console.error("Error creating setting:",e),e}}static async getBillingRates(){try{let e=await this.getValue("electric_rate_per_kwh")||11,t=await this.getValue("water_fixed_amount")||200,r=await this.getValue("default_room_rate")||3500;return{electric_rate_per_kwh:e,water_fixed_amount:t,default_room_rate:r}}catch(e){throw console.error("Error getting billing rates:",e),e}}static async updateBillingRates(e){try{let t=[];return void 0!==e.electric_rate_per_kwh&&t.push(this.updateValue("electric_rate_per_kwh",e.electric_rate_per_kwh)),void 0!==e.water_fixed_amount&&t.push(this.updateValue("water_fixed_amount",e.water_fixed_amount)),void 0!==e.default_room_rate&&t.push(this.updateValue("default_room_rate",e.default_room_rate)),await Promise.all(t),!0}catch(e){throw console.error("Error updating billing rates:",e),e}}}let l=s;a()}catch(e){a(e)}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[8948,6690,785,7070,4976],()=>r(39499));module.exports=a})();