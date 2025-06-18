# J&H Apartment Management System

A comprehensive apartment management system built with **Next.js 14**, **React**, **Tailwind CSS**, and **MySQL**. This modern, responsive system provides complete functionality for managing apartments, tenants, billing, payments, and business analytics.

## ✨ Latest Updates

### 🎨 **Responsive Design & Professional UI**
- **Fully responsive** across all pages (mobile, tablet, desktop)
- **Professional sidebar** with JH APARTMENT branding
- **Modern card-based layouts** with gradient effects
- **Mobile-optimized** tables with horizontal scrolling
- **Touch-friendly** navigation and controls

### 📊 **Advanced Business Reports**
- **Monthly business analytics** with executive summaries
- **Revenue tracking** with growth comparisons
- **Occupancy metrics** and performance indicators
- **Payment method analysis** and breakdowns
- **Branch performance** comparison
- **Email report delivery** to multiple recipients
- **Mobile-responsive** report layouts

### 💳 **Enhanced Payment System**
- **Payment history archiving** for historical tracking
- **GCash payment method** support
- **Configurable penalty rates** (adjustable percentage)
- **Automated receipt generation** for all payment types
- **Email receipt delivery** with proper payment method display
- **Deposit usage tracking** and automatic applications

### 🏠 **Advanced Tenant Management**
- **Automated move-out process** with final billing
- **Tenant history preservation** with complete records
- **Contract management** with expiry notifications
- **Billing cycle automation** based on tenant rent periods
- **Email notifications** for all major events
- **Comprehensive tenant search** and filtering

## 🚀 Features

### 🏢 **Branch Management**
- Multiple branch support with individual rate settings
- Branch-specific monthly rent, water rates, and electricity rates
- Automatic room rate inheritance from branch settings
- Branch performance analytics and occupancy tracking
- Bulk room rate synchronization

### 🏠 **Room Management**
- Room creation with automatic rate inheritance from branches
- Room status tracking (vacant, occupied, maintenance)
- Individual room rate overrides when needed
- Visual room cards with status indicators
- Individual room API endpoints for updates

### 👥 **Tenant Management**
- Complete tenant lifecycle management
- **Branch-filtered room selection** during registration
- Contract management with automatic expiry tracking
- Deposit management (advance payment & security deposit)
- **Automated move-out process** with final billing calculations
- Email notifications for welcome, contracts, and receipts
- Tenant history preservation with sophisticated deletion system
- **Tenant archival system** for historical record keeping

### 💰 **Advanced Billing System**
- **Smart Billing Cycles**: Automatic billing based on tenant's rent start date
- **Room-Based Billing Status**: Visual indicators showing when rooms need billing
- **Automatic Bill Generation**: Pre-filled bills with period calculation
- **Electricity Tracking**: Previous reading carry-forward system
- **Configurable Penalty System**: Adjustable penalty rates with 10-day grace period
- **Bill History Archiving**: Automatic archiving of paid bills
- **Final Bill Generation**: Automated final billing for move-outs
- **Email Integration**: Automatic bill delivery to tenants
- **Unpaid Bill Prevention**: Prevents new bills when unpaid bills exist

### 💳 **Payment Processing**
- **Multiple payment methods** (cash, bank transfer, check, GCash)
- **Deposit usage** for bill payments with tracking
- **Payment history** and comprehensive tracking
- **Automatic bill status updates** and archiving
- **Receipt generation** with email delivery
- **Payment method tracking** in archived records
- **Auto-pay with deposits** functionality

### 📊 **Business Analytics & Reports**
- **Monthly business reports** with comprehensive metrics
- **Executive summary** with KPIs and growth tracking
- **Revenue analysis** with payment method breakdowns
- **Occupancy metrics** and performance indicators
- **Branch performance** comparison and analytics
- **Top performer tracking** for tenant payments
- **Email report delivery** to stakeholders
- **Historical trend analysis** with archived data

### ⚙️ **Settings & Configuration**
- **Global Settings**: System-wide default rates
- **Branch-Specific Settings**: Individual branch rate management
- **Configurable Penalty Rates**: Adjustable penalty percentages
- **Electricity Rate Management**: Standardized 11.00 per kWh rates
- **Email Configuration**: SMTP settings for notifications
- **Bulk Operations**: Update all rooms in a branch simultaneously
- **Rate Synchronization**: Keep branch and room rates in sync

### 📱 **Mobile-First Design**
- **Responsive layouts** across all pages
- **Touch-friendly** controls and navigation
- **Mobile-optimized** tables with horizontal scrolling
- **Adaptive typography** and spacing
- **Professional branding** with JH APARTMENT logo integration

### 🔔 **Notification System**
- **Centralized notifications** with 6-word limit
- **Real-time feedback** for all operations
- **Email notifications** for bills, receipts, and contracts
- **Billing reminders** for upcoming due dates
- **Contract expiry alerts** for renewals

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes (Server-side)
- **Database**: MySQL 8.0+ with advanced schema
- **Authentication**: JWT tokens with secure routes
- **Email**: Nodemailer with SMTP configuration
- **Charts**: Recharts for analytics
- **Icons**: Heroicons for modern UI
- **Notifications**: React Hot Toast with custom positioning
- **PDF Generation**: Receipt and report generation
- **Migration System**: Database migration management

## 📁 Project Structure

```
J-H-Apartment/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── branches/             # Branch management
│   │   ├── tenants/              # Tenant management & move-out
│   │   ├── rooms/                # Room management
│   │   ├── bills/                # Advanced billing system
│   │   ├── payments/             # Payment processing & deposits
│   │   ├── settings/             # System configuration
│   │   ├── reports/              # Business analytics
│   │   ├── receipts/             # Receipt generation
│   │   └── dashboard/            # Dashboard data
│   ├── dashboard/                # Dashboard page
│   ├── tenants/                  # Tenant management page
│   ├── rooms/                    # Room management page
│   ├── billing/                  # Billing management page
│   ├── reports/                  # Business reports page
│   ├── history/                  # Payment history page
│   ├── settings/                 # Settings page
│   ├── login/                    # Login page
│   ├── layout.js                 # Root layout
│   └── page.js                   # Home page
├── components/                   # React Components
│   └── Layout/                   # Professional layout components
├── lib/                          # Utility libraries
│   ├── api.js                    # API client functions
│   ├── auth.js                   # Authentication utilities
│   ├── database.js               # Database connection
│   ├── penaltyUtils.js           # Penalty calculation utilities
│   ├── migration-runner.js       # Database migration system
│   └── startup.js                # Application startup utilities
├── models/                       # Database models
│   ├── tenant.js                 # Tenant model
│   ├── room.js                   # Room model
│   ├── bill.js                   # Bill model
│   ├── branch.js                 # Branch model
│   ├── payment.js                # Payment model
│   └── ...                       # Other models
├── services/                     # Business logic services
│   ├── emailService.js           # Email service
│   ├── receiptService.js         # Receipt generation
│   ├── billingReminderService.js # Billing reminders
│   └── contractService.js        # Contract management
├── migrations/                   # Database migrations
│   ├── 001_*.sql                 # Initial schema
│   ├── 022_*.sql                 # Electric rate archiving
│   ├── 023_*.sql                 # GCash payment method
│   ├── 024_*.sql                 # Payment method archiving
│   └── 025_*.sql                 # Payment history table
├── config/                       # Configuration files
│   └── database.sql              # Complete database schema
├── public/                       # Static assets
│   └── JH LOGO.svg               # Professional branding
├── package.json                  # Dependencies
├── next.config.js                # Next.js configuration
└── tailwind.config.js            # Tailwind CSS configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd J-H-Apartment
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   # Create database
   mysql -u root -p -e "CREATE DATABASE jh_apartment;"
   
   # Import schema
   mysql -u root -p jh_apartment < config/database.sql
   ```

4. **Configure environment variables**
   Create a `.env.local` file:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=jh_apartment
   
   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key
   
   # Email Configuration (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Login Credentials
- **Username**: `admin`
- **Password**: `admin123`

## 📖 Advanced Usage Guide

### 1. **Professional Dashboard**
- Real-time KPIs and business metrics
- Quick access to pending bills and overdue payments
- Branch performance overview
- Billing reminder management

### 2. **Branch & Room Setup**
- Configure branch-specific rates and settings
- Automatic room rate inheritance with override capability
- Bulk operations for rate synchronization
- Visual status indicators for room availability

### 3. **Advanced Tenant Management**
- **Registration**: Branch-filtered room selection with pricing
- **Lifecycle Management**: From registration to move-out
- **Move-out Process**: Automated final billing and tenant archival
- **History Tracking**: Complete tenant records preservation

### 4. **Smart Billing System**
- **Automated Billing Cycles**: Based on tenant rent start dates
- **Penalty Management**: Configurable rates with grace periods
- **Bill Prevention**: Blocks new bills when unpaid bills exist
- **Final Bills**: Special handling for move-out scenarios

### 5. **Payment & Receipt Management**
- **Multiple Payment Methods**: Including GCash support
- **Deposit Integration**: Automatic application to bills
- **Receipt Generation**: Automated email delivery
- **Payment History**: Comprehensive tracking and archiving

### 6. **Business Analytics**
- **Monthly Reports**: Executive summaries with growth metrics
- **Revenue Analysis**: Payment method breakdowns
- **Performance Tracking**: Branch and tenant analytics
- **Email Delivery**: Stakeholder report distribution

### 7. **System Configuration**
- **Penalty Rates**: Adjustable percentage settings
- **Email Settings**: SMTP configuration for notifications
- **Rate Management**: Global and branch-specific settings
- **Migration System**: Database schema updates

## 🔧 Advanced Configuration

### Penalty System
- **Configurable Rate**: Default 1.00% adjustable via settings
- **Grace Period**: 10 days after billing cycle ends
- **Automatic Calculation**: Rounded to whole numbers
- **Live Preview**: Real-time penalty examples in settings

### Payment Method Support
- **Cash**: Traditional cash payments
- **Bank Transfer**: Electronic bank transfers
- **Check**: Check payments with tracking
- **GCash**: Digital wallet payments
- **Other**: Custom payment methods

### Email Automation
- **Welcome Emails**: New tenant onboarding
- **Bill Delivery**: Automatic monthly billing
- **Receipt Generation**: Payment confirmations
- **Contract Alerts**: Expiry notifications
- **Business Reports**: Monthly analytics delivery

### Billing Cycle Management
- **Tenant-Specific Cycles**: Based on rent start date
- **Automatic Calculation**: Period determination
- **Penalty Integration**: Late payment handling
- **Final Bill Processing**: Move-out calculations

## 📱 Mobile Responsiveness

### Responsive Design Features
- **Mobile-First Approach**: Optimized for all screen sizes
- **Professional Sidebar**: 320px width with JH APARTMENT branding
- **Adaptive Tables**: Horizontal scrolling with touch gestures
- **Touch Controls**: Finger-friendly buttons and inputs
- **Typography Scaling**: Responsive text sizing
- **Card Layouts**: Modern gradient designs
- **Navigation**: Mobile-optimized menu system

### Screen Size Support
- **Mobile**: 375px and up (iPhone, Android)
- **Tablet**: 768px and up (iPad, Android tablets)
- **Desktop**: 1024px and up (Laptops, monitors)
- **Large Desktop**: 1280px and up (Large monitors)

## 🔒 Security Features

- JWT-based authentication
- Protected API routes
- Input validation and sanitization
- SQL injection prevention
- XSS protection

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Variables for Production
Ensure all environment variables are set in your production environment, especially:
- Database credentials
- JWT secret (use a strong, unique key)
- SMTP configuration for email functionality

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please contact the development team or create an issue in the repository.

---

**Built with ❤️ using Next.js and modern web technologies**
