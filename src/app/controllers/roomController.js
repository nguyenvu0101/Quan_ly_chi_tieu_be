import supabase from '../../config/db/index.js'

// Hàm tiện ích để chuyển đổi string ID sang số an toàn
const getUserIdFromInput = (idString) => {
  const parsedId = parseInt(idString, 10)
  if (isNaN(parsedId)) {
    throw new Error(`Invalid user ID format: ${idString}`)
  }
  return parsedId
}

let refreshTokens = []

const roomController = {
  // 🧾 LẤY TẤT CẢ PHÒNG
  // 🧾 LẤY TẤT CẢ PHÒNG (Room Objects) mà userId là thành viên
  getAllRooms: async (req, res) => {
    try {
      // 1. Lấy userId từ URL params
      const { userId } = req.params

      // 2. Truy vấn Supabase:
      //    - Bắt đầu từ bảng 'room_members'
      //    - Lọc các bản ghi có 'user_id' bằng với userId
      //    - SỬ DỤNG 'select' ĐỂ JOIN VỚI BẢNG 'rooms'
      //      Cú pháp: '*, rooms(*)' sẽ trả về tất cả cột của room_members VÀ tất cả cột của bảng rooms được liên kết.

      const { data: roomMembers, error } = await supabase
        .from('room_members')
        .select('*, rooms(*)') // <--- Đã sửa ở đây: JOIN với bảng 'rooms'
        .eq('user_id', userId)

      if (error) {
        // Đặt mã lỗi client là 400 nếu dữ liệu đầu vào không hợp lệ hoặc lỗi truy vấn cụ thể
        return res.status(400).json({
          message: 'Lỗi truy vấn cơ sở dữ liệu',
          details: error.message,
        })
      }

      // 3. Chuẩn hóa kết quả: Chỉ lấy ra đối tượng phòng (Room Object)
      //    Kết quả từ Supabase là mảng các đối tượng { user_id, room_id, rooms: { room_data... } }
      //    Ta chỉ cần mảng các đối tượng { room_data... }
      const allRooms = roomMembers.map((member) => member.rooms)

      if (allRooms.length === 0) {
        return res
          .status(200)
          .json({ message: 'Người dùng không tham gia phòng nào.', rooms: [] })
      }

      res.status(200).json(allRooms)
    } catch (err) {
      // Xử lý các lỗi ngoài truy vấn (ví dụ: lỗi hệ thống)
      console.error('Lỗi server khi lấy phòng:', err.message)
      res
        .status(500)
        .json({ message: 'Lỗi server nội bộ', details: err.message })
    }
  },
  // 🔍 LẤY PHÒNG THEO ID (SỬA LỖI .select)
  // getUserRoom: trả về room info (tên, mô tả, mã, creator_name) và members
  getUserRoom: async (req, res) => {
    try {
      const { id } = req.params
      const { period } = req.query
      const currentUserId = req.user?.id ? parseInt(req.user.id, 10) : null

      console.log(
        '📦 Fetching room:',
        id,
        'period:',
        period,
        'currentUser:',
        currentUserId
      )

      const roomId = parseInt(id, 10)
      if (isNaN(roomId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid room ID: ${id}`,
        })
      }

      // 1️⃣ Lấy room
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle()

      if (roomErr) throw roomErr
      if (!roomData) {
        return res.status(404).json({
          success: false,
          message: 'Room not found',
        })
      }

      // 2️⃣ Lấy creator
      let creatorName = 'Unknown'
      if (roomData.created_by) {
        const { data: creator } = await supabase
          .from('users')
          .select('id, user_name, full_name')
          .eq('id', roomData.created_by)
          .maybeSingle()

        if (creator) {
          creatorName = creator.full_name || creator.user_name || 'Unknown'
        }
      }

      // 3️⃣ Lấy members
      const { data: roomMembers } = await supabase
        .from('room_members')
        .select('user_id, role, joined_at')
        .eq('room_id', roomId)
        .eq('is_active', true)

      const memberUserIds = roomMembers?.map((m) => m.user_id) || []

      const { data: memberUsers } = await supabase
        .from('users')
        .select('id, user_name, full_name, email, avatar_url, qr_url')
        .in('id', memberUserIds)

      const userMap = {}
      memberUsers?.forEach((u) => {
        userMap[u.id] = u
      })

      const members = (roomMembers || []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        username: userMap[m.user_id]?.user_name,
        full_name: userMap[m.user_id]?.full_name,
        email: userMap[m.user_id]?.email,
        avatar_url: userMap[m.user_id]?.avatar_url,
        qr_url: userMap[m.user_id]?.qr_url,
      }))

      // 4️⃣ Tính date range theo period
      let startDate = null
      const today = new Date()

      switch (period) {
        case 'week':
          startDate = new Date(today.setDate(today.getDate() - 7))
          break
        case 'month':
          startDate = new Date(today.setMonth(today.getMonth() - 1))
          break
        case '3months':
          startDate = new Date(today.setMonth(today.getMonth() - 3))
          break
        case '6months':
          startDate = new Date(today.setMonth(today.getMonth() - 6))
          break
        case 'year':
          startDate = new Date(today.setFullYear(today.getFullYear() - 1))
          break
        default:
          startDate = null
          break
      }

      console.log(
        `📅 Period: ${period || 'all'}, Start: ${
          startDate ? startDate.toISOString().split('T')[0] : 'none'
        }`
      )

      // 5️⃣ Lấy TẤT CẢ expenses của phòng (để tính total_amount)
      let allExpensesQuery = supabase
        .from('expenses')
        .select('*')
        .eq('room_id', roomId)

      if (startDate) {
        allExpensesQuery = allExpensesQuery.gte(
          'expense_date',
          startDate.toISOString().split('T')[0]
        )
      }

      const { data: allExpensesRaw, error: allErr } = await allExpensesQuery
      if (allErr) throw allErr

      // 6️⃣ Lấy expense_participants của user để lọc và tính share
      const myExpenseIds = new Set()
      const userShareMap = {} // expenseId -> share_amount

      if (currentUserId && allExpensesRaw?.length > 0) {
        const allExpenseIds = (allExpensesRaw || []).map((e) => parseInt(e.id))

        const { data: allMyParticipants } = await supabase
          .from('expense_participants')
          .select('expense_id, share_amount')
          .eq('user_id', currentUserId)
          .in('expense_id', allExpenseIds)

        ;(allMyParticipants || []).forEach((p) => {
          const expId = parseInt(p.expense_id)
          userShareMap[expId] = parseFloat(p.share_amount) || 0
          myExpenseIds.add(expId)
        })
      }

      // 7️⃣ Lọc expenses: user là payer HOẶC là participant
      const currentUserIdStr = currentUserId?.toString()
      const filteredExpenses = (allExpensesRaw || []).filter((e) => {
        const expId = parseInt(e.id)
        return String(e.paid_by) === currentUserIdStr || myExpenseIds.has(expId)
      })

      // Lấy payer info cho filtered expenses
      const payerIds = [
        ...new Set(filteredExpenses?.map((e) => e.paid_by) || []),
      ]
      const { data: payers } = await supabase
        .from('users')
        .select('id, user_name, full_name')
        .in('id', payerIds)

      const payerMap = {}
      payers?.forEach((p) => {
        payerMap[p.id] = p
      })

      // Fetch participants for all filtered expenses in one go
      const expenseIds = (filteredExpenses || []).map((e) => parseInt(e.id))
      const expenseParticipantsMap = {}

      if (expenseIds.length > 0) {
        const { data: allParticipants, error: partErr } = await supabase
          .from('expense_participants')
          .select('expense_id, user_id, share_amount')
          .in('expense_id', expenseIds)

        if (partErr) throw partErr

        const participantUserIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])]
        const { data: participantUsers, error: userErr } = await supabase
          .from('users')
          .select('id, user_name, full_name, avatar_url')
          .in('id', participantUserIds)

        if (userErr) throw userErr

        const partUserMap = {}
        participantUsers?.forEach((u) => {
          partUserMap[u.id] = u
        })

        allParticipants?.forEach((p) => {
          const expId = parseInt(p.expense_id)
          if (!expenseParticipantsMap[expId]) {
            expenseParticipantsMap[expId] = []
          }
          expenseParticipantsMap[expId].push({
            user_id: p.user_id,
            username: partUserMap[p.user_id]?.user_name,
            full_name: partUserMap[p.user_id]?.full_name,
            avatar_url: partUserMap[p.user_id]?.avatar_url,
            share_amount: parseFloat(p.share_amount || 0),
          })
        })
      }

      const formattedExpenses = (filteredExpenses || []).map((exp) => {
        const expId = parseInt(exp.id)
        const participants = expenseParticipantsMap[expId] || []
        return {
          id: expId,
          description: exp.description,
          amount: parseFloat(exp.amount),
          expense_date: exp.expense_date,
          category: exp.category,
          paid_by: parseInt(exp.paid_by),
          paid_by_name:
            payerMap[parseInt(exp.paid_by)]?.full_name ||
            payerMap[parseInt(exp.paid_by)]?.user_name ||
            'Unknown',
          split_type: exp.split_type,
          created_at: exp.created_at,
          is_payer: String(exp.paid_by) === currentUserIdStr,
          participants,
          participant_ids: participants.map((p) => p.user_id),
        }
      })

      // 8️⃣ Tính total_amount tổng (tất cả expenses) cho stats
      const totalAmount = (allExpensesRaw || []).reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0
      )

      // 9️⃣ Tính my_total = tổng share_amount của user trong filtered expenses
      const myTotal = filteredExpenses.reduce((sum, exp) => {
        const expId = parseInt(exp.id)
        return sum + (userShareMap[expId] || 0)
      }, 0)

      console.log(
        `💰 Total: ${allExpensesRaw?.length || 0} expenses, ${totalAmount} amount`
      )
      console.log(
        `🔒 Filtered: ${filteredExpenses?.length || 0} expenses for user ${currentUserId}, myTotal: ${myTotal}`
      )

      // 🔟 Lấy balances (không filter)
      const { data: balances } = await supabase
        .from('balances')
        .select('creditor_id, debtor_id, amount')
        .eq('room_id', roomId)
        .gt('amount', 0)

      const memberBalances = {}
      memberUserIds.forEach((userId) => {
        memberBalances[userId] = 0
      })

      balances?.forEach((b) => {
        const creditorId = parseInt(b.creditor_id)
        const debtorId = parseInt(b.debtor_id)
        const amount = parseFloat(b.amount)

        if (memberBalances[creditorId] !== undefined) {
          memberBalances[creditorId] += amount
        }
        if (memberBalances[debtorId] !== undefined) {
          memberBalances[debtorId] -= amount
        }
      })

      console.log('✅ Room data fetched successfully')

      return res.status(200).json({
        success: true,
        room: {
          id: roomData.id,
          room_name: roomData.room_name,
          room_code: roomData.room_code,
          description: roomData.description,
          created_by: roomData.created_by,
          creator_name: creatorName,
          created_at: roomData.created_at,
        },
        members,
        expenses: formattedExpenses,
        expenses_summary: {
          total_expenses: allExpensesRaw?.length || 0,
          total_amount: totalAmount,
          my_total: myTotal,
          my_count: filteredExpenses?.length || 0,
          period: period || 'all',
          start_date: startDate ? startDate.toISOString().split('T')[0] : null,
        },
        balance_summary: {
          total_balance: totalAmount,
          active_balances: balances?.length || 0,
          member_balances: memberBalances,
        },
      })
    } catch (err) {
      console.error('❌ Error in getRoom:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Internal server error',
      })
    }
  },

  createRoom: async (req, res) => {
    try {
      // Lấy đúng tên trường từ Frontend (roomname, roomcode, description, creator_id)
      const { roomname, roomcode, description, creator_id } = req.body

      console.log('📦 Dữ liệu tạo phòng từ FE:============', req.body)

      // BƯỚC 0: Xác thực và chuyển đổi Creator ID
      if (!creator_id) {
        return res.status(400).json({ message: 'Thiếu ID người tạo phòng.' })
      }
      const createdById = getUserIdFromInput(creator_id) // Chuyển đổi sang số nguyên

      // BƯỚC 1: Kiểm tra tính độc nhất lần cuối (Race condition check)
      const { data: existingRoom, error: checkError } = await supabase
        .from('rooms')
        .select('room_code')
        .eq('room_code', roomcode)
        .maybeSingle()

      if (checkError) throw checkError
      if (existingRoom) {
        return res.status(409).json({
          message: 'Mã phòng đã tồn tại (Xung đột).',
          roomCode: roomcode,
        })
      }

      // BƯỚC 2: Thêm thông tin phòng vào bảng 'rooms'
      const { data: newRoom, error: insertError } = await supabase
        .from('rooms')
        .insert([
          {
            room_name: roomname,
            room_code: roomcode,
            description: description,
            created_by: createdById, // LƯU ID NGƯỜI TẠO
          },
        ])
        .select()
        .single()

      if (insertError) throw insertError

      // --- BƯỚC 3: Thêm người tạo vào bảng room_members ---
      const { error: memberError } = await supabase
        .from('room_members')
        .insert([
          {
            room_id: newRoom.id, // ID phòng vừa tạo
            user_id: createdById, // ID người tạo
            role: 'admin',
          },
        ])

      if (memberError) {
        console.error(
          'WARNING: Lỗi khi thêm người tạo vào room_members:',
          memberError
        )
      }

      res.status(201).json({
        message: 'Phòng đã được tạo thành công!',
        roomCode: newRoom.room_code,
        roomId: newRoom.id,
      })
    } catch (err) {
      console.error('❌ Lỗi trong roomController.createRoom:', err)
      res
        .status(500)
        .json({ message: err.message || 'Lỗi Server nội bộ khi tạo phòng.' })
    }
  },

  // ✏️ CẬP NHẬT PHÒNG
  updateRoom: async (req, res) => {
    try {
      const { id } = req.params
      const { room_name, description } = req.body
      const { data, error } = await supabase
        .from('rooms')
        .update({ room_name, description })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      res.status(200).json(data)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },
  // 🗑️ XOÁ PHÒNG
  deleteRoom: async (req, res) => {
    try {
      const { id } = req.params
      const roomId = req.query.roomId
      console.log('🚪 Yêu cầu xoá phòng ID:', roomId, 'bởi user ID:', id)

      // 🛡️ Kiểm tra xem phòng có còn bất kỳ khoản nợ nào chưa thanh toán không
      const { data: activeBalances, error: balanceErr } = await supabase
        .from('balances')
        .select('*')
        .eq('room_id', roomId)
        .gt('amount', 0.01)

      if (balanceErr) throw balanceErr

      if (activeBalances && activeBalances.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Không thể xóa phòng khi vẫn còn các khoản nợ chưa thanh toán giữa các thành viên.',
        })
      }

      const { error } = await supabase.from('rooms').delete().eq('id', roomId)
      if (error) throw error
      res.status(200).json('Room deleted')
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  },

  // 🔍 KIỂM TRA MÃ PHÒNG (Dành cho Frontend Flutter)
  checkRoomCode: async (req, res) => {
    try {
      const { roomCode } = req.params
      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_code', roomCode)
        .maybeSingle()

      if (error) throw error

      if (data) {
        return res.status(200).json({ message: 'Room code exists.' })
      }

      return res.status(404).json({ message: 'Room code is unique.' })
    } catch (err) {
      console.error('❌ Lỗi trong checkRoomCode:', err)
      res.status(500).json({ message: 'Internal Server Error during check.' })
    }
  },
  // 🚪 THAM GIA PHÒNG
  // Thay thế chỉ phần joinRoom bằng đoạn sau trong file controller
  joinRoom: async (req, res) => {
    try {
      const { roomCode, userId, nickname = null } = req.body

      // Validate input
      if (!roomCode || roomCode.toString().trim() === '') {
        return res
          .status(400)
          .json({ success: false, message: 'Vui lòng cung cấp roomCode.' })
      }
      if (!userId) {
        return res
          .status(400)
          .json({ success: false, message: 'Vui lòng cung cấp userId.' })
      }

      const uid = getUserIdFromInput(userId)

      // Tìm phòng theo roomCode (chỉ dùng roomCode)
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('id, room_name, room_code')
        .eq('room_code', roomCode)
        .maybeSingle()

      if (roomErr) throw roomErr
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phòng với mã đã nhập.',
        })
      }

      // Kiểm tra xem user đã là thành viên chưa
      const { data: existingMember, error: existingErr } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', uid)
        .maybeSingle()

      if (existingErr) throw existingErr

      if (existingMember) {
        // Nếu đã là thành viên và vẫn active → cho phép vào lại (không lỗi)
        const { data: updatedMember, error: updateErr } = await supabase
          .from('room_members')
          .update({
            is_active: true,
            nickname: nickname ?? existingMember.nickname,
            joined_at: new Date().toISOString(),
          })
          .eq('id', existingMember.id)
          .select()
          .single()

        if (updateErr) throw updateErr
      } else {
        // Nếu chưa có → thêm mới
        const { data: insertedMember, error: insertErr } = await supabase
          .from('room_members')
          .insert([
            {
              room_id: room.id,
              user_id: uid,
              role: 'member',
              nickname: nickname ?? null,
              is_active: true,
              joined_at: new Date().toISOString(),
            },
          ])
          .select()
          .single()

        if (insertErr) throw insertErr
      }

      // Lấy danh sách thành viên mới nhất để trả về
      const { data: members, error: membersError } = await supabase
        .from('room_members')
        .select(
          'id, room_id, user_id, role, nickname, joined_at, is_active, users(id, user_name, full_name, email)'
        )
        .eq('room_id', room.id)
        .eq('is_active', true)

      if (membersError) throw membersError

      const formattedMembers = (members || []).map((m) => ({
        user_id: m.user_id,
        username: m.users?.user_name ?? null,
        full_name: m.users?.full_name ?? null,
        email: m.users?.email ?? null,
        role: m.role,
        nickname: m.nickname,
        joined_at: m.joined_at,
      }))

      return res.status(200).json({
        success: true,
        message: 'Tham gia phòng thành công.',
        roomId: room.id,
        roomCode: room.room_code,
        members: formattedMembers,
      })
    } catch (err) {
      console.error('❌ Lỗi trong roomController.joinRoom:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi server khi tham gia phòng.',
      })
    }
  },
  leaveRoom: async (req, res) => {
    try {
      const { roomId, userId } = req.body
      const uid = getUserIdFromInput(userId)

      // 🛡️ Kiểm tra xem thành viên này có nợ chưa thanh toán không
      const { data: activeBalances, error: balanceErr } = await supabase
        .from('balances')
        .select('*')
        .eq('room_id', roomId)
        .or(`creditor_id.eq.${uid},debtor_id.eq.${uid}`)
        .gt('amount', 0.01)

      if (balanceErr) throw balanceErr

      if (activeBalances && activeBalances.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Bạn không thể rời phòng khi vẫn còn các khoản nợ chưa thanh toán.',
        })
      }

      const { data, error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', uid)

      if (error) throw error

      return res.status(200).json({
        success: true,
        message: 'Rời phòng thành công.',
      })
    } catch (err) {
      console.error('❌ Lỗi trong roomController.leaveRoom:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi server khi rời phòng.',
      })
    }
  },
  removeUserRoom: async (req, res) => {
    try {
      const { roomId, userId } = req.body
      console.log('🚪 Yêu cầu xoá user ID:', userId, 'khỏi phòng ID:', roomId)
      const uid = getUserIdFromInput(userId)

      const { data, error } = await supabase
        .from('room_members')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', uid)

      if (error) throw error

      return res.status(200).json({
        success: true,
        message: 'Xóa thành viên thành công.',
      })
    } catch (err) {
      console.error('❌ Lỗi trong roomController.removeUserRoom:', err)
      return res.status(500).json({
        success: false,
        message: err.message || 'Lỗi server khi xóa thành viên.',
      })
    }
  },
}

export default roomController
