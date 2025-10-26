// File: src/app/controllers/balanceController.js
import supabase from '../../config/db/index.js'

const balanceController = {
  // 📋 GET /balances/:room_id - Lấy danh sách nợ
  getBalances: async (req, res) => {
    try {
      const { room_id } = req.params

      console.log('📦 Fetching balances for room:', room_id)

      // Validate room_id
      if (!room_id) {
        return res.status(400).json({
          success: false,
          message: 'room_id is required',
        })
      }

      // Kiểm tra room có tồn tại không
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', room_id)
        .maybeSingle()

      if (roomError) {
        console.error('❌ Error checking room:', roomError)
        throw roomError
      }

      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        })
      }

      // Lấy balances với thông tin user
      const { data: balances, error } = await supabase
        .from('balances')
        .select(
          `
          id,
          room_id,
          creditor_id,
          debtor_id,
          amount,
          updated_at,
          created_at
        `
        )
        .eq('room_id', room_id)
        .gt('amount', 0)
        .order('amount', { ascending: false })

      if (error) {
        console.error('❌ Error fetching balances:', error)
        throw error
      }

      console.log(`📊 Raw balances count: ${balances?.length || 0}`)

      // Nếu không có balances, return empty array
      if (!balances || balances.length === 0) {
        console.log('✅ No balances found')
        return res.status(200).json({
          success: true,
          balances: [],
        })
      }

      // Lấy thông tin user cho creditors và debtors
      const userIds = new Set()
      balances.forEach((b) => {
        userIds.add(b.creditor_id)
        userIds.add(b.debtor_id)
      })

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name, full_name')
        .in('id', Array.from(userIds))

      if (usersError) {
        console.error('❌ Error fetching users:', usersError)
        throw usersError
      }

      console.log(`👥 Fetched ${users?.length || 0} users`)

      // Map users by ID
      const userMap = {}
      ;(users || []).forEach((user) => {
        userMap[user.id] = user
      })

      // Format balances với user info
      const formattedBalances = balances.map((b) => {
        const debtor = userMap[b.debtor_id]
        const creditor = userMap[b.creditor_id]

        return {
          id: b.id,
          room_id: b.room_id,
          debtor_id: b.debtor_id,
          creditor_id: b.creditor_id,
          debtor_name: debtor?.full_name || debtor?.user_name || 'Unknown',
          creditor_name:
            creditor?.full_name || creditor?.user_name || 'Unknown',
          amount: parseFloat(b.amount),
          updated_at: b.updated_at,
          created_at: b.created_at,
        }
      })

      console.log(`✅ Found ${formattedBalances.length} balances`)

      res.status(200).json({
        success: true,
        balances: formattedBalances,
      })
    } catch (err) {
      console.error('❌ Error in getBalances:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error fetching balances',
      })
    }
  },

  // 💰 POST /balances/settle/:id - Xác nhận đã thanh toán
  settleBalance: async (req, res) => {
    try {
      const { id } = req.params

      console.log('💰 Settling balance:', id)

      // Validate id
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Balance ID is required',
        })
      }

      // Kiểm tra balance có tồn tại không
      const { data: balance, error: getError } = await supabase
        .from('balances')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (getError) {
        console.error('❌ Error fetching balance:', getError)
        throw getError
      }

      if (!balance) {
        return res.status(404).json({
          success: false,
          message: 'Balance not found',
        })
      }

      console.log('📦 Balance found:', {
        id: balance.id,
        amount: balance.amount,
        debtor: balance.debtor_id,
        creditor: balance.creditor_id,
      })

      // Xóa balance (đánh dấu đã thanh toán)
      const { error: deleteError } = await supabase
        .from('balances')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('❌ Error deleting balance:', deleteError)
        throw deleteError
      }

      console.log('✅ Balance settled successfully')

      res.status(200).json({
        success: true,
        message: 'Balance settled successfully',
        settled_balance: {
          id: balance.id,
          amount: balance.amount,
          debtor_id: balance.debtor_id,
          creditor_id: balance.creditor_id,
        },
      })
    } catch (err) {
      console.error('❌ Error in settleBalance:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error settling balance',
      })
    }
  },

  // 📊 GET /balances/summary/:room_id - Tổng hợp số liệu
  getBalanceSummary: async (req, res) => {
    try {
      const { room_id } = req.params

      console.log('📊 Fetching balance summary for room:', room_id)

      if (!room_id) {
        return res.status(400).json({
          success: false,
          message: 'room_id is required',
        })
      }

      // Lấy tất cả balances
      const { data: balances, error } = await supabase
        .from('balances')
        .select('*')
        .eq('room_id', room_id)

      if (error) {
        console.error('❌ Error fetching balances:', error)
        throw error
      }

      // Tính tổng
      const totalDebt =
        balances?.reduce((sum, b) => sum + parseFloat(b.amount), 0) || 0

      const activeDebts =
        balances?.filter((b) => parseFloat(b.amount) > 0).length || 0

      // Lấy top debtor và creditor
      const debtorTotals = {}
      const creditorTotals = {}

      balances?.forEach((b) => {
        const amount = parseFloat(b.amount)

        // Debtor (người nợ)
        debtorTotals[b.debtor_id] = (debtorTotals[b.debtor_id] || 0) + amount

        // Creditor (người cho vay)
        creditorTotals[b.creditor_id] =
          (creditorTotals[b.creditor_id] || 0) + amount
      })

      res.status(200).json({
        success: true,
        summary: {
          total_debt: totalDebt,
          active_debts: activeDebts,
          total_balances: balances?.length || 0,
          top_debtor_id: Object.keys(debtorTotals)[0] || null,
          top_creditor_id: Object.keys(creditorTotals)[0] || null,
        },
      })
    } catch (err) {
      console.error('❌ Error in getBalanceSummary:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error fetching balance summary',
      })
    }
  },
}

export default balanceController
