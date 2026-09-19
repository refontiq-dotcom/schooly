import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

async function check() {
  console.log("🔍 Checking Database State...")
  
  const { data: users, error: err1 } = await supabase.from('users').select('*')
  console.log(`Users in public.users: ${users?.length || 0}`)
  
  const { data: roles, error: err2 } = await supabase.from('user_school_roles').select('*')
  console.log(`Roles in user_school_roles: ${roles?.length || 0}`)
  
  if (roles?.length > 0) {
    console.log("Roles data:", roles)
  }
}

check()
