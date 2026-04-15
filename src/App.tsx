/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { motion } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Viagem } from './lib/db';
import { format, parseISO, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Home, List, Settings, MapPin, Calendar, Moon, Sun, Ambulance, Trash2, AlertTriangle, Info, X, ChevronLeft, ChevronRight, Printer, FileDown, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export default function App() {
  const [activeTab, setActiveTab] = React.useState<'inicio' | 'historico' | 'ajustes'>('inicio');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [viagemToDelete, setViagemToDelete] = React.useState<number | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
  const [historyView, setHistoryView] = React.useState<'lista' | 'calendario'>('lista');
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const [dataViagem, setDataViagem] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Apply theme classes
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const viagens = useLiveQuery(() => db.viagens.orderBy('data_completa').reverse().toArray());
  const config = useLiveQuery(() => db.getConfig());

  const viagensHoje = viagens?.filter(v => isToday(parseISO(v.data_completa))) || [];
  const totalGanhoHoje = viagensHoje.reduce((acc, v) => acc + v.valor_ganho, 0);

  const monthToPrint = activeTab === 'historico' ? (historyView === 'lista' ? selectedDate : calendarMonth) : new Date();
  const monthTripsReport = viagens?.filter(v => isSameMonth(parseISO(v.data_completa), monthToPrint))
    .sort((a, b) => parseISO(a.data_completa).getTime() - parseISO(b.data_completa).getTime()) || [];
  const totalMesReport = monthTripsReport.reduce((acc, v) => acc + v.valor_ganho, 0);

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
    const nome = formData.get('nome') as string;
    await db.updateConfig(v1, v2, nome);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nome = formData.get('nome') as string;
    if (nome.trim() && config) {
      await db.updateConfig(config.valorPrimeiraViagem, config.valorSegundaViagem, nome);
    }
  };

  const handlePrint = () => {
    setShowReport(true);
  };

  const triggerPrint = () => {
    handleSavePDF();
  };

  const handleSavePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      
      console.log('Iniciando geração de PDF...');
      
      const paidTrips = monthTripsReport.filter(v => v.valor_ganho > 0);
      const zeroValueTrips = monthTripsReport.filter(v => v.valor_ganho === 0);
      
      console.log('Dados de viagens:', { paidTrips: paidTrips.length, zeroValueTrips: zeroValueTrips.length });
      const doc = new jsPDF('p', 'mm', 'a4');
      console.log('jsPDF inicializado');
      const margin = 15;
      
      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE DIÁRIAS', margin, margin + 10);
      console.log('Header desenhado');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Motorista: ${config?.motoristaNome || 'Não informado'}`, margin, margin + 20);
      doc.text(`Mês: ${format(monthToPrint, "MMMM 'de' yyyy", { locale: ptBR })}`, margin, margin + 27);
      
      // Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Financeiro', margin, margin + 40);
      
      doc.setFontSize(12);
      doc.text(`Total Acumulado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidTrips.reduce((acc, v) => acc + v.valor_ganho, 0))}`, margin, margin + 48);
      doc.text(`Total de Viagens: ${monthTripsReport.length}`, margin, margin + 55);
      console.log('Resumo desenhado');
      
      let currentY = margin + 65;
      
      // Paid Trips Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Viagens com Diárias', margin, currentY);
      currentY += 5;
      console.log('Iniciando tabela de viagens pagas');
      
      autoTable(doc, {
        startY: currentY,
        head: [['DATA', 'HORA', 'DESTINO', 'VALOR']],
        body: paidTrips.map(v => [
          format(parseISO(v.data_completa), "dd/MM/yyyy"),
          format(parseISO(v.data_completa), "HH:mm"),
          v.destino,
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor_ganho)
        ]),
        margin: { top: margin, bottom: margin, left: margin, right: margin },
        styles: { cellPadding: 3, fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185] }, // Blue header
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 30, halign: 'right' }
        }
      });
      console.log('Tabela de viagens pagas desenhada');
      
      currentY = (doc as any).lastAutoTable.finalY + 10;
      
      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, 210 - margin, currentY);
      currentY += 10;
      
      // Zero Value Trips Table
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Viagens Excedentes/Sem Diária', margin, currentY);
      currentY += 5;
      
      autoTable(doc, {
        startY: currentY,
        head: [['DATA', 'HORA', 'DESTINO', 'VALOR']],
        body: zeroValueTrips.map(v => [
          format(parseISO(v.data_completa), "dd/MM/yyyy"),
          format(parseISO(v.data_completa), "HH:mm"),
          v.destino,
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor_ganho)
        ]),
        margin: { top: margin, bottom: margin, left: margin, right: margin },
        styles: { cellPadding: 3, fontSize: 10 },
        headStyles: { fillColor: [128, 128, 128] }, // Gray header
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 30, halign: 'right' }
        }
      });
      
      console.log('PDF gerado na memória, extraindo base64...');
      const pdfBase64 = doc.output('datauristring');
      const base64Data = pdfBase64.split(',')[1];
      if (!base64Data) {
        throw new Error('Falha ao extrair Base64 do PDF');
      }
      
      const fileName = `relatorio-diarias-${format(monthToPrint, "yyyy-MM")}.pdf`;
      console.log('Salvando arquivo:', fileName);
      
      // Check/Request permissions
      const permissions = await Filesystem.checkPermissions();
      if (permissions.publicStorage !== 'granted') {
        console.log('Solicitando permissões...');
        const request = await Filesystem.requestPermissions();
        if (request.publicStorage !== 'granted') {
          throw new Error('Permissão de escrita negada pelo usuário');
        }
      }
      
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents,
      });
      console.log('Arquivo salvo com sucesso em:', savedFile.uri);
      alert('PDF gerado e salvo em Documentos com sucesso!');
      
    } catch (error) {
      console.error('Erro detalhado ao gerar PDF:', error);
      alert('Erro ao compartilhar relatório. Verifique as permissões do app.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className={`h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 transition-colors overflow-hidden font-sans`}>
      
      {/* Header */}
      <header className="bg-primary-900 dark:bg-slate-950 text-white p-4 shadow-md flex-shrink-0 flex items-center justify-between relative z-10 border-b border-primary-800/50 dark:border-slate-800/50 no-print">
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
        
        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2 rounded-xl bg-primary-800/50 hover:bg-primary-700 transition-colors"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        
        {/* INÍCIO TAB */}
        {activeTab === 'inicio' && (
          <div className="h-full w-full flex flex-col justify-center items-center p-4 max-w-md mx-auto gap-4">
            
            {/* Top: Saldos */}
            <div className="grid grid-cols-2 gap-4 w-full shrink-0">
              <div className="flex flex-col items-center bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Saldo de Hoje</p>
                <h2 className="text-2xl font-black text-primary-600 dark:text-primary-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGanhoHoje)}
                </h2>
              </div>
              <div className="flex flex-col items-center bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total do Mês</p>
                <h2 className="text-2xl font-black text-primary-600 dark:text-primary-400">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viagens?.filter(v => isSameMonth(parseISO(v.data_completa), new Date())).reduce((acc, v) => acc + v.valor_ganho, 0) || 0)}
                </h2>
              </div>
            </div>

            {/* Date Picker */}
            <div className="w-full bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <label htmlFor="dataViagem" className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                Data da Viagem
              </label>
              <input 
                type="date" 
                id="dataViagem"
                value={dataViagem}
                onChange={(e) => setDataViagem(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 font-medium outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Center: Botões */}
            <div className="flex flex-col gap-5 w-full shrink-0 my-5">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAddViagem('Cássia')}
                className="w-[85%] mx-auto bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                CÁSSIA
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAddViagem('Passos')}
                className="w-[85%] mx-auto bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-3xl font-black text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <MapPin className="w-6 h-6" />
                PASSOS
              </motion.button>
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
            <div className="flex items-center justify-between mb-6 px-2 mt-2 flex-shrink-0 no-print">
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
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-2 no-print">
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
                        <div className="bg-primary-900 dark:bg-slate-800 text-white p-5 rounded-3xl shadow-md flex items-center justify-between no-print">
                          <div>
                            <p className="text-primary-200 dark:text-slate-400 text-sm font-bold mb-1">Total do Mês</p>
                            <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMes)}</p>
                          </div>
                          <button 
                            onClick={handlePrint}
                            className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-colors"
                            title="Imprimir Relatório Mensal"
                          >
                            <Printer className="w-6 h-6 text-white" />
                          </button>
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
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors no-print"
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
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 no-print">
                    <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronLeft /></button>
                    <h3 className="font-bold text-lg capitalize text-slate-800 dark:text-slate-200">{format(calendarMonth, "MMMM yyyy", { locale: ptBR })}</h3>
                    <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400"><ChevronRight /></button>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 no-print">
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
                          <div className="bg-primary-900 dark:bg-slate-800 text-white p-5 rounded-3xl shadow-md flex items-center justify-between no-print">
                            <div>
                              <p className="text-primary-200 dark:text-slate-400 text-sm font-bold mb-1">Total do Mês</p>
                              <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMes)}</p>
                            </div>
                            <button 
                              onClick={handlePrint}
                              className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl transition-colors"
                              title="Imprimir Relatório Mensal"
                            >
                              <Printer className="w-6 h-6 text-white" />
                            </button>
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
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors no-print"
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
                <Settings className="w-5 h-5 text-primary-900 dark:text-primary-400" />
                Perfil do Motorista
              </h3>
              <form onSubmit={handleUpdateConfig} className="space-y-5 mt-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    name="nome" 
                    defaultValue={config.motoristaNome}
                    placeholder="Seu nome completo"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary-900 dark:focus:ring-primary-500 outline-none font-bold text-lg"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full p-4 bg-primary-900 hover:bg-primary-800 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-bold text-lg rounded-2xl transition-colors mt-2"
                >
                  Atualizar Nome
                </button>
              </form>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
                <Settings className="w-5 h-5 text-primary-900 dark:text-primary-400" />
                Valores das Diárias
              </h3>
              <form onSubmit={handleUpdateConfig} className="space-y-5 mt-4">
                <input type="hidden" name="nome" defaultValue={config.motoristaNome} />
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
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Desenvolvedor</span>
                <span className="font-bold text-lg text-white">Marcelo Cesar Coelho</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Especialidade</span>
                <span className="font-medium">Software e Sistemas Embarcados</span>
              </div>
              
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wider mb-1">Contato</span>
                <a href="https://wa.me/5535998732951" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300 transition-colors font-bold text-base inline-flex items-center gap-2 bg-primary-900/20 px-4 py-2 rounded-full border border-primary-900/50">
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
      <nav className="h-20 flex-shrink-0 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 z-10 pb-safe no-print">
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

      {/* Relatório de Impressão / Preview */}
      {showReport && (
        <div className="fixed inset-0 bg-slate-900/60 z-[60] overflow-y-auto p-4 md:p-8 flex flex-col items-center backdrop-blur-sm print-transparent">
          <div className="w-full max-w-4xl flex flex-wrap justify-between items-center gap-4 mb-6 no-print">
              <button 
                onClick={() => setShowReport(false)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" /> Fechar
              </button>
              <div className="flex gap-3 flex-1 sm:flex-none justify-end">
                <button 
                  onClick={handleSavePDF}
                  disabled={isGeneratingPDF}
                  className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 rounded-2xl shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                  title="Salvar como PDF"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <FileDown className="w-6 h-6" />
                  )}
                </button>
                <button 
                  onClick={triggerPrint}
                  className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-2xl shadow-lg transition-colors"
                  title="Imprimir"
                >
                  <Printer className="w-6 h-6" />
                </button>
              </div>
            </div>

          <div 
            ref={reportRef}
            className="bg-white text-black p-8 md:p-12 w-full max-w-4xl shadow-2xl rounded-3xl min-h-[29.7cm]"
          >
            <div className="flex flex-col sm:flex-row items-start justify-between border-b-4 border-slate-900 pb-8 mb-10 gap-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">Relatório de Diárias</h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs md:text-sm mt-2">
                  Ambulância • {format(monthToPrint, "MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <div className="mt-4 bg-slate-100 px-4 py-2 rounded-lg inline-block self-start">
                  <p className="text-slate-700 font-black uppercase tracking-widest text-[10px] md:text-xs">
                    Motorista: <span className="text-slate-900">{config?.motoristaNome || 'Não informado'}</span>
                  </p>
                </div>
              </div>
              <div className="text-right flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-12">
              <div className="flex-1 min-w-[200px] bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary-600"></div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Acumulado</p>
                </div>
                <p className="text-3xl font-black text-slate-900 break-words">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMesReport)}
                </p>
              </div>
              <div className="flex-1 min-w-[200px] bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total de Viagens</p>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  {monthTripsReport.length} <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Viagens</span>
                </p>
              </div>
            </div>

            {/* Viagens com Valor (Diárias) */}
            <div className="mb-12">
              <h3 className="text-lg font-black uppercase tracking-widest mb-6 border-b-2 border-slate-200 pb-2 inline-block">Viagens com Diárias</h3>
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b-2 border-slate-900">
                    <th className="py-4 font-black uppercase text-xs tracking-widest">Data</th>
                    <th className="py-4 font-black uppercase text-xs tracking-widest">Hora</th>
                    <th className="py-4 font-black uppercase text-xs tracking-widest">Destino</th>
                    <th className="py-4 text-right font-black uppercase text-xs tracking-widest">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthTripsReport.filter(v => v.valor_ganho > 0).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-medium italic">Nenhuma viagem com diária registrada.</td>
                    </tr>
                  ) : (
                    monthTripsReport.filter(v => v.valor_ganho > 0).map((v, idx) => (
                      <tr key={v.id} className={idx % 2 === 0 ? 'bg-[rgba(248,250,252,0.3)]' : ''}>
                        <td className="py-4 font-bold text-slate-700">{format(parseISO(v.data_completa), "dd/MM/yyyy")}</td>
                        <td className="py-4 text-slate-500 font-medium">{format(parseISO(v.data_completa), "HH:mm")}</td>
                        <td className="py-4 font-black text-slate-900">{v.destino}</td>
                        <td className="py-4 text-right font-black text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor_ganho)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Viagens sem Valor (Excedentes) */}
            <div className="mb-12">
              <h3 className="text-lg font-black uppercase tracking-widest mb-6 border-b-2 border-slate-200 pb-2 inline-block">Viagens Excedentes (Sem Diária)</h3>
              <table className="w-full table-fixed">
                <thead>
                  <tr className="text-left border-b-2 border-slate-900">
                    <th className="py-4 font-black uppercase text-xs tracking-widest w-1/4">Data</th>
                    <th className="py-4 font-black uppercase text-xs tracking-widest w-1/6">Hora</th>
                    <th className="py-4 font-black uppercase text-xs tracking-widest w-1/3">Destino</th>
                    <th className="py-4 text-right font-black uppercase text-xs tracking-widest w-1/4">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthTripsReport.filter(v => v.valor_ganho === 0).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-medium italic">Nenhuma viagem excedente registrada.</td>
                    </tr>
                  ) : (
                    monthTripsReport.filter(v => v.valor_ganho === 0).map((v, idx) => (
                      <tr key={v.id} className={idx % 2 === 0 ? 'bg-[rgba(248,250,252,0.3)]' : ''}>
                        <td className="py-4 font-bold text-slate-700 truncate">{format(parseISO(v.data_completa), "dd/MM/yyyy")}</td>
                        <td className="py-4 text-slate-500 font-medium truncate">{format(parseISO(v.data_completa), "HH:mm")}</td>
                        <td className="py-4 font-black text-slate-900 truncate">{v.destino}</td>
                        <td className="py-4 text-right font-black text-slate-400 truncate">R$ 0,00</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-auto pt-24">
              <div className="flex justify-center mb-12">
                <div className="w-72 border-t border-slate-900 pt-2 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Assinatura</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Dica removida */}
          {showReport && (
            <p className="mt-8 text-slate-400 text-xs font-medium no-print">
            </p>
          )}
        </div>
      )}
    </div>
  );
}
