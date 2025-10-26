import jwt from 'jsonwebtoken'

export const verifyToken = (req, res, next) => {
  // Lấy Access Token từ header
  const authHeader = req.headers.authorization
  const refreshToken = req.cookies?.refreshToken

  if (authHeader) {
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.JWT_ACCESS_KEY, (err, user) => {
      if (err) {
        return res.status(403).json('Token không hợp lệ!')
      }
      req.user = user
      next()
    })
  } else {
    return res.status(401).json('Bạn chưa được xác thực!')
  }
}

export const verifyTokenAndUserAuthorization = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.id === parseInt(req.params.id) || req.user.isAdmin) {
      next()
    } else {
      res.status(403).json('Bạn không có quyền thực hiện hành động này!')
    }
  })
}

export const verifyTokenUserPost = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.id === parseInt(req.params.userId) || req.user.isAdmin) {
      next()
    } else {
      res.status(403).json('Bạn không có quyền thực hiện hành động này!')
    }
  })
}

export const verifyTokenAndAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.isAdmin) {
      next()
    } else {
      res.status(403).json('Chỉ admin mới được phép thực hiện hành động này!')
    }
  })
}
