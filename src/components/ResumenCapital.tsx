import React from 'react';
import { 
  CurrencyDollarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BanknotesIcon,
  WrenchScrewdriverIcon,
  CreditCardIcon
} from '@heroicons/react/24/outline';
import { formatCurrency } from '../utils/dateUtils';

interface ResumenCapitalProps {
  capitalInicial: number;
  inyeccionesCapital: number;
  serviciosPagados: number;
  serviciosPendientes: number;
  retiros: number;
  gastosGenerales: number;
  mantenimientos: number;
}

const ResumenCapital: React.FC<ResumenCapitalProps> = ({
  capitalInicial,
  inyeccionesCapital,
  serviciosPagados,
  serviciosPendientes,
  retiros,
  gastosGenerales,
  mantenimientos
}) => {
  const totalIngresos = capitalInicial + inyeccionesCapital + serviciosPagados + serviciosPendientes;
  const totalEgresos = retiros + gastosGenerales + mantenimientos;
  const saldoActual = totalIngresos - totalEgresos;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Resumen de Capital</h2>
        <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* INGRESOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpIcon className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">💰 Ingresos</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Capital Inicial</span>
              <span className="font-medium text-gray-900">{formatCurrency(capitalInicial)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Inyecciones</span>
              <span className="font-medium text-gray-900">{formatCurrency(inyeccionesCapital)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Servicios Pagados</span>
              <span className="font-medium text-gray-900">{formatCurrency(serviciosPagados)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm text-blue-700 font-medium">Servicios Pendientes</span>
              <span className="font-semibold text-blue-900">{formatCurrency(serviciosPendientes)}</span>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded-lg border border-green-200">
              <span className="text-sm font-semibold text-green-700">Total Ingresos</span>
              <span className="text-lg font-bold text-green-900">{formatCurrency(totalIngresos)}</span>
            </div>
          </div>
        </div>

        {/* EGRESOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownIcon className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-medium text-gray-900">💸 Egresos</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Retiros</span>
              <span className="font-medium text-gray-900">{formatCurrency(retiros)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Gastos Generales</span>
              <span className="font-medium text-gray-900">{formatCurrency(gastosGenerales)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Mantenimientos</span>
              <span className="font-medium text-gray-900">{formatCurrency(mantenimientos)}</span>
            </div>
          </div>
          
          <div className="border-t pt-3">
            <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
              <span className="text-sm font-semibold text-red-700">Total Egresos</span>
              <span className="text-lg font-bold text-red-900">{formatCurrency(totalEgresos)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SALDO ACTUAL */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center py-4 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="h-6 w-6 text-blue-600" />
            <span className="text-lg font-semibold text-blue-900">Saldo Actual</span>
          </div>
          <span className="text-2xl font-bold text-blue-900">{formatCurrency(saldoActual)}</span>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Dinero real disponible (Ingresos - Egresos)
        </p>
      </div>
    </div>
  );
};

export default ResumenCapital;


