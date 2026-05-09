import { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, Music2, ShieldCheck, User } from 'lucide-react';
import { auth } from '@/api/SupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const text = {
  login: '\u0423\u0432\u0456\u0439\u0442\u0438',
  register: '\u0420\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044f',
  create: '\u0421\u0442\u0432\u043e\u0440\u0438\u0442\u0438',
  verify: '\u041f\u0435\u0440\u0435\u0432\u0456\u0440\u043a\u0430 \u043f\u043e\u0448\u0442\u0438',
  email: '\u041f\u043e\u0448\u0442\u0430',
  nickname: '\u041d\u0456\u043a\u043d\u0435\u0439\u043c',
  loginField: '\u041f\u043e\u0448\u0442\u0430 \u0430\u0431\u043e \u043d\u0456\u043a\u043d\u0435\u0439\u043c',
  password: '\u041f\u0430\u0440\u043e\u043b\u044c',
  confirmPassword: '\u041f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f \u043f\u0430\u0440\u043e\u043b\u044e',
  wait: '\u0417\u0430\u0447\u0435\u043a\u0430\u0439...',
  makeProfile: '\u0421\u0442\u0432\u043e\u0440\u0438\u0442\u0438 \u043f\u0440\u043e\u0444\u0456\u043b\u044c',
  codeFromEmail: '\u041a\u043e\u0434 \u0437 \u043f\u043e\u0448\u0442\u0438',
  confirmAndLogin: '\u041f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 \u0456 \u0443\u0432\u0456\u0439\u0442\u0438',
  changeEmail: '\u0417\u043c\u0456\u043d\u0438\u0442\u0438 \u043f\u043e\u0448\u0442\u0443 \u0430\u0431\u043e \u043d\u0456\u043a\u043d\u0435\u0439\u043c',
  minPassword: '\u043c\u0456\u043d\u0456\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u0456\u0432',
  repeatPassword: '\u043f\u043e\u0432\u0442\u043e\u0440\u0438 \u043f\u0430\u0440\u043e\u043b\u044c',
};

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    if (mode === 'register') {
      if (password.length < 6) {
        toast.error('\u041f\u0430\u0440\u043e\u043b\u044c \u043c\u0430\u0454 \u043c\u0430\u0442\u0438 \u043c\u0456\u043d\u0456\u043c\u0443\u043c 6 \u0441\u0438\u043c\u0432\u043e\u043b\u0456\u0432');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('\u041f\u0430\u0440\u043e\u043b\u0456 \u043d\u0435 \u0437\u0431\u0456\u0433\u0430\u044e\u0442\u044c\u0441\u044f');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await auth.signIn({ login, password });
        toast.success('\u0412\u0445\u0456\u0434 \u0432\u0438\u043a\u043e\u043d\u0430\u043d\u043e');
        window.location.href = '/';
        return;
      }

      if (mode === 'verify') {
        await auth.verifyEmailCode({ email, code });
        setLogin(nickname);
        toast.success('\u041f\u043e\u0448\u0442\u0443 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043e, \u0432\u0445\u043e\u0434\u0438\u043c\u043e');
        window.location.href = '/';
        return;
      }

      const data = await auth.signUp({ email, nickname, password });
      setDevCode(data.verification_code || '');
      setLogin(nickname);
      setMode('verify');
      toast.success('\u041a\u043e\u0434 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u043d\u0430 \u043f\u043e\u0448\u0442\u0443');
    } catch (err) {
      toast.error(err.message || '\u041d\u0435 \u0432\u0438\u0439\u0448\u043b\u043e');
    } finally {
      setLoading(false);
    }
  };

  const PasswordEye = ({ shown, onToggle, label }) => (
    <button type="button" onClick={onToggle} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-muted" aria-label={label}>
      {shown ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
    </button>
  );

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="fixed inset-0 app-background-layer" aria-hidden="true" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card/95 p-5 shadow-2xl shadow-primary/10 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-muted-foreground">DreamTune</p>
            <h1 className="text-2xl font-black text-foreground">
              {mode === 'login' ? text.login : mode === 'verify' ? text.verify : text.register}
            </h1>
          </div>
        </div>

        {mode !== 'verify' && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
            <button type="button" onClick={() => setMode('login')} className={`rounded-xl py-2 text-sm font-black ${mode === 'login' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
              {text.login}
            </button>
            <button type="button" onClick={() => setMode('register')} className={`rounded-xl py-2 text-sm font-black ${mode === 'register' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`}>
              {text.create}
            </button>
          </div>
        )}

        {mode === 'verify' ? (
          <>
            <p className="text-sm text-muted-foreground">
              {'\u041c\u0438 \u0432\u0456\u0434\u043f\u0440\u0430\u0432\u0438\u043b\u0438 \u043a\u043e\u0434 \u043d\u0430 '}
              <span className="font-bold text-foreground">{email}</span>
              {'\u002e \u0412\u0432\u0435\u0434\u0438 \u0439\u043e\u0433\u043e \u043d\u0438\u0436\u0447\u0435, \u0456 \u043f\u0440\u043e\u0444\u0456\u043b\u044c \u043e\u0434\u0440\u0430\u0437\u0443 \u0443\u0432\u0456\u0439\u0434\u0435 \u0432 \u0434\u043e\u0434\u0430\u0442\u043e\u043a.'}
            </p>
            {devCode && (
              <div className="rounded-2xl bg-secondary/80 border border-border p-3 text-sm">
                <p className="font-bold text-foreground">{'\u0422\u0435\u0441\u0442\u043e\u0432\u0438\u0439 \u043a\u043e\u0434 \u0434\u043b\u044f \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0443\u0441\u043a\u0443:'}</p>
                <p className="text-2xl font-black text-primary tracking-[0.25em] mt-1">{devCode}</p>
              </div>
            )}
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{text.codeFromEmail}</span>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6} className="pl-10 bg-secondary border-border rounded-2xl tracking-[0.25em] font-black" required />
              </div>
            </label>
          </>
        ) : mode === 'register' ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{text.email}</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="example@mail.com" className="pl-10 bg-secondary border-border rounded-2xl" required />
              </div>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{text.nickname}</span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="dreamer" minLength={3} className="pl-10 bg-secondary border-border rounded-2xl" required />
              </div>
            </label>
          </>
        ) : (
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-muted-foreground">{text.loginField}</span>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="example@mail.com або dreamer" className="pl-10 bg-secondary border-border rounded-2xl" required />
            </div>
          </label>
        )}

        {mode !== 'verify' && (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground">{text.password}</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} minLength={6} placeholder={text.minPassword} className="pl-10 pr-11 bg-secondary border-border rounded-2xl" required />
                <PasswordEye shown={showPassword} onToggle={() => setShowPassword(value => !value)} label={showPassword ? '\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u043f\u0430\u0440\u043e\u043b\u044c' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u043f\u0430\u0440\u043e\u043b\u044c'} />
              </div>
            </label>

            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">{text.confirmPassword}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showConfirmPassword ? 'text' : 'password'} minLength={6} placeholder={text.repeatPassword} className="pl-10 pr-11 bg-secondary border-border rounded-2xl" required />
                  <PasswordEye shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(value => !value)} label={showConfirmPassword ? '\u0421\u0445\u043e\u0432\u0430\u0442\u0438 \u043f\u0430\u0440\u043e\u043b\u044c' : '\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u0438 \u043f\u0430\u0440\u043e\u043b\u044c'} />
                </div>
              </label>
            )}
          </>
        )}

        <Button disabled={loading} className="w-full rounded-2xl h-12 gap-2">
          <LogIn className="w-4 h-4" />
          {loading ? text.wait : mode === 'login' ? text.login : mode === 'verify' ? text.confirmAndLogin : text.makeProfile}
        </Button>

        {mode === 'verify' && (
          <button type="button" onClick={() => setMode('register')} className="w-full text-xs font-bold text-muted-foreground hover:text-foreground">
            {text.changeEmail}
          </button>
        )}
      </form>
    </main>
  );
}
