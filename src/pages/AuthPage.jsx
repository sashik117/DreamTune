import { useState } from 'react';
import { Eye, EyeOff, Lock, LogIn, Mail, Music2, ShieldCheck, User } from 'lucide-react';
import { auth } from '@/api/SupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const text = {
  login: 'Sign in',
  register: 'Create account',
  create: 'Create',
  verify: 'Email verification',
  email: 'Email',
  nickname: 'Nickname',
  loginField: 'Email or nickname',
  password: 'Password',
  confirmPassword: 'Confirm password',
  wait: 'Please wait...',
  makeProfile: 'Create profile',
  codeFromEmail: 'Email code',
  confirmAndLogin: 'Confirm and sign in',
  changeEmail: 'Change email or nickname',
  minPassword: 'minimum 6 characters',
  repeatPassword: 'repeat password',
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
        toast.error('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await auth.signIn({ login, password });
        toast.success('Signed in');
        window.location.href = '/';
        return;
      }

      if (mode === 'verify') {
        await auth.verifyEmailCode({ email, code });
        setLogin(nickname);
        toast.success('Email verified, signing in');
        window.location.href = '/';
        return;
      }

      const data = await auth.signUp({ email, nickname, password });
      setDevCode(data.verification_code || '');
      setLogin(nickname);
      setMode('verify');
      toast.success('Verification code sent to your email');
    } catch (err) {
      if (err.needs_verification) {
        if (err.email) setEmail(err.email);
        if (err.nickname) {
          setNickname(err.nickname);
          setLogin(err.nickname);
        }
        if (err.verification_code) setDevCode(err.verification_code);
        setMode('verify');
        toast.message('Enter the email verification code');
        return;
      }
      toast.error(err.message || 'Something went wrong');
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
              {'We sent a code to '}
              <span className="font-bold text-foreground">{email}</span>
              {'. Enter it below and your profile will sign in right away.'}
            </p>
            {devCode && (
              <div className="rounded-2xl bg-secondary/80 border border-border p-3 text-sm">
                <p className="font-bold text-foreground">Test code for local development:</p>
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
              <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="example@mail.com or dreamer" className="pl-10 bg-secondary border-border rounded-2xl" required />
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
                <PasswordEye shown={showPassword} onToggle={() => setShowPassword(value => !value)} label={showPassword ? 'Hide password' : 'Show password'} />
              </div>
            </label>

            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-muted-foreground">{text.confirmPassword}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showConfirmPassword ? 'text' : 'password'} minLength={6} placeholder={text.repeatPassword} className="pl-10 pr-11 bg-secondary border-border rounded-2xl" required />
                  <PasswordEye shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(value => !value)} label={showConfirmPassword ? 'Hide password' : 'Show password'} />
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
