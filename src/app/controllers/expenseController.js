// File: src/app/controllers/expenseController.js
import supabase from '../../config/db/index.js'

// 🔄 Helper: Simplify balances giữa 2 người
async function simplifyBalanceBetweenTwo(roomId, userId1, userId2) {
  try {
    console.log(`🔄 Simplifying balances between ${userId1} and ${userId2}`)

    const { data: balances, error } = await supabase
      .from('balances')
      .select('*')
      .eq('room_id', roomId)
      .or(
        `and(creditor_id.eq.${userId1},debtor_id.eq.${userId2}),and(creditor_id.eq.${userId2},debtor_id.eq.${userId1})`
      )

    if (error) {
      console.error('❌ Error fetching balances for simplify:', error)
      return
    }

    if (!balances || balances.length === 0) return

    const balance1 = balances.find(
      (b) =>
        parseInt(b.creditor_id) === parseInt(userId1) &&
        parseInt(b.debtor_id) === parseInt(userId2)
    )
    const balance2 = balances.find(
      (b) =>
        parseInt(b.creditor_id) === parseInt(userId2) &&
        parseInt(b.debtor_id) === parseInt(userId1)
    )

    if (!balance1 || !balance2) return

    const amount1 = parseFloat(balance1.amount)
    const amount2 = parseFloat(balance2.amount)

    if (Math.abs(amount1 - amount2) < 0.01) {
      await supabase.from('balances').delete().eq('id', balance1.id)
      await supabase.from('balances').delete().eq('id', balance2.id)
      console.log('✅ Both balances cancelled out')
    } else if (amount1 > amount2) {
      await supabase.from('balances').delete().eq('id', balance2.id)
      await supabase
        .from('balances')
        .update({
          amount: amount1 - amount2,
          updated_at: new Date().toISOString(),
        })
        .eq('id', balance1.id)
      console.log(
        `✅ Simplified: ${userId2} owes ${userId1} ${amount1 - amount2}`
      )
    } else {
      await supabase.from('balances').delete().eq('id', balance1.id)
      await supabase
        .from('balances')
        .update({
          amount: amount2 - amount1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', balance2.id)
      console.log(
        `✅ Simplified: ${userId1} owes ${userId2} ${amount2 - amount1}`
      )
    }
  } catch (err) {
    console.error('❌ Error in simplifyBalanceBetweenTwo:', err)
  }
}

const expenseController = {
  // 🆕 THÊM EXPENSE
  addExpense: async (req, res) => {
    try {
      const {
        room_id,
        description,
        amount,
        expense_date,
        category,
        paid_by,
        split_type,
        participant_ids,
        custom_split,
      } = req.body

      console.log('📤 Expense request:', {
        room_id,
        description,
        amount,
        paid_by,
        split_type,
        participants: participant_ids?.length,
      })

      // Validate
      if (
        !room_id ||
        !description ||
        !amount ||
        !paid_by ||
        !participant_ids ||
        participant_ids.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        })
      }

      // ✅ Validate split_type
      const validSplitTypes = ['equal', 'custom']
      const finalSplitType = split_type || 'equal'

      if (!validSplitTypes.includes(finalSplitType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid split_type. Must be: ${validSplitTypes.join(', ')}`,
        })
      }

      // 1️⃣ Tạo expense
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          room_id: parseInt(room_id),
          description: description.trim(),
          amount: parseFloat(amount),
          expense_date: expense_date || new Date().toISOString().split('T')[0],
          category: category || 'other',
          paid_by: parseInt(paid_by),
          split_type: finalSplitType,
        })
        .select()
        .single()

      if (expenseError) {
        console.error('❌ Error creating expense:', expenseError)
        return res.status(500).json({
          success: false,
          message: `Database error: ${expenseError.message}`,
        })
      }

      console.log('✅ Expense created:', expense.id)

      // 2️⃣ Tính split amounts
      let splitAmounts = {}

      if (finalSplitType === 'custom' && custom_split) {
        for (const [userId, percent] of Object.entries(custom_split)) {
          splitAmounts[parseInt(userId)] =
            (parseFloat(amount) * parseFloat(percent)) / 100
        }
      } else {
        const amountPerPerson = parseFloat(amount) / participant_ids.length
        for (const userId of participant_ids) {
          splitAmounts[parseInt(userId)] = amountPerPerson
        }
      }

      console.log('💰 Split amounts:', splitAmounts)

      // 3️⃣ Tạo participants
      const participants = participant_ids.map((userId) => ({
        expense_id: expense.id,
        user_id: parseInt(userId),
        share_amount: parseFloat(splitAmounts[parseInt(userId)] || 0),
      }))

      const { error: participantsError } = await supabase
        .from('expense_participants')
        .insert(participants)

      if (participantsError) {
        console.error('❌ Error adding participants:', participantsError)
        // Rollback expense
        await supabase.from('expenses').delete().eq('id', expense.id)
        return res.status(500).json({
          success: false,
          message: `Error adding participants: ${participantsError.message}`,
        })
      }

      console.log('✅ Participants added')

      // 4️⃣ Cập nhật balances
      const paidByInt = parseInt(paid_by)

      for (const userId of participant_ids) {
        const userIdInt = parseInt(userId)

        if (userIdInt === paidByInt) continue

        const shareAmount = parseFloat(splitAmounts[userIdInt])

        // Check existing balance
        const { data: existingBalance } = await supabase
          .from('balances')
          .select('*')
          .eq('room_id', room_id)
          .eq('creditor_id', paidByInt)
          .eq('debtor_id', userIdInt)
          .maybeSingle()

        if (existingBalance) {
          const newAmount = parseFloat(existingBalance.amount) + shareAmount
          await supabase
            .from('balances')
            .update({
              amount: newAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBalance.id)
          console.log(
            `✅ Updated balance: ${userIdInt} owes ${paidByInt} ${newAmount}`
          )
        } else {
          await supabase.from('balances').insert({
            room_id: parseInt(room_id),
            creditor_id: paidByInt,
            debtor_id: userIdInt,
            amount: shareAmount,
          })
          console.log(
            `✅ Created balance: ${userIdInt} owes ${paidByInt} ${shareAmount}`
          )
        }

        // ✅ Simplify balances
        await simplifyBalanceBetweenTwo(parseInt(room_id), paidByInt, userIdInt)
      }

      console.log('✅ Balances updated and simplified')

      res.status(201).json({
        success: true,
        message: 'Expense added successfully',
        expense: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          expense_date: expense.expense_date,
          category: expense.category,
          paid_by: expense.paid_by,
          split_type: expense.split_type,
        },
      })
    } catch (err) {
      console.error('❌ Error in addExpense:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error adding expense',
      })
    }
  },

  // 📋 LẤY EXPENSES CỦA PHÒNG
  getExpenses: async (req, res) => {
    try {
      const { room_id } = req.params
      const currentUserId = req.user?.id ? parseInt(req.user.id, 10) : null

      console.log('📦 Fetching expenses for room:', room_id, 'user:', currentUserId)

      if (!room_id) {
        return res.status(400).json({
          success: false,
          message: 'room_id is required',
        })
      }

      const roomIdNum = parseInt(room_id, 10)

      // Lấy tất cả expenses của phòng
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('room_id', roomIdNum)
        .order('expense_date', { ascending: false })

      if (error) {
        console.error('❌ Error fetching expenses:', error)
        throw error
      }

      // Lấy expense_participants của user hiện tại (bao gồm share_amount)
      let userExpenseShares = {} // expenseId -> share_amount
      if (currentUserId && expenses?.length > 0) {
        const expenseIds = (expenses || []).map((e) => e.id)
        const { data: userParticipants } = await supabase
          .from('expense_participants')
          .select('expense_id, share_amount')
          .eq('user_id', currentUserId)
          .in('expense_id', expenseIds)

        ;(userParticipants || []).forEach((p) => {
          userExpenseShares[parseInt(p.expense_id)] = parseFloat(p.share_amount) || 0
        })
      }

      // Lọc: chỉ lấy expense mà user là payer HOẶC là participant
      const currentUserIdStr = currentUserId?.toString()
      const filteredExpenses = (expenses || []).filter(
        (e) =>
          String(e.paid_by) === currentUserIdStr ||
          userExpenseShares.hasOwnProperty(parseInt(e.id))
      )

      // Lấy user info
      const userIds = [...new Set(filteredExpenses?.map((e) => e.paid_by))]
      const { data: users } = await supabase
        .from('users')
        .select('id, user_name, full_name')
        .in('id', userIds)

      const userMap = {}
      users?.forEach((u) => {
        userMap[u.id] = u
      })

      // Format expenses
      const formattedExpenses = (filteredExpenses || []).map((exp) => ({
        id: exp.id,
        room_id: exp.room_id,
        description: exp.description,
        amount: parseFloat(exp.amount),
        expense_date: exp.expense_date,
        category: exp.category,
        paid_by: parseInt(exp.paid_by),
        payer_name:
          userMap[parseInt(exp.paid_by)]?.full_name ||
          userMap[parseInt(exp.paid_by)]?.user_name ||
          'Unknown',
        created_at: exp.created_at,
        is_payer: String(exp.paid_by) === currentUserIdStr,
        share_amount: userExpenseShares[parseInt(exp.id)] || 0,
      }))

      console.log(`✅ Found ${formattedExpenses.length} expenses`)

      res.status(200).json({
        success: true,
        expenses: formattedExpenses,
      })
    } catch (err) {
      console.error('❌ Error in getExpenses:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error fetching expenses',
      })
    }
  },
  // Backend - expenseController.js hoặc routes

  getExpenseDetail: async (req, res) => {
    try {
      const id = req.params.expense_id

      console.log('📦 Fetching expense detail:', id)

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'expense_id is required',
        })
      }

      const expenseId = parseInt(id, 10)
      if (isNaN(expenseId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid expense ID: ${id}`,
        })
      }

      // 1. Lấy expense info
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .maybeSingle()

      if (expenseError) throw expenseError

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found',
        })
      }

      // 2. Lấy payer info
      const { data: payer } = await supabase
        .from('users')
        .select('id, user_name, full_name, avatar_url')
        .eq('id', expense.paid_by)
        .maybeSingle()

      // 3. Lấy participants (expense_participants table)
      const { data: expenseParticipants } = await supabase
        .from('expense_participants')
        .select('user_id, share_amount')
        .eq('expense_id', expenseId)

      // 4. Lấy user info của participants
      const participantUserIds =
        expenseParticipants?.map((p) => p.user_id) || []

      const { data: participantUsers } = await supabase
        .from('users')
        .select('id, user_name, full_name, avatar_url')
        .in('id', participantUserIds)

      const userMap = {}
      participantUsers?.forEach((u) => {
        userMap[u.id] = u
      })

      // 5. Format participants
      const participants = (expenseParticipants || []).map((p) => ({
        user_id: p.user_id,
        username: userMap[p.user_id]?.user_name,
        full_name: userMap[p.user_id]?.full_name,
        avatar_url: userMap[p.user_id]?.avatar_url,
        share_amount: parseFloat(p.share_amount || 0),
      }))

      // 6. Format response
      const expenseDetail = {
        id: expense.id,
        room_id: expense.room_id,
        description: expense.description,
        amount: parseFloat(expense.amount),
        expense_date: expense.expense_date,
        category: expense.category,
        paid_by: expense.paid_by,
        paid_by_name: payer?.full_name || payer?.user_name || 'Unknown',
        paid_by_avatar: payer?.avatar_url,
        split_type: expense.split_type,
        created_at: expense.created_at,
      }

      console.log(
        `✅ Expense detail fetched with ${participants.length} participants`
      )

      return res.status(200).json({
        success: true,
        expense: expenseDetail,
        participants,
      })
    } catch (err) {
      console.error('❌ Error in getExpenseDetail:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Error fetching expense detail',
      })
    }
  },

  // 🗑️ XÓA EXPENSE
  deleteExpense: async (req, res) => {
    try {
      const { id } = req.params

      console.log('🗑️ Deleting expense:', id)

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Expense ID is required',
        })
      }

      // 1. Lấy expense
      const { data: expense, error: getError } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (getError) {
        console.error('❌ Error fetching expense:', getError)
        throw getError
      }

      if (!expense) {
        return res.status(404).json({
          success: false,
          message: 'Expense not found',
        })
      }

      // 2. Lấy participants
      const { data: participants, error: participantsError } = await supabase
        .from('expense_participants')
        .select('*')
        .eq('expense_id', id)

      if (participantsError) throw participantsError

      // 3. Rollback balances
      for (const participant of participants || []) {
        const participantUserId = parseInt(participant.user_id)
        const paidBy = parseInt(expense.paid_by)

        if (participantUserId === paidBy) continue

        const { data: balance } = await supabase
          .from('balances')
          .select('*')
          .eq('room_id', expense.room_id)
          .eq('creditor_id', paidBy)
          .eq('debtor_id', participantUserId)
          .maybeSingle()

        if (balance) {
          const shareAmount = parseFloat(participant.share_amount)
          const currentAmount = parseFloat(balance.amount)
          const newAmount = currentAmount - shareAmount

          if (newAmount <= 0.01) {
            await supabase.from('balances').delete().eq('id', balance.id)
            console.log('🗑️ Balance deleted')
          } else {
            await supabase
              .from('balances')
              .update({
                amount: newAmount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', balance.id)
            console.log(`✏️ Balance updated to ${newAmount}`)
          }

          // Simplify after rollback
          await simplifyBalanceBetweenTwo(
            expense.room_id,
            paidBy,
            participantUserId
          )
        }
      }

      // 4. Xóa participants
      await supabase.from('expense_participants').delete().eq('expense_id', id)

      // 5. Xóa expense
      await supabase.from('expenses').delete().eq('id', id)

      console.log('✅ Expense deleted successfully')

      res.status(200).json({
        success: true,
        message: 'Expense deleted successfully',
      })
    } catch (err) {
      console.error('❌ Error in deleteExpense:', err)
      res.status(500).json({
        success: false,
        message: err.message || 'Error deleting expense',
      })
    }
  },
}

export default expenseController
