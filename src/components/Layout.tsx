import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ClockIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/dateUtils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Clientes', href: '/clientes', icon: UserGroupIcon },
    { name: 'Servicios', href: '/pedidos', icon: ClipboardDocumentListIcon },
    { name: 'Pagos', href: '/pagos', icon: CurrencyDollarIcon },
    { name: 'Inventario', href: '/inventario', icon: CubeIcon },
    { name: 'Gastos', href: '/gastos', icon: CurrencyDollarIcon },
    { name: 'Reportes', href: '/reportes', icon: ChartBarIcon },
    { name: 'Capital', href: '/capital', icon: CurrencyDollarIcon },
  ];

  // Solo mostrar configuración a administradores
  if (user?.role === 'admin') {
    navigation.push({ name: 'Configuración', href: '/configuracion', icon: Cog6ToothIcon });
  }

  // Función para determinar si un elemento está activo
  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  // Función para manejar la navegación
  const handleNavigation = (href: string) => {
    navigate(href);
    setSidebarOpen(false); // Cerrar sidebar en móvil después de navegar
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Sidebar móvil */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-gradient-to-b from-white to-blue-50 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-lg">
                <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                  <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-sm"></div>
                  <div className="bg-gradient-to-br from-pink-400 to-red-500 rounded-sm"></div>
                  <div className="bg-gradient-to-br from-blue-400 to-purple-500 rounded-sm"></div>
                  <div className="bg-gradient-to-br from-green-400 to-teal-500 rounded-sm"></div>
                </div>
              </div>
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">Alquiler Global</span>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={`${
                      active
                        ? 'bg-gradient-to-r from-primary-100 to-primary-200 text-primary-900 shadow-md'
                        : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-lg w-full text-left transition-all duration-200`}
                  >
                    <item.icon
                      className={`${
                        active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-4 flex-shrink-0 h-6 w-6`}
                    />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">{user?.name}</p>
                <p className="text-sm font-medium text-gray-500">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-56">
          <div className="flex flex-col h-0 flex-1 border-r border-blue-200 bg-gradient-to-b from-white to-blue-50 shadow-xl">
            <div className="flex-1 flex flex-col pt-4 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shadow-lg">
                  <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-sm"></div>
                    <div className="bg-gradient-to-br from-pink-400 to-red-500 rounded-sm"></div>
                    <div className="bg-gradient-to-br from-blue-400 to-purple-500 rounded-sm"></div>
                    <div className="bg-gradient-to-br from-green-400 to-teal-500 rounded-sm"></div>
                  </div>
                </div>
                <span className="ml-2 text-xl font-bold bg-gradient-to-r from-primary-700 to-primary-800 bg-clip-text text-transparent">Alquiler Global</span>
              </div>
              <nav className="mt-4 flex-1 px-2 bg-white space-y-1">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`${
                        active
                          ? 'bg-gradient-to-r from-primary-100 to-primary-200 text-primary-900 shadow-md'
                          : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-lg w-full text-left transition-all duration-200`}
                    >
                      <item.icon
                        className={`${
                          active ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 flex-shrink-0 h-6 w-6`}
                      />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-3">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  <UserIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                  <p className="text-xs font-medium text-gray-500 capitalize">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="Cerrar sesión"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <div className="md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3">
          <button
            type="button"
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-white">
          <div className="py-4">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
