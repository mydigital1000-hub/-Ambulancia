/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Viagem } from './lib/db';
import { format, parseISO, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Home, List, Settings, MapPin, Calendar, Moon, Sun, Ambulance, Trash2, AlertTriangle, Info, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico' | 'ajustes'>('inicio');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [viagemToDelete, setViagemToDelete] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [historyView, setHistoryView] = useState<'lista' | 'calendario'>('lista');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dataViagem, setDataViagem] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Apply theme classes
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const viagens = useLiveQuery(() => db.viagens.orderBy('data_completa').reverse().toArray());
  const config = useLiveQuery(() => db.getConfig());

  const viagensHoje = viagens?.filter(v => isToday(parseISO(v.data_completa))) || [];
  const totalGanhoHoje = viagensHoje.reduce((acc, v) => acc + v.valor_ganho, 0);

  const viagensPorMes = viagens?.reduce((acc, viagem) => {
    const mesAno = format(parseISO(viagem.data_completa), "MMMM 'de' yyyy", { locale: ptBR });
    if (!acc[mesAno]) {
      acc[mesAno] = { viagens: [], total: 0 };
    }
    acc[mesAno].viagens.push(viagem);
    acc[mesAno].total += viagem.valor_ganho;
    return acc;
  }, {} as Record<string, { viagens: Viagem[], total: number }>) || {};

  const handleAddViagem = async (destino: 'Cássia' | 'Passos') => {
    const selectedDate = parseISO(dataViagem);
    const now = new Date();
    // Keep the current time so it's not exactly midnight
    selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    await db.addViagem(destino, selectedDate);
    
    // Reset date to today after adding
    setDataViagem(format(new Date(), 'yyyy-MM-dd'));
  };

  const confirmDelete = async () => {
    if (viagemToDelete !== null) {
      await db.deleteViagem(viagemToDelete);
      setViagemToDelete(null);
    }
  };

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const v1 = Number(formData.get('v1'));
    const v2 = Number(formData.get('v2'));
    await db.updateConfig(v1, v2);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors overflow-hidden font-sans">
      
      {/* Header */}
      <header className="bg-primary-900 dark:bg-slate-950 text-white p-4 shadow-md flex-shrink-0 flex items-center justify-center relative z-10 border-b border-primary-800/50 dark:border-slate-800/50">
        <div className="flex items-center gap-3">
          {/* Logo Mark */}
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-primary-300/30 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-60"></div>
            <Ambulance className="w-6 h-6 text-white relative z-10 drop-shadow-md" strokeWidth={2.5} />
          </div>
          {/* Logo Text */}
          <div className="flex flex-col justify-center">
            <h1 className="text-2xl font-black tracking-tight leading-none flex items-center gap-1.5">
              DIÁRIAS<span className="font-medium text-primary-300 text-xl tracking-normal">AMBULÂNCIA</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        
        {/* INÍCIO TAB */}
        {activeTab === 'inicio' && (
          <div className="h-full w-full flex flex-col justify-center items-center p-4 max-w-md mx-auto gap-4">
            
            {/* Top: Saldo */}
            <div className="flex flex-col items-center w-full bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
              <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Saldo de Hoje</p>
              <h2 className="text-4xl font-black text-primary-900 dark:text-primary-400">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGanhoHoje)}
              </h2>
            </div>

            {/* Date Picker */}
            <div className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <label htmlFor="dataViagem" className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-900 dark:text-primary-400" />
                Data da Viagem
              </label>
              <input 
                type="date" 
                id="dataViagem"
                value={dataViagem}
                onChange={(e) => setDataViagem(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="bg-slate-200 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Center: Botões */}
            <div className="flex flex-col gap-5 w-full shrink-0 my-5">
              <button 
                onClick={() => handleAddViagem('Cássia')}
                className="w-[85%] mx-auto bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white py-4 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                CÁSSIA
              </button>
              <button 
                onClick={() => handleAddViagem('Passos')}
                className="w-[85%] mx-auto bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white py-4 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                PASSOS
              </button>
            </div>

            {/* Bottom: Indicador */}
            <div className="bg-primary-100 dark:bg-slate-800 text-primary-900 dark:text-primary-300 px-5 py-2 rounded-full font-bold text-base shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
              {viagensHoje.length} {viagensHoje.length === 1 ? 'viagem registrada' : 'viagens registradas'} hoje
            </div>
          </div>
        )}

        {/* HISTÓRICO TAB */}
        {activeTab === 'historico' && (
          <div className="h-full w-full flex flex-col p-4 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-6 px-2 mt-2 flex-shrink-0">
              <h2 className="text-2xl font-bold text-primary-900 dark:text-primary-400">Histórico</h2>
              <div className="flex bg-slate-300 dark:bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setHistoryView('lista')}
                  className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${historyView === 'lista' ? 'bg-slate-50 dark:bg-slate-700 text-primary-900 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setHistoryView('calendario')}
                  className={`px-3 py-1 text-sm font-bold rounded-md transition-colors ${historyView === 'calendario' ? 'bg-slate-50 dark:bg-slate-700 text-primary-900 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  Calendário
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {historyView === 'lista' ? (
                <div className="space-y-4">
                  {/* Date Navigator */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-2">
                    <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronLeft /></button>
                    <h3 className="font-bold text-lg capitalize text-slate-800 dark:text-slate-200">{format(selectedDate, "dd 'de' MMMM yyyy", { locale: ptBR })}</h3>
                    <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronRight /></button>
                  </div>

                  {(() => {
                    const monthTrips = viagens?.filter(v => isSameMonth(parseISO(v.data_completa), selectedDate)) || [];
                    const totalMes = monthTrips.reduce((acc, v) => acc + v.valor_ganho, 0);
                    const dayTrips = viagens?.filter(v => isSameDay(parseISO(v.data_completa), selectedDate)) || [];
                    const totalDia = dayTrips.reduce((acc, v) => acc + v.valor_ganho, 0);

                    return (
                      <div className="space-y-4">
                        <div className="bg-primary-900 dark:bg-slate-800 text-white p-5 rounded-3xl shadow-md flex items-center justify-between">
                          <div>
                            <p className="text-primary-200 dark:text-slate-400 text-sm font-bold mb-1">Total do Mês</p>
                            <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMes)}</p>
                          </div>
                        </div>

                        {dayTrips.length === 0 ? (
                          <p className="text-center text-slate-500 dark:text-slate-400 py-12 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                            Nenhuma viagem registrada neste dia.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between px-2 mb-4">
                              <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg">Total do Dia</h3>
                              <span className="font-black text-primary-600 dark:text-primary-400 text-lg bg-primary-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDia)}
                              </span>
                            </div>
                            {dayTrips.map((viagem) => (
                              <div key={viagem.id} className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="bg-primary-100 dark:bg-slate-700 p-3 rounded-full text-primary-900 dark:text-primary-400">
                                    <MapPin className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">{viagem.destino}</p>
                                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mt-1">
                                      <Calendar className="w-4 h-4" />
                                      {format(parseISO(viagem.data_completa), "HH:mm")}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className={`font-black text-lg ${viagem.valor_ganho > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                      {viagem.valor_ganho > 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viagem.valor_ganho)}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => setViagemToDelete(viagem.id!)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronLeft /></button>
                    <h3 className="font-bold text-lg capitalize text-slate-800 dark:text-slate-200">{format(calendarMonth, "MMMM yyyy", { locale: ptBR })}</h3>
                    <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronRight /></button>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                        <div key={i} className="text-center text-xs font-bold text-slate-400">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {eachDayOfInterval({ start: startOfWeek(startOfMonth(calendarMonth)), end: endOfWeek(endOfMonth(calendarMonth)) }).map((day, i) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isCurrentMonth = isSameMonth(day, calendarMonth);
                        const dayTrips = viagens?.filter(v => isSameDay(parseISO(v.data_completa), day)) || [];
                        const hasTrips = dayTrips.length > 0;

                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedDate(day)}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all relative ${
                              isSelected 
                                ? 'bg-primary-600 text-white shadow-md' 
                                : isCurrentMonth 
                                  ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700' 
                                  : 'text-slate-300 dark:text-slate-600'
                            }`}
                          >
                            {format(day, 'd')}
                            {hasTrips && (
                              <div className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-slate-50' : 'bg-primary-500'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Date Trips */}
                  <div className="mt-6 space-y-3">
                    {(() => {
                      const monthTrips = viagens?.filter(v => isSameMonth(parseISO(v.data_completa), calendarMonth)) || [];
                      const totalMes = monthTrips.reduce((acc, v) => acc + v.valor_ganho, 0);
                      const dayTrips = viagens?.filter(v => isSameDay(parseISO(v.data_completa), selectedDate)) || [];
                      const totalDia = dayTrips.reduce((acc, v) => acc + v.valor_ganho, 0);

                      return (
                        <div className="space-y-4">
                          <div className="bg-primary-900 dark:bg-slate-800 text-white p-5 rounded-3xl shadow-md flex items-center justify-between">
                            <div>
                              <p className="text-primary-200 dark:text-slate-400 text-sm font-bold mb-1">Total do Mês</p>
                              <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMes)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-2 mb-2 mt-4">
                            <h3 className="font-bold text-slate-700 dark:text-slate-300">
                              Viagens em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                            </h3>
                            {dayTrips.length > 0 && (
                              <span className="font-black text-primary-600 dark:text-primary-400 text-sm bg-primary-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDia)}
                              </span>
                            )}
                          </div>

                          {dayTrips.length === 0 ? (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-8 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 border-dashed">
                              Nenhuma viagem neste dia.
                            </p>
                          ) : (
                            dayTrips.map((viagem) => (
                              <div key={viagem.id} className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="bg-primary-100 dark:bg-slate-700 p-3 rounded-full text-primary-900 dark:text-primary-400">
                                    <MapPin className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">{viagem.destino}</p>
                                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mt-1">
                                      <Calendar className="w-4 h-4" />
                                      {format(parseISO(viagem.data_completa), "HH:mm")}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className={`font-black text-lg ${viagem.valor_ganho > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                      {viagem.valor_ganho > 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viagem.valor_ganho)}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => setViagemToDelete(viagem.id!)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AJUSTES TAB */}
        {activeTab === 'ajustes' && config && (
          <div className="h-full w-full overflow-y-auto p-6 max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-primary-900 dark:text-primary-400 mt-2">Configurações</h2>
            
            <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                <Sun className="w-5 h-5 text-primary-900 dark:text-primary-400" />
                Aparência
              </h3>
              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}
                >
                  <Sun className={`w-5 h-5 ${theme === 'light' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500'}`} />
                  <span className={`font-bold ${theme === 'light' ? 'text-primary-900 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'}`}>Modo Claro</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-primary-300'}`}
                >
                  <Moon className={`w-5 h-5 ${theme === 'dark' ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500'}`} />
                  <span className={`font-bold ${theme === 'dark' ? 'text-primary-900 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'}`}>Modo Escuro</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                <Settings className="w-5 h-5 text-primary-900 dark:text-primary-400" />
                Valores das Diárias
              </h3>
              <form onSubmit={handleUpdateConfig} className="space-y-5 mt-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Valor 1ª Viagem (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="v1" 
                    defaultValue={config.valorPrimeiraViagem}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-900 dark:focus:ring-primary-500 outline-none font-bold text-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Valor 2ª Viagem (R$)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="v2" 
                    defaultValue={config.valorSegundaViagem}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-900 dark:focus:ring-primary-500 outline-none font-bold text-lg"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full p-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-bold text-lg rounded-2xl transition-colors mt-2"
                >
                  Salvar Alterações
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Confirmação de Exclusão */}
      {viagemToDelete !== null && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Excluir Viagem</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 font-medium">
              Tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setViagemToDelete(null)}
                className="flex-1 p-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 p-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Informações (Ficha Técnica) */}
      {showInfo && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#0a192f] rounded-3xl p-8 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 text-slate-100 flex flex-col items-center text-center border border-slate-700/50">
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-sm font-bold tracking-[0.2em] text-slate-300 mb-4 mt-2">
              ENGENHARIA DE SISTEMAS
            </h2>
            <div className="w-full h-px bg-slate-600/50 mb-6" />
            
            <div className="space-y-5 text-sm w-full">
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Solução</span>
                <span className="font-medium text-base">Gestão Operacional de Diárias</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Versão</span>
                <span className="font-mono bg-slate-800/80 px-3 py-1 rounded-md text-slate-300 border border-slate-700/50">v0.1.0</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Desenvolvedor Principal</span>
                <span className="font-bold text-lg text-white">Marcelo Cesar Coelho</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Especialidade</span>
                <span className="font-medium">Software e Sistemas Embarcados</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Suporte</span>
                <a href="tel:+5535998732951" className="text-primary-400 hover:text-primary-300 transition-colors font-bold text-base inline-flex items-center gap-2 bg-primary-900/20 px-4 py-2 rounded-full border border-primary-900/50">
                  (35) 99873-2951
                </a>
              </div>
              
              <div className="pt-2">
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-2">Status do Sistema</span>
                <div className="flex items-center justify-center gap-3 font-mono bg-slate-800/80 py-3 rounded-xl border border-slate-700/50">
                  <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse text-lg leading-none">●</span>
                  <span className="text-slate-200 tracking-wide">Operacional</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="h-20 flex-shrink-0 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 z-10 pb-safe">
        <button 
          onClick={() => setActiveTab('inicio')}
          className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${activeTab === 'inicio' ? 'text-primary-900 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Home className={`w-6 h-6 ${activeTab === 'inicio' ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">Início</span>
        </button>
        <button 
          onClick={() => setActiveTab('historico')}
          className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${activeTab === 'historico' ? 'text-primary-900 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <List className={`w-6 h-6 ${activeTab === 'historico' ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">Histórico</span>
        </button>
        <button 
          onClick={() => setActiveTab('ajustes')}
          className={`flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors ${activeTab === 'ajustes' ? 'text-primary-900 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
          <Settings className={`w-6 h-6 ${activeTab === 'ajustes' ? 'fill-current' : ''}`} />
          <span className="text-xs font-bold">Ajustes</span>
        </button>
        <button 
          onClick={() => setShowInfo(true)}
          className="flex flex-col items-center justify-center w-20 h-full gap-1 transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <Info className="w-6 h-6" />
          <span className="text-xs font-bold">Info</span>
        </button>
      </nav>
    </div>
  );
}
