'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  ClockIcon,
  CogIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  UserIcon
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Manage Tenants', href: '/tenants', icon: UsersIcon },
  { name: 'Billing', href: '/billing', icon: DocumentTextIcon },
  { name: 'Payment History', href: '/history', icon: ClockIcon },
  { name: 'Rooms', href: '/rooms', icon: BuildingOfficeIcon },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Check authentication
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    try {
      setUser(JSON.parse(userData))
    } catch (error) {
      console.error('Error parsing user data:', error)
      router.push('/login')
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-50 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex-1 flex flex-col max-w-xs w-full">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white bg-white bg-opacity-20"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent navigation={navigation} pathname={pathname} onLogout={handleLogout} user={user} router={router} />
        </div>
      </div>

      {/* Desktop sidebar - Fixed position */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="fixed top-0 left-0 h-screen w-80 z-30">
          <SidebarContent navigation={navigation} pathname={pathname} onLogout={handleLogout} user={user} router={router} />
        </div>
      </div>

      {/* Main content - with left margin to account for fixed sidebar */}
      <div className="flex flex-col flex-1 md:ml-80">
        {/* Mobile menu button - only visible on mobile */}
        <div className="md:hidden bg-white shadow-sm px-4 py-3 border-b border-gray-100">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 p-2 rounded-lg hover:bg-gray-50"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ navigation, pathname, onLogout, user, router }) {
  const handleProfileClick = () => {
    router.push('/account')
  }

  const JHLogo = () => (
    <div className="w-full flex items-center justify-center">
      <img 
        src="/JH LOGO.svg"
        alt="J&H Apartment Logo"
        className="object-contain"
        style={{
          width: '425px',
          height: '157px',
          maxWidth: '100%',
          filter: 'drop-shadow(0 2px 4px rgba(52, 115, 240, 0.1))'
        }}
      />
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full bg-white shadow-xl border-r border-gray-100">
      {/* Logo Section - Enhanced */}
      <div className="flex items-center justify-center flex-shrink-0 px-4 py-0 border-b border-gray-100">
        <div className="text-center">
          <JHLogo />
        </div>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 px-4 py-4">
        <nav className="space-y-1">
          {navigation.map((item, index) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ease-in-out ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-blue-700 hover:scale-102'
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-colors duration-200 ${
                  isActive 
                    ? 'bg-white bg-opacity-20' 
                    : 'bg-gray-100 group-hover:bg-blue-100'
                }`}>
                  <item.icon
                    className={`h-4 w-4 transition-colors duration-200 ${
                      isActive 
                        ? 'text-white' 
                        : 'text-gray-600 group-hover:text-blue-600'
                    }`}
                  />
                </div>
                <span className="font-medium">{item.name}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom Section - User Profile & Logout */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50">
        {/* User Profile Button */}
        <button
          onClick={handleProfileClick}
          className={`w-full px-4 py-3 hover:bg-gray-100 transition-all duration-200 ${
            pathname === '/account' ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center shadow-sm ${
              pathname === '/account' 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                : 'bg-gradient-to-r from-gray-200 to-gray-300'
            }`}>
              <UserIcon className={`h-5 w-5 ${
                pathname === '/account' ? 'text-white' : 'text-gray-600'
              }`} />
            </div>
            <div className="ml-3 text-left">
              <p className={`text-sm font-semibold ${
                pathname === '/account' ? 'text-blue-900' : 'text-gray-900'
              }`}>
                {user?.username || 'Admin'}
              </p>
              <p className={`text-xs ${
                pathname === '/account' ? 'text-blue-600' : 'text-gray-500'
              } capitalize`}>
                {user?.role || 'Administrator'}
              </p>
            </div>
          </div>
        </button>
        
        {/* Logout Button */}
        <div className="px-4 pb-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-red-600 hover:border-red-200 transition-all duration-200 shadow-sm hover:shadow"
          >
            <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
            SIGN OUT
          </button>
        </div>
      </div>
    </div>
  )
} 