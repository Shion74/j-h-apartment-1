# J&H Apartment Management System

A comprehensive apartment management system built with **Next.js 14**, **React**, **Tailwind CSS**, and **MySQL**. This system provides complete functionality for managing apartments, tenants, billing, payments, and more.

## 🚀 Features

### 🏢 **Branch Management**
- Multiple branch support with individual rate settings
- Branch-specific monthly rent, water rates, and electricity rates
- Automatic room rate inheritance from branch settings
- Branch performance analytics and occupancy tracking

### 🏠 **Room Management**
- Room creation with automatic rate inheritance from branches
- Room status tracking (vacant, occupied, maintenance)
- Individual room rate overrides when needed
- Visual room cards with status indicators

### 👥 **Tenant Management**
- Complete tenant lifecycle management
- Contract management with automatic expiry tracking
- Deposit management (advance payment & security deposit)
- Email notifications for welcome, contracts, and receipts
- Tenant history preservation with sophisticated deletion system

### 💰 **Billing System**
- **Smart Billing Cycles**: Automatic billing based on tenant's rent start date
- **Room-Based Billing Status**: Visual indicators showing when rooms need billing
- **Automatic Bill Generation**: Pre-filled bills with period calculation
- **Electricity Tracking**: Previous reading carry-forward system
- **Fixed Water Rates**: Branch-specific water charges
- **Email Integration**: Automatic bill delivery to tenants

### 💳 **Payment Processing**
- Multiple payment methods (cash, bank transfer, check, etc.)
- Deposit usage for bill payments
- Payment history and tracking
- Automatic bill status updates

### ⚙️ **Settings & Configuration**
- **Global Settings**: System-wide default rates
- **Branch-Specific Settings**: Individual branch rate management
- **Bulk Operations**: Update all rooms in a branch simultaneously
- **Rate Synchronization**: Keep branch and room rates in sync

### 📊 **Dashboard & Analytics**
- Real-time statistics and KPIs
- Branch performance overview
- Revenue tracking and charts
- Quick action buttons for common tasks

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes (Server-side)
- **Database**: MySQL 8.0+
- **Authentication**: JWT tokens
- **Email**: Nodemailer with SMTP
- **Charts**: Recharts
- **Icons**: Heroicons
- **Notifications**: React Hot Toast

## 📁 Project Structure

```
J-H-Apartment/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── branches/             # Branch management
│   │   ├── tenants/              # Tenant management
│   │   ├── rooms/                # Room management
│   │   ├── bills/                # Billing system
│   │   ├── payments/             # Payment processing
│   │   ├── settings/             # System settings
│   │   └── dashboard/            # Dashboard data
│   ├── dashboard/                # Dashboard page
│   ├── tenants/                  # Tenant management page
│   ├── rooms/                    # Room management page
│   ├── billing/                  # Billing management page
│   ├── settings/                 # Settings page
│   ├── login/                    # Login page
│   ├── layout.js                 # Root layout
│   └── page.js                   # Home page
├── components/                   # React Components
│   └── Layout/                   # Layout components
├── lib/                          # Utility libraries
│   ├── api.js                    # API client functions
│   ├── auth.js                   # Authentication utilities
│   └── database.js               # Database connection
├── models/                       # Database models
│   ├── tenant.js                 # Tenant model
│   ├── room.js                   # Room model
│   ├── bill.js                   # Bill model
│   ├── branch.js                 # Branch model
│   └── ...                       # Other models
├── services/                     # Business logic services
│   └── emailService.js           # Email service
├── config/                       # Configuration files
│   └── database.sql              # Database schema
├── public/                       # Static assets
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

## 📖 Usage Guide

### 1. **Branch Setup**
- Go to **Settings** → **Branch-Specific Rates**
- Set monthly rent, water rate, and electricity rate for each branch
- Use "Save & Sync All Rooms" to update existing rooms

### 2. **Room Management**
- Navigate to **Rooms** → **Add Room**
- Select a branch (rates are automatically inherited)
- Room number and description are customizable

### 3. **Tenant Management**
- Go to **Tenants** → **Add Tenant**
- Fill in tenant details and select an available room
- Set rent start date (determines billing cycle)
- Configure deposits and payment status

### 4. **Billing Process**
- Navigate to **Billing** to see room cards with billing status
- Rooms show "Needs Billing" when due date approaches (3 days before)
- Click "Generate Bill" to create bills with auto-filled periods
- Enter present electricity reading
- Bills are automatically sent to tenants via email

### 5. **Payment Processing**
- Record payments against bills
- Support for multiple payment methods
- Automatic bill status updates

## 🔧 Configuration

### Branch Rate Management
Each branch can have its own rates:
- **Monthly Rent**: Default rent for all rooms in the branch
- **Water Rate**: Fixed monthly water charge per room
- **Electricity Rate**: Rate per kWh for electricity consumption

### Billing Cycles
- Billing cycles are based on tenant's rent start date
- If a tenant starts on the 15th, bills are due every 15th
- System automatically calculates billing periods
- Previous electricity readings carry forward automatically

### Email Configuration
Configure SMTP settings in environment variables for:
- Welcome emails to new tenants
- Bill delivery
- Contract expiry notifications
- Deposit receipts

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
