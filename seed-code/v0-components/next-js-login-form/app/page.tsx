import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <LoginForm
        onSuccess={() => {
          // Handle successful login
          console.log('Login successful!');
        }}
        onForgotPassword={() => {
          // Handle forgot password
          console.log('Forgot password clicked');
        }}
      />
    </div>
  );
}
