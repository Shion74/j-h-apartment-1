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
  { name: 'Tenants', href: '/tenants', icon: UsersIcon },
  { name: 'Rooms', href: '/rooms', icon: BuildingOfficeIcon },
  { name: 'Billing', href: '/billing', icon: DocumentTextIcon },
  { name: 'History', href: '/history', icon: ClockIcon },
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 md:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
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
        <div className="fixed top-0 left-0 h-screen w-64 z-30">
          <SidebarContent navigation={navigation} pathname={pathname} onLogout={handleLogout} user={user} router={router} />
        </div>
      </div>

      {/* Main content - with left margin to account for fixed sidebar */}
      <div className="flex flex-col flex-1 md:ml-64">
        {/* Mobile menu button - only visible on mobile */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
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

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center flex-shrink-0 px-4 pt-5 pb-4">
        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <BuildingOfficeIcon className="h-5 w-5 text-white" />
        </div>
        <span className="ml-2 text-xl font-bold text-gray-900">J&H Apartment</span>
      </div>

      {/* Navigation - scrollable area */}
      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150`}
              >
                <item.icon
                  className={`${
                    isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                  } mr-3 flex-shrink-0 h-6 w-6`}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Fixed bottom section - Admin info and logout */}
      <div className="flex-shrink-0 border-t border-gray-200">
        {/* Admin info - clickable to go to account page */}
        <button
          onClick={handleProfileClick}
          className={`w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${
            pathname === '/account' ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              pathname === '/account' ? 'bg-blue-200' : 'bg-gray-200'
            }`}>
              <UserIcon className={`h-5 w-5 ${
                pathname === '/account' ? 'text-blue-600' : 'text-gray-600'
              }`} />
            </div>
            <div className="ml-3 text-left">
              <p className={`text-sm font-medium ${
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
        
        {/* Logout button */}
        <div className="p-4">
          <button
            onClick={onLogout}
            className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
          >
            <ArrowRightOnRectangleIcon className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
} 