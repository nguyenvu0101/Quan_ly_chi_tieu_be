// src/app/controllers/statisticsController.js

import supabase from '../../config/db/index.js'

export const statisticsController = {
  // Thống kê chi tiêu cá nhân trong 1 tháng (phần của user)
  getMonthlyExpenseStats: async (req, res) => {
    try {
      const { user_id } = req.params
      const { month, year } = req.query

      console.log('📥 Received request for monthly stats:', {
        user_id,
        month,
        year,
      })

      // Mặc định lấy tháng hiện tại
      const currentDate = new Date()
      const currentMonth = parseInt(month) || currentDate.getMonth() + 1
      const currentYear = parseInt(year) || currentDate.getFullYear()

      // Tính ngày đầu và cuối tháng hiện tại
      const startDate = `${currentYear}-${String(currentMonth).padStart(
        2,
        '0'
      )}-01`
      const lastDay = new Date(currentYear, currentMonth, 0).getDate()
      const endDate = `${currentYear}-${String(currentMonth).padStart(
        2,
        '0'
      )}-${lastDay}`

      console.log(
        `📊 Getting stats for user ${user_id} from ${startDate} to ${endDate}`
      )

      // Lấy toàn bộ expenses trong tháng hiện tại
      const { data: allExpenses, error: expensesError } = await supabase
        .from('expenses')
        .select(
          `
          id,
          description,
          amount,
          expense_date,
          category,
          paid_by,
          split_type,
          created_at,
          expense_participants (
            user_id,
            share_amount,
            share_percentage,
            is_involved
          )
        `
        )
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)

      if (expensesError) throw expensesError

      // Filter: chỉ lấy expenses user tham gia
      const expensesData = allExpenses.filter((expense) => {
        return expense.expense_participants?.some(
          (p) => p.user_id === parseInt(user_id) && p.is_involved
        )
      })

      console.log(
        `📋 Filtered to ${expensesData.length} expenses for user ${user_id}`
      )

      // ✅ Tính toán thống kê CHI TIÊU CÁ NHÂN (phần của user)
      let totalPersonalExpense = 0 // Tổng chi tiêu cá nhân
      let totalPaid = 0 // Tiền user thanh toán (paid_by)
      let totalOwe = 0 // Tiền user nợ người khác
      const byCategory = {}

      expensesData.forEach((expense) => {
        const participants = expense.expense_participants || []

        // Tìm share của user hiện tại trong expense này
        const userParticipant = participants.find(
          (p) => p.user_id === parseInt(user_id)
        )

        if (!userParticipant || !userParticipant.is_involved) return

        const categoryName = expense.category || 'Khác'

        // Khởi tạo category nếu chưa có
        if (!byCategory[categoryName]) {
          byCategory[categoryName] = {
            personal_expense: 0,
            paid: 0,
            owe: 0,
            count: 0,
          }
        }

        // Phần chi tiêu cá nhân của user = share_amount
        const userShare = parseFloat(userParticipant.share_amount) || 0
        totalPersonalExpense += userShare
        byCategory[categoryName].personal_expense += userShare

        // Nếu user là người chi tiền (paid_by)
        if (expense.paid_by === parseInt(user_id)) {
          totalPaid += parseFloat(expense.amount)
          byCategory[categoryName].paid += parseFloat(expense.amount)
        }

        // Tiền user nợ = share_amount (nếu người khác thanh toán)
        if (expense.paid_by !== parseInt(user_id)) {
          totalOwe += userShare
          byCategory[categoryName].owe += userShare
        }

        byCategory[categoryName].count += 1
      })

      // ✅ TÍNH CHI TIÊU THÁNG TRƯỚC
      let previousMonthExpense = 0
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

      const prevStartDate = `${prevYear}-${String(prevMonth).padStart(
        2,
        '0'
      )}-01`
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
      const prevEndDate = `${prevYear}-${String(prevMonth).padStart(
        2,
        '0'
      )}-${prevLastDay}`

      const { data: prevExpenses, error: prevError } = await supabase
        .from('expenses')
        .select(
          `
          id,
          amount,
          expense_participants (
            user_id,
            share_amount,
            is_involved
          )
        `
        )
        .gte('expense_date', prevStartDate)
        .lte('expense_date', prevEndDate)

      if (!prevError && prevExpenses) {
        // Filter expenses tháng trước
        const prevFilteredExpenses = prevExpenses.filter((expense) => {
          return expense.expense_participants?.some(
            (p) => p.user_id === parseInt(user_id) && p.is_involved
          )
        })

        // Tính tổng chi tiêu tháng trước
        prevFilteredExpenses.forEach((expense) => {
          const userParticipant = expense.expense_participants?.find(
            (p) => p.user_id === parseInt(user_id)
          )
          if (userParticipant?.is_involved) {
            previousMonthExpense +=
              parseFloat(userParticipant.share_amount) || 0
          }
        })
      }

      // Tính số dư ròng
      const netBalance = totalPaid - totalOwe

      // ✅ SO SÁNH THÁNG TRƯỚC - SỬA CÔNG THỨC
      const compareWithPrevious = totalPersonalExpense - previousMonthExpense // ← Đổi thứ tự
      const comparePercentage =
        previousMonthExpense > 0
          ? ((compareWithPrevious / previousMonthExpense) * 100).toFixed(1)
          : 0

      const responseData = {
        month: currentMonth,
        year: currentYear,
        summary: {
          total_personal_expense: parseFloat(totalPersonalExpense.toFixed(2)),
          total_paid: parseFloat(totalPaid.toFixed(2)),
          total_owe: parseFloat(totalOwe.toFixed(2)),
          net_balance: parseFloat(netBalance.toFixed(2)),
          balance_description:
            netBalance > 0
              ? `Người khác nợ bạn ${parseFloat(netBalance.toFixed(2))} đ`
              : netBalance < 0
              ? `Bạn nợ người khác ${parseFloat(
                  Math.abs(netBalance).toFixed(2)
                )} đ`
              : 'Cân bằng tài chính',
        },
        comparison: {
          previous_month: prevMonth,
          previous_year: prevYear,
          previous_month_expense: parseFloat(previousMonthExpense.toFixed(2)),
          current_month_expense: parseFloat(totalPersonalExpense.toFixed(2)),
          difference: parseFloat(compareWithPrevious.toFixed(2)), // ← Giờ đã đúng
          difference_percentage: parseFloat(comparePercentage),
          comparison_description:
            compareWithPrevious > 0
              ? `🔴 Tiêu nhiều hơn tháng trước ${parseFloat(
                  compareWithPrevious.toFixed(2)
                )} đ (${comparePercentage}%)`
              : compareWithPrevious < 0
              ? `🟢 Tiêu ít hơn tháng trước ${parseFloat(
                  Math.abs(compareWithPrevious).toFixed(2)
                )} đ (${Math.abs(parseFloat(comparePercentage))}%)`
              : '⚪ Bằng tháng trước',
        },
        by_category: byCategory,
        expense_count: expensesData.length,
      }

      console.log('✅ Stats calculated successfully')
      console.log('Comparison:', responseData.comparison)

      return res.status(200).json({
        success: true,
        data: responseData,
      })
    } catch (error) {
      console.error('❌ Error getting monthly stats:', error)
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê chi tiêu',
        error: error.message,
      })
    }
  },
  // Thống kê theo khoảng thời gian tùy chỉnh
  getExpensesByDateRange: async (req, res) => {
    try {
      const { user_id } = req.params
      const { start_date, end_date } = req.query

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp start_date và end_date',
        })
      }

      console.log(
        `📊 Getting range stats for user ${user_id} from ${start_date} to ${end_date}`
      )

      const { data: allExpenses, error } = await supabase
        .from('expenses')
        .select(
          `
          id,
          description,
          amount,
          expense_date,
          category,
          paid_by,
          expense_participants (
            user_id,
            share_amount,
            is_involved
          )
        `
        )
        .gte('expense_date', start_date)
        .lte('expense_date', end_date)

      if (error) throw error

      // Filter: chỉ lấy expenses user tham gia
      const expensesData = allExpenses.filter((expense) => {
        return expense.expense_participants?.some(
          (p) => p.user_id === parseInt(user_id) && p.is_involved
        )
      })

      // ✅ Tính chi tiêu cá nhân
      let totalPersonalExpense = 0
      let totalPaid = 0
      let totalOwe = 0

      expensesData.forEach((expense) => {
        const userParticipant = expense.expense_participants?.find(
          (p) => p.user_id === parseInt(user_id)
        )

        if (!userParticipant?.is_involved) return

        const userShare = parseFloat(userParticipant.share_amount) || 0
        totalPersonalExpense += userShare

        if (expense.paid_by === parseInt(user_id)) {
          totalPaid += parseFloat(expense.amount)
        }

        if (expense.paid_by !== parseInt(user_id)) {
          totalOwe += userShare
        }
      })

      console.log(`✅ Range stats calculated: ${expensesData.length} expenses`)

      return res.status(200).json({
        success: true,
        data: {
          start_date,
          end_date,
          total_personal_expense: parseFloat(totalPersonalExpense.toFixed(2)),
          total_paid: parseFloat(totalPaid.toFixed(2)),
          total_owe: parseFloat(totalOwe.toFixed(2)),
          net_balance: parseFloat((totalPaid - totalOwe).toFixed(2)),
          expense_count: expensesData.length,
          expenses: expensesData,
        },
      })
    } catch (error) {
      console.error('❌ Error getting date range stats:', error)
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê',
        error: error.message,
      })
    }
  },

  // Chi tiêu hôm nay
  getTodayExpense: async (req, res) => {
    try {
      const { user_id } = req.params

      const today = new Date().toISOString().split('T')[0]

      console.log(`📊 Getting today stats for user ${user_id} on ${today}`)

      const { data: allExpenses, error } = await supabase
        .from('expenses')
        .select(
          `
          id,
          description,
          amount,
          category,
          paid_by,
          expense_participants (
            user_id,
            share_amount,
            is_involved
          )
        `
        )
        .eq('expense_date', today)

      if (error) throw error

      // Filter: chỉ lấy expenses user tham gia
      const expensesData = allExpenses.filter((expense) => {
        return expense.expense_participants?.some(
          (p) => p.user_id === parseInt(user_id) && p.is_involved
        )
      })

      // ✅ Tính chi tiêu cá nhân
      let totalPersonalExpense = 0
      let totalPaid = 0
      let totalOwe = 0

      expensesData.forEach((expense) => {
        const userParticipant = expense.expense_participants?.find(
          (p) => p.user_id === parseInt(user_id)
        )

        if (!userParticipant?.is_involved) return

        const userShare = parseFloat(userParticipant.share_amount) || 0
        totalPersonalExpense += userShare

        if (expense.paid_by === parseInt(user_id)) {
          totalPaid += parseFloat(expense.amount)
        }

        if (expense.paid_by !== parseInt(user_id)) {
          totalOwe += userShare
        }
      })

      console.log(`✅ Today stats calculated: ${expensesData.length} expenses`)

      return res.status(200).json({
        success: true,
        data: {
          date: today,
          total_personal_expense: parseFloat(totalPersonalExpense.toFixed(2)),
          total_paid: parseFloat(totalPaid.toFixed(2)),
          total_owe: parseFloat(totalOwe.toFixed(2)),
          net_today: parseFloat((totalPaid - totalOwe).toFixed(2)),
          expense_count: expensesData.length,
          expenses: expensesData,
        },
      })
    } catch (error) {
      console.error('❌ Error getting today stats:', error)
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê',
        error: error.message,
      })
    }
  },
}
