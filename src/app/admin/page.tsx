"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Barber {
  id: number;
  name: string;
  phone?: string;
  notificationsActive?: boolean;
}

interface Booking {
  id: string;
  code: string;
  startsAt: string;
  customer: {
    name: string;
    phone: string;
  };
  service: {
    name: string;
  };
  professional: {
    id: number;
    name: string;
  };
}

const OFFICIAL_BARBERS: Barber[] = [
  { id: 1, name: "Davi", phone: "5513999999999", notificationsActive: true },
  { id: 2, name: "Caio", phone: "5513999999999", notificationsActive: true },
  { id: 3, name: "Lucas", phone: "5513999999999", notificationsActive: true },
];

export default function AdminPage() {
  const [barbers, setBarbers] = useState<Barber[]>(OFFICIAL_BARBERS);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>("");

  const [message, setMessage] = useState<string>("");

  const fetchBookings = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const url =
        selectedRole === "admin"
          ? `/api/admin/bookings?t=${Date.now()}`
          : `/api/admin/bookings?professionalId=${selectedRole}&t=${Date.now()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error("Erro ao buscar agendamentos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookings();
    }
  }, [selectedRole, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (passwordInput === "1234") {
      setIsAuthenticated(true);
    } else {
      setLoginError("Senha incorreta.");
    }
    setPasswordInput("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput("");
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;

    try {
      const res = await fetch(`/api/admin/bookings?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert("Erro ao excluir agendamento.");
      }
    } catch (err) {
      console.error("Erro ao excluir:", err);
    }
  };

  const handleToggleNotification = (barber: Barber) => {
    const newState = !barber.notificationsActive;
    setBarbers((prev) =>
      prev.map((b) => (b.id === barber.id ? { ...b, notificationsActive: newState } : b))
    );
    setMessage("Preferência de notificação alterada com sucesso!");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleSaveBarberEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBarber) return;

    setBarbers((prev) =>
      prev.map((b) => (b.id === editingBarber.id ? editingBarber : b))
    );
    setMessage("Dados atualizados com sucesso!");
    setEditingBarber(null);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleChangeBarberPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      alert("A nova senha deve ter exatamente 4 dígitos.");
      return;
    }

    setMessage("Senha alterada com sucesso!");
    setShowPasswordModal(false);
    setNewPin("");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleResetBarberPassword = (barberId: number) => {
    if (!confirm("Tem certeza que deseja resetar a senha deste barbeiro para 1234?")) return;
    setMessage("Senha resetada para 1234 com sucesso!");
    setTimeout(() => setMessage(""), 3000);
  };

  const currentLoggedInBarber = barbers.find((b) => String(b.id) === selectedRole);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6 backdrop-blur-md">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-amber-500 uppercase tracking-wide">Painel Barbeiros</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Selecionar Perfil
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 font-bold"
              >
                <option value="admin">👑 Administrador Geral</option>
                {barbers.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    ✂️ Barbeiro: {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">
                Senha
              </label>
              <input
                type="password"
                required
                maxLength={4}
                placeholder="Digite a senha"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 tracking-widest text-center font-bold text-lg"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-950 border border-rose-800 text-rose-300 rounded-xl text-xs text-center font-bold">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl transition-all shadow-lg uppercase text-sm"
            >
              Entrar no Painel
            </button>
          </form>

          <div className="text-center pt-2">
            <Link
              href="/"
              className="text-xs text-zinc-400 hover:text-amber-400 transition-colors font-bold"
            >
              ← Voltar para a Página Inicial do Cliente
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-2xl font-black text-amber-500 uppercase">
              {selectedRole === "admin" ? "Painel do Administrador" : `Painel do Barbeiro: ${currentLoggedInBarber?.name}`}
            </h1>
            <p className="text-xs text-zinc-400">Gerenciamento seguro de agendamentos</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedRole !== "admin" && (
              <button
                onClick={() => setShowPasswordModal(true)}
                className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 rounded-xl text-xs font-bold transition-all"
              >
                🔑 Alterar Senha
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition-all"
            >
              🚪 Sair
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all border border-zinc-700"
            >
              Site
            </Link>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl text-sm text-center font-bold">
            {message}
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleChangeBarberPassword}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center"
            >
              <h3 className="text-lg font-black text-amber-500">Criar Nova Senha</h3>
              <p className="text-xs text-zinc-400">Digite sua nova senha de exatamente 4 dígitos</p>
              
              <input
                type="password"
                maxLength={4}
                required
                placeholder="Ex: 9876"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-center text-xl font-bold tracking-widest text-amber-400 focus:outline-none focus:border-amber-500"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs uppercase"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {selectedRole !== "admin" && currentLoggedInBarber && (
          <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-200">Notificações de Agendamento</h3>
              <p className="text-xs text-zinc-400">Ative ou desative o recebimento de alertas</p>
            </div>
            <button
              onClick={() => handleToggleNotification(currentLoggedInBarber)}
              className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${
                currentLoggedInBarber.notificationsActive ? "bg-emerald-600" : "bg-zinc-700"
              }`}
            >
              <div
                className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${
                  currentLoggedInBarber.notificationsActive ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        )}

        {selectedRole === "admin" && (
          <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-sm font-black uppercase text-amber-500">
              Gerenciar Equipe (Apenas Administrador)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {barbers.map((b) => (
                <div key={b.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl space-y-3">
                  <div>
                    <div className="font-bold text-sm text-zinc-100">{b.name}</div>
                    <div className="text-xs text-zinc-400">WhatsApp: {b.phone || "Não cadastrado"}</div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setEditingBarber(b)}
                      className="w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-bold transition-all"
                    >
                      ✏️ Editar Nome / Whats
                    </button>
                    <button
                      onClick={() => handleResetBarberPassword(b.id)}
                      className="w-full py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold transition-all"
                    >
                      🔄 Resetar Senha (1234)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editingBarber && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveBarberEdit}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            >
              <h3 className="text-lg font-black text-amber-500">Editar Perfil do Barbeiro</h3>
              
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Nome</label>
                <input
                  type="text"
                  value={editingBarber.name}
                  onChange={(e) => setEditingBarber({ ...editingBarber, name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">WhatsApp (DDI + DDD + Número)</label>
                <input
                  type="text"
                  value={editingBarber.phone || ""}
                  onChange={(e) => setEditingBarber({ ...editingBarber, phone: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                  placeholder="5513999999999"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs uppercase"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBarber(null)}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs uppercase"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTA DE AGENDAMENTOS */}
        <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl shadow-xl space-y-4">
          <h2 className="text-lg font-black uppercase text-amber-500">
            {selectedRole === "admin" ? "Todos os Agendamentos (Geral)" : `Seus Agendamentos (${currentLoggedInBarber?.name})`}
          </h2>

          {loading ? (
            <p className="text-zinc-400 text-sm text-center py-6">Carregando agendamentos...</p>
          ) : bookings.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">Nenhum agendamento encontrado.</p>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const dateObj = new Date(booking.startsAt);
                const dateFormatted = dateObj.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                });
                const timeFormatted = dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

                const cleanClientPhone = booking.customer.phone ? booking.customer.phone.replace(/\D/g, "") : "";

                return (
                  <div
                    key={booking.id}
                    className="bg-zinc-950 border border-zinc-800 p-4 sm:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                      <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/60 px-5 py-3.5 rounded-2xl text-center shadow-inner min-w-[140px]">
                        <span className="block text-[11px] font-black uppercase text-amber-400 tracking-wider">
                          Data & Horário
                        </span>
                        <span className="block text-xl font-black text-white tracking-tight mt-1">
                          {timeFormatted}
                        </span>
                        <span className="block text-xs font-bold text-emerald-400 mt-0.5 capitalize">
                          {dateFormatted}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md text-xs font-mono font-bold">
                            Cód: {booking.code}
                          </span>
                        </div>
                        <div className="text-lg font-black text-white">
                          {booking.customer.name} <span className="text-zinc-400 text-sm font-medium">({booking.customer.phone})</span>
                        </div>
                        <div className="text-xs sm:text-sm text-zinc-300">
                          ✂️ <strong className="text-amber-400">{booking.service.name}</strong> | Barbeiro: <span className="text-zinc-100 font-bold">{booking.professional.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800">
                      {cleanClientPhone ? (
                        <a
                          href={`https://wa.me/55${cleanClientPhone}?text=${encodeURIComponent(
                            `Olá ${booking.customer.name}! Aqui é da Barbearia Amaral (${booking.professional.name}). Entramos em contato a respeito do seu agendamento de ${booking.service.name} no dia ${dateFormatted} às ${timeFormatted} devido a um imprevisto.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow"
                          title="Falar com o cliente no WhatsApp em caso de imprevisto"
                        >
                          💬 WhatsApp
                        </a>
                      ) : null}

                      <button
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold transition-all shadow"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}