import supabase from '../../config/db/index.js'

const noteController = {
  // Lấy tất cả ghi chú của người dùng
  getNotesByUser: async (req, res) => {
    try {
      const { userId } = req.params

      // Xóa ghi chú cũ hơn 30 ngày
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      await supabase
        .from('room_notes')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', thirtyDaysAgo.toISOString())

      // Lấy ghi chú còn lại, sắp xếp mới nhất trước
      const { data, error } = await supabase
        .from('room_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return res.status(400).json({
          message: 'Lỗi khi lấy ghi chú',
          details: error.message,
        })
      }

      return res.status(200).json({
        message: 'Lấy ghi chú thành công',
        notes: data || [],
      })
    } catch (err) {
      return res.status(500).json({
        message: 'Lỗi server',
        details: err.message,
      })
    }
  },

  // Tạo ghi chú mới
  createNote: async (req, res) => {
    try {
      const { userId } = req.params
      const { content } = req.body

      console.log('createNote - userId:', userId)
      console.log('createNote - content:', content)

      if (!content || content.trim() === '') {
        return res.status(400).json({
          message: 'Nội dung ghi chú không được để trống',
        })
      }

      const result = await supabase
        .from('room_notes')
        .insert({
          user_id: userId,
          content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      console.log('result.error:', result.error?.message)
      console.log('result.data:', result.data)

      if (result.error) {
        return res.status(400).json({
          message: 'Lỗi khi tạo ghi chú',
          details: result.error.message,
        })
      }

      return res.status(200).json({
        message: 'Tạo ghi chú thành công',
        note: result.data[0],
      })
    } catch (err) {
      console.error('createNote error:', err)
      return res.status(500).json({
        message: 'Lỗi server',
        details: err.message,
      })
    }
  },

  // Cập nhật ghi chú
  updateNote: async (req, res) => {
    try {
      const { noteId } = req.params
      const { content } = req.body

      console.log('updateNote - noteId:', noteId)
      console.log('updateNote - content:', content)

      if (!content || content.trim() === '') {
        return res.status(400).json({
          message: 'Nội dung ghi chú không được để trống',
        })
      }

      const result = await supabase
        .from('room_notes')
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .select()

      console.log('result.error:', result.error?.message)
      console.log('result.data:', result.data)

      if (result.error) {
        return res.status(400).json({
          message: 'Lỗi khi cập nhật ghi chú',
          details: result.error.message,
        })
      }

      return res.status(200).json({
        message: 'Cập nhật ghi chú thành công',
        note: result.data[0],
      })
    } catch (err) {
      console.error('updateNote error:', err)
      return res.status(500).json({
        message: 'Lỗi server',
        details: err.message,
      })
    }
  },

  // Xóa ghi chú
  deleteNote: async (req, res) => {
    try {
      const { noteId } = req.params

      console.log('deleteNote - noteId:', noteId)

      const { error } = await supabase
        .from('room_notes')
        .delete()
        .eq('id', noteId)

      if (error) {
        return res.status(400).json({
          message: 'Lỗi khi xóa ghi chú',
          details: error.message,
        })
      }

      return res.status(200).json({
        message: 'Xóa ghi chú thành công',
      })
    } catch (err) {
      console.error('deleteNote error:', err)
      return res.status(500).json({
        message: 'Lỗi server',
        details: err.message,
      })
    }
  },
}

export default noteController
