/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'jh_apartment',
    DB_PORT: process.env.DB_PORT || '3306',
    EMAIL_USER: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
    EMAIL_PASS: process.env.EMAIL_PASS || 'gcme okaj qiyf ubki',
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here',
  },
  experimental: {
    serverComponentsExternalPackages: ['mysql2', 'bcrypt', 'nodemailer', 'pdfkit', 'puppeteer']
  },
  images: {
    domains: ['localhost'],
  },
  // Initialize report scheduler on server startup
  async rewrites() {
    // Start the report scheduler when the server starts
    if (typeof window === 'undefined') {
      try {
        const reportScheduler = (await import('./lib/report-scheduler.js')).default
        reportScheduler.start()
        console.log('✅ Monthly report scheduler initialized')
      } catch (error) {
        console.error('❌ Failed to initialize report scheduler:', error)
      }
    }
    return []
  }
}

module.exports = nextConfig 