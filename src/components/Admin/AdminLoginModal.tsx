import React, { useState } from 'react';
import { X, Lock, Mail, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { isAdminEmail } from '../../App';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

const getAuthErrorMessage = (code?: string) => {
  switch (code) {
    case 'auth/invalid-credential':
      return 'Credenciais inválidas. Verifique o e-mail e a senha.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas de acesso. Tente novamente em alguns minutos.';
    case 'auth/network-request-failed':
      return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
    default:
      return 'Não foi possível entrar no painel. Tente novamente.';
  }
};

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!isFirebaseConfigured || !auth) {
      setError('A autenticação do painel não está configurada. Defina as variáveis VITE_FIREBASE_* e o e-mail do admin antes de publicar.');
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim();
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      if (!isAdminEmail(credential.user.email)) {
        await signOut(auth);
        setError('Este e-mail não tem permissão de anfitriã.');
        return;
      }
      onLoginSuccess();
      onClose();
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      setError(getAuthErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[#FAF8F5] border border-[#EADBCE] rounded-3xl p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-full bg-[#F4EFEB] text-[#68625B] hover:text-[#2D2A26] flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#F0E6DE] text-[#C86D51] flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-serif text-2xl font-medium text-[#2D2A26]">
            Área da Anfitriã
          </h3>
          <p className="text-xs text-[#68625B] mt-1">
            Meu cantinho novo também precisa de organização: aqui cuido do evento, da lista e dos convidados.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
              E-mail do Administrador
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#EADBCE] bg-white text-sm text-[#2D2A26] focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A59E95]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#EADBCE] bg-white text-sm text-[#2D2A26] focus:border-[#C86D51] focus:ring-2 focus:ring-[#C86D51]/15 outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-[#C86D51] hover:bg-[#A95339] disabled:opacity-50 text-white text-xs font-semibold tracking-wide uppercase flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            {loading ? 'Entrando...' : 'Entrar no Painel'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#EADBCE] text-center text-xs text-[#68625B] flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#C86D51]" />
          <span>Acesso protegido com autenticação do Firebase.</span>
        </div>
      </div>
    </div>
  );
};
