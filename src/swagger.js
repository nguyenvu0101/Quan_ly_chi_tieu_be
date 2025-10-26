const swaggerJsdoc = require('swagger-jsdoc')
const path = require('path')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tim Trọ API Docs',
      version: '1.0.0',
      description: 'Tài liệu API cho hệ thống tìm trọ',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [path.join(__dirname, 'routes/*.js')], // ✅ Đúng tuyệt đối
}

const swaggerSpec = swaggerJsdoc(options)
module.exports = swaggerSpec
