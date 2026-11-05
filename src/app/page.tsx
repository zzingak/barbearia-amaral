"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Barber {
  id: number;
  name: string;
  phone?: string;
}

interface OccupiedSlot {
  startsAt: string;
  endsAt: string;
  professionalId: number;
}

const SERVICES: Service[] = [
  { id: "corte", name: "Cabelo", price: 40 },
  { id: "barba", name: "Barba", price: 25 },
  { id: "combo", name: "Cabelo e Barba", price: 60 },
  { id: "nevou", name: "Nevou", price: 140 },
  { id: "luzes", name: "Luzes", price: 120 },
  { id: "corte_pente", name: "Corte 1 Pente", price: 30 },
];

const ALL_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00"
];

const BACKGROUND_VIDEOS = [
  "/video1.mp4",
  "/video2.mp4"
];

const BARBERIA_WHATSAPP = "557398309182";

export default function Home() {
  const defaultServiceId = SERVICES[0].id;

  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<string>(defaultServiceId);

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState<number>(0);

  const [clientName, setClientName] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);

  const [confirmedBooking, setConfirmedBooking] = useState<{
    code: string;
    clientName: string;
    clientPhone: string;
    dateStr: string;
    timeStr: string;
    barberName: string;
    barberPhone: string;
    serviceName: string;
  } | null>(null);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentBgIndex((prev) => (prev + 1) % BACKGROUND_VIDEOS.length);
    }, 12000);

    return () => clearTimeout(timer);
  }, [currentBgIndex]);

  const fetchBarbers = async () => {
    try {
      const res = await fetch(`/api/admin/barbers?t=${Date.now()}`);
      if (res.ok) {
        const data: Barber[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setBarbers(data);
          setSelectedBarber(data[0].id);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar barbeiros:", err);
    }
  };

  const fetchOccupiedSlots = async () => {
    try {
      const res = await fetch(`/api/bookings?barberId=${selectedBarber}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setOccupiedSlots(data);
      }
    } catch (err) {
      console.error("Erro ao buscar horários ocupados:", err);
    }
  };

  useEffect(() => {
    fetchBarbers();
  }, []);

  useEffect(() => {
    if (selectedBarber) {
      fetchOccupiedSlots();
    }
  }, [selectedBarber]);

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    const days = [];

    const firstDayIndex = date.getDay();
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }

    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const handleDateClick = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    setSelectedDateStr(dateStr);
    setSelectedTime("");
  };

  const isTimeSlotOccupied = (time: string) => {
    if (!selectedDateStr) return false;

    const [hours, minutes] = time.split(":").map(Number);
    const targetStartMinutes = hours * 60 + minutes;
    
    const isLongService = selectedService === "nevou" || selectedService === "luzes";
    const durationMinutes = isLongService ? 120 : 60;
    const targetEndMinutes = targetStartMinutes + durationMinutes;

    if (targetEndMinutes > 19 * 60) {
      return true;
    }

    return occupiedSlots.some((slot) => {
      if (Number(slot.professionalId) !== Number(selectedBarber)) return false;

      const dbStart = new Date(slot.startsAt);
      const dbEnd = new Date(slot.endsAt);

      const dbStartMinutes = dbStart.getHours() * 60 + dbStart.getMinutes();
      const dbEndMinutes = dbEnd.getHours() * 60 + dbEnd.getMinutes();

      const year = dbStart.getFullYear();
      const month = String(dbStart.getMonth() + 1).padStart(2, "0");
      const day = String(dbStart.getDate()).padStart(2, "0");
      const dbDateStr = `${year}-${month}-${day}`;

      if (dbDateStr !== selectedDateStr) return false;

      return targetStartMinutes < dbEndMinutes && targetEndMinutes > dbStartMinutes;
    });
  };

  const getDayStatus = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    const freeSlotsCount = ALL_SLOTS.filter((time) => {
      const [hours, minutes] = time.split(":").map(Number);
      const targetStartMinutes = hours * 60 + minutes;
      const isLongService = selectedService === "nevou" || selectedService === "luzes";
      const durationMinutes = isLongService ? 120 : 60;
      const targetEndMinutes = targetStartMinutes + durationMinutes;

      if (targetEndMinutes > 19 * 60) return false;

      const isConflict = occupiedSlots.some((slot) => {
        if (Number(slot.professionalId) !== Number(selectedBarber)) return false;
        const dbStart = new Date(slot.startsAt);
        const dbEnd = new Date(slot.endsAt);
        const y = dbStart.getFullYear();
        const m = String(dbStart.getMonth() + 1).padStart(2, "0");
        const d = String(dbStart.getDate()).padStart(2, "0");
        const slotDateStr = `${y}-${m}-${d}`;
        if (slotDateStr !== dateStr) return false;

        const dbStartMin = dbStart.getHours() * 60 + dbStart.getMinutes();
        const dbEndMin = dbEnd.getHours() * 60 + dbEnd.getMinutes();

        return targetStartMinutes < dbEndMin && targetEndMinutes > dbStartMin;
      });

      return !isConflict;
    }).length;

    if (freeSlotsCount === 0) {
      return "FULL";
    }
    return "AVAILABLE";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingSubmit) return;

    if (!selectedBarber || !selectedDateStr || !selectedTime || !selectedService) {
      setMessage({ type: "error", text: "Preencha todos os campos do agendamento." });
      return;
    }

    setLoadingSubmit(true);
    setMessage(null);

    try {
      const [year, month, day] = selectedDateStr.split("-").map(Number);
      const [hour, minute] = selectedTime.split(":").map(Number);
      const localDate = new Date(year, month - 1, day, hour, minute, 0);

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService,
          barberId: selectedBarber,
          date: localDate.toISOString(),
          name: clientName,
          phone: clientPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Erro ao realizar agendamento.");
      }

      const currentBarber = barbers.find((b) => b.id === selectedBarber);
      const barberName = currentBarber?.name || "Barbeiro";
      const barberPhone = data.barberPhone || currentBarber?.phone || BARBERIA_WHATSAPP;

      const currentServObj = SERVICES.find((s) => s.id === selectedService);
      const serviceName = currentServObj?.name || "Procedimento";

      const formattedDateBR = `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`;

      setConfirmedBooking({
        code: data.code || "CONFIRMADO",
        clientName,
        clientPhone,
        dateStr: formattedDateBR,
        timeStr: selectedTime,
        barberName,
        barberPhone,
        serviceName,
      });

      await fetchOccupiedSlots();
      setSelectedDateStr("");
      setSelectedTime("");
      setClientName("");
      setClientPhone("");
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Falha de comunicação com o servidor.",
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <main className="min-h-screen relative text-zinc-100 flex flex-col items-center p-4 sm:p-8 overflow-x-hidden">
      
      {/* BACKGROUND COM VÍDEOS EM LOOP */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {BACKGROUND_VIDEOS.map((video, index) => {
          const isActive = index === currentBgIndex;

          return (
            <div
              key={video}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-80 scale-105" : "opacity-0 scale-100"
              }`}
              style={{ transition: 'all 1.5s ease-in-out' }}
            >
              <video
                src={video}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-zinc-950/60 to-zinc-950/80" />
      </div>

      {/* CABEÇALHO SUPERIOR */}
      <div className="relative z-10 max-w-3xl w-full flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <a
            href="https://www.instagram.com/abarbearia.amaral/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xl backdrop-blur-md"
            title="Siga no Instagram"
          >
            📸 Instagram
          </a>

          <a
            href={`https://wa.me/${BARBERIA_WHATSAPP}?text=Olá`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xl backdrop-blur-md"
            title="Fale no WhatsApp"
          >
            💬 WhatsApp
          </a>
        </div>

        <Link
          href="/admin"
          className="px-4 py-2 bg-zinc-900/85 backdrop-blur-md border border-zinc-700 hover:border-amber-500 text-amber-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xl"
        >
          🔒 Painel Admin
        </Link>
      </div>

      {/* CONTAINER PRINCIPAL */}
      <div className="relative z-10 max-w-3xl w-full bg-zinc-950/85 backdrop-blur-2xl border border-zinc-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-black/80 space-y-8">
        
        {/* LOGO AMPLIADA */}
        <header className="text-center flex flex-col items-center justify-center">
          <div className="w-36 h-36 sm:w-40 sm:h-40 mb-4 rounded-full flex items-center justify-center relative overflow-hidden shadow-2xl border-2 border-amber-500/40 bg-zinc-900">
            <img
              src="/logo.png"
              alt="Barbearia Amaral Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-amber-500 tracking-wide uppercase drop-shadow-md">
            Barbearia Amaral
          </h1>
          <p className="text-zinc-300 text-sm mt-1 font-medium">Agende seu horário com facilidade</p>
        </header>

        {confirmedBooking ? (
          <div className="bg-emerald-950/80 backdrop-blur-md border-2 border-emerald-500/60 rounded-2xl p-6 space-y-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center text-3xl font-black mx-auto shadow-lg">
              ✓
            </div>

            <div>
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                Agendamento Confirmado no Sistema!
              </span>
              <h2 className="text-2xl font-black text-white mt-1">
                Seu horário está garantido!
              </h2>
              <p className="text-zinc-200 text-xs mt-1">
                O barbeiro {confirmedBooking.barberName} já recebeu a notificação na agenda.
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-bold">Código:</span>
                <span className="font-mono text-amber-500 font-bold">{confirmedBooking.code}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-bold">Cliente:</span>
                <span className="text-zinc-100 font-bold">{confirmedBooking.clientName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-bold">Procedimento:</span>
                <span className="text-amber-400 font-bold">{confirmedBooking.serviceName}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-bold">Data & Horário:</span>
                <span className="text-emerald-400 font-bold">{confirmedBooking.dateStr} às {confirmedBooking.timeStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-bold">Barbeiro Escolhido:</span>
                <span className="text-zinc-100 font-bold">{confirmedBooking.barberName}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/${confirmedBooking.barberPhone}?text=${encodeURIComponent(
                  `Olá ${confirmedBooking.barberName}! 💈 Aqui é ${confirmedBooking.clientName}.\nAcabei de agendar um(a) *${confirmedBooking.serviceName}* com você pelo site da *Barbearia Amaral* para o dia *${confirmedBooking.dateStr}* às *${confirmedBooking.timeStr}*.\nMeu código de confirmação é: *${confirmedBooking.code}*. Estou ansioso!`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
              >
                💬 Enviar Confirmação Automática no WhatsApp
              </a>

              <button
                onClick={() => setConfirmedBooking(null)}
                className="w-full py-3 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-bold rounded-xl transition-all text-xs"
              >
                Fazer Novo Agendamento
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {message && (
              <div
                className={`p-4 rounded-xl font-medium text-sm ${
                  message.type === "success"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950/80 text-rose-300 border border-rose-800"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* 1. SELECIONAR PROCEDIMENTO */}
            <div>
              <label className="block text-sm font-semibold mb-3 text-zinc-200">
                1. Escolha o Procedimento
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SERVICES.map((service) => {
                  const isSelected = selectedService === service.id;
                  return (
                    <button
                      type="button"
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service.id);
                        setSelectedTime("");
                      }}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/30 text-white shadow-lg scale-105"
                          : "border-zinc-700/60 bg-zinc-900/70 backdrop-blur-md hover:border-zinc-500 text-zinc-300"
                      }`}
                    >
                      <div className="font-bold text-zinc-100 text-sm sm:text-base">{service.name}</div>
                      <div className="text-amber-400 font-extrabold text-xl mt-3">
                        R$ {service.price.toFixed(2)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* AVISO SOLICITADO */}
              <p className="text-xs text-zinc-400 font-medium mt-2.5 text-center">
                Para demais procedimentos consultar no WhatsApp
              </p>

              {(selectedService === "nevou" || selectedService === "luzes") && (
                <p className="text-xs text-amber-400 font-semibold mt-2 text-center">
                  ⚡ Atenção: Procedimento químico (exige 2 horários consecutivos na agenda).
                </p>
              )}
            </div>

            {/* 2. Selecionar Barbeiro */}
            <div>
              <label className="block text-sm font-semibold mb-3 text-zinc-200">
                2. Selecione o Barbeiro
              </label>
              <div className="grid grid-cols-3 gap-3">
                {barbers.map((barber) => (
                  <button
                    type="button"
                    key={barber.id}
                    onClick={() => {
                      setSelectedBarber(barber.id);
                      setSelectedDateStr("");
                      setSelectedTime("");
                    }}
                    className={`p-3 rounded-xl border text-center font-semibold transition-all ${
                      selectedBarber === barber.id
                        ? "border-amber-500 bg-amber-500/30 text-white shadow-lg"
                        : "border-zinc-700/60 bg-zinc-900/60 backdrop-blur-md hover:border-zinc-500 text-zinc-300"
                    }`}
                  >
                    {barber.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Legenda de Cores */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span className="text-zinc-200">Dia com Horários Livres</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-600"></span>
                <span className="text-zinc-200">Dia Lotado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-zinc-200">Horário Livre (Disponível)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-zinc-700"></span>
                <span className="text-zinc-200">Horário Ocupado</span>
              </div>
            </div>

            {/* 3. Calendário */}
            <div>
              <label className="block text-sm font-semibold mb-3 text-zinc-200">
                3. Escolha a Data
              </label>

              <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-700/70 rounded-2xl p-4 shadow-lg">
                <div className="flex justify-between items-center mb-4 px-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                      )
                    }
                    className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-bold hover:bg-zinc-700 text-zinc-200"
                  >
                    &lt; Mês Anterior
                  </button>
                  <span className="font-bold text-amber-400 uppercase text-sm">
                    {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                      )
                    }
                    className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-bold hover:bg-zinc-700 text-zinc-200"
                  >
                    Próximo Mês &gt;
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-zinc-400 mb-2">
                  <span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {getDaysInMonth().map((dateObj, index) => {
                    if (!dateObj) return <div key={`empty-${index}`} />;

                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
                    const day = String(dateObj.getDate()).padStart(2, "0");
                    const dateStr = `${year}-${month}-${day}`;

                    const isSelected = selectedDateStr === dateStr;
                    const dayStatus = getDayStatus(dateObj);
                    const isFull = dayStatus === "FULL";

                    return (
                      <button
                        type="button"
                        disabled={isFull}
                        key={dateStr}
                        onClick={() => handleDateClick(dateObj)}
                        className={`p-3 rounded-xl border text-sm font-black transition-all ${
                          isSelected
                            ? "bg-amber-500 border-amber-500 text-zinc-950 scale-105 shadow-lg"
                            : isFull
                            ? "bg-rose-950/60 border-rose-800 text-rose-400 opacity-60 cursor-not-allowed"
                            : "bg-blue-950/70 border-blue-500 text-blue-200 hover:border-blue-400"
                        }`}
                      >
                        {dateObj.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Horários */}
            {selectedDateStr && (
              <div>
                <label className="block text-sm font-semibold mb-3 text-zinc-200">
                  4. Escolha o Horário ({selectedDateStr})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {ALL_SLOTS.map((time) => {
                    const isOccupied = isTimeSlotOccupied(time);
                    const isSelected = selectedTime === time;

                    return (
                      <button
                        type="button"
                        disabled={isOccupied}
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`p-3 rounded-xl border font-black text-xs sm:text-sm transition-all flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? "bg-amber-500 border-amber-500 text-zinc-950 scale-105 shadow-lg"
                            : isOccupied
                            ? "bg-zinc-900 border-zinc-800 text-zinc-500 opacity-40 cursor-not-allowed line-through"
                            : "bg-emerald-950/80 border-emerald-500 text-emerald-200 hover:bg-emerald-900"
                        }`}
                      >
                        <span>{time}</span>
                        <span className="text-[10px] font-bold">
                          {isOccupied ? "Ocupado" : "Livre"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Identificação */}
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div>
                <label className="block text-sm font-semibold mb-1 text-zinc-200">Seu Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-zinc-200">WhatsApp / Telefone</label>
                <input
                  type="tel"
                  required
                  placeholder="(00) 00000-0000"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-amber-500 shadow-inner"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingSubmit || !selectedBarber || !selectedDateStr || !selectedTime || !selectedService}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl transition-all shadow-lg text-base uppercase font-black"
            >
              {loadingSubmit ? "Confirmando..." : "Confirmar Agendamento"}
            </button>
          </form>
        )}

        {/* RODAPÉ COM ENDEREÇO E MAPA DO GOOGLE MAPS */}
        <footer className="pt-6 border-t border-zinc-800 text-center space-y-4">
          <div>
            <h3 className="text-sm font-black uppercase text-amber-500 tracking-wider">
              📍 Onde Estamos
            </h3>
            <p className="text-zinc-200 text-sm font-medium mt-1">
              Rua Nicolau Miguel Obeidi, 1215 – Bertioga/SP
            </p>
          </div>

          <div className="w-full h-48 rounded-xl overflow-hidden border border-zinc-700 shadow-lg">
            <iframe
              title="Mapa Barbearia Amaral"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3650.781878848795!2d-46.1432!3d-23.8565!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce17c88b90c1f1%3A0x889816e88!2sRua%20Nicolau%20Miguel%20Obeidi%2C%201215%20-%20Bertioga%2C%20SP!5e0!3m2!1spt-BR!2sbr!4v1700000000000!5m2!1spt-BR!2sbr"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen={false}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </footer>

      </div>
    </main>
  );
}