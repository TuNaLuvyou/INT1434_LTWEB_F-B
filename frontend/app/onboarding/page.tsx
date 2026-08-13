'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessTokenFromCookie } from '@/lib/auth/client';
import toast from 'react-hot-toast';
import { 
  Store, ChefHat, Table2, Users, CheckCircle2, ArrowRight, 
  ArrowLeft, Loader2, Sparkles 
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const STEPS = [
  { id: 'welcome', title: 'Chào mừng', icon: Sparkles },
  { id: 'branch', title: 'Chi nhánh', icon: Store },
  { id: 'menu', title: 'Thực đơn', icon: ChefHat },
  { id: 'tables', title: 'Bàn ăn', icon: Table2 },
  { id: 'staff', title: 'Nhân viên', icon: Users },
  { id: 'done', title: 'Hoàn tất', icon: CheckCircle2 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Branch info
  const [branchName, setBranchName] = useState('Chi nhánh chính');
  const [branchAddress, setBranchAddress] = useState('');

  // Menu - will add sample categories
  const [addSampleMenu, setAddSampleMenu] = useState(true);

  // Tables
  const [tableCount, setTableCount] = useState(5);
  const [tablePrefix, setTablePrefix] = useState('Bàn');

  // Staff
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<'CASHIER' | 'KITCHEN'>('CASHIER');

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const token = getAccessTokenFromCookie();

      // Step 1: Update branch
      const branchRes = await fetch(`${API}/api/branches`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const branchData = await branchRes.json();
      const branches = branchData.data || [];

      if (branches.length > 0) {
        const branchId = branches[0].id;
        await fetch(`${API}/api/branches/${branchId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ 
            name: branchName, 
            address: branchAddress || null 
          }),
        });
      }

      // Step 2: Create sample categories if requested
      if (addSampleMenu) {
        const sampleCategories = ['Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng'];
        for (const cat of sampleCategories) {
          await fetch(`${API}/api/admin/categories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({ name: cat }),
          }).catch(() => {}); // Non-blocking
        }
      }

      // Step 3: Create tables
      for (let i = 1; i <= tableCount; i++) {
        await fetch(`${API}/api/tables`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            tableNumber: i,
            label: `${tablePrefix} ${i}`,
            branchId: branches[0]?.id,
          }),
        }).catch(() => {}); // Non-blocking
      }

      // Step 4: Add staff if provided
      if (staffEmail && staffName) {
        await fetch(`${API}/api/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            email: staffEmail,
            name: staffName,
            password: '12345678',
            role: staffRole,
            branchId: branches[0]?.id,
          }),
        }).catch((e) => console.error('Staff creation error:', e));
      }

      toast.success('Thiết lập ban đầu hoàn tất! 🎉');
      router.push('/admin/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Có lỗi xảy ra trong quá trình thiết lập');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return (
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/20">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Chào mừng đến với HiAI-MenuGo!</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Hãy cùng chúng tôi thiết lập nhà hàng của bạn trong vài bước đơn giản.
              Bạn có thể bỏ qua bước này và cấu hình thủ công sau.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-4">
            {['Chi nhánh', 'Thực đơn', 'Bàn ăn', 'Nhân viên'].map((item) => (
              <div key={item} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-xs font-semibold text-zinc-300">{item}</div>
              </div>
            ))}
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-5 py-6">
          <h2 className="text-xl font-bold text-white">Thông tin chi nhánh</h2>
          <p className="text-sm text-zinc-400">Đây là chi nhánh đầu tiên của bạn. Bạn có thể thêm nhiều chi nhánh sau.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Tên chi nhánh</label>
              <input value={branchName} onChange={e => setBranchName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Địa chỉ (tuỳ chọn)</label>
              <input value={branchAddress} onChange={e => setBranchAddress(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-5 py-6">
          <h2 className="text-xl font-bold text-white">Thực đơn mẫu</h2>
          <p className="text-sm text-zinc-400">Bạn có muốn tạo sẵn một số danh mục mẫu để bắt đầu?</p>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={addSampleMenu} onChange={e => setAddSampleMenu(e.target.checked)}
                className="w-5 h-5 rounded accent-violet-500" />
              <div>
                <div className="font-semibold text-zinc-200 text-sm">Tạo danh mục mẫu</div>
                <div className="text-xs text-zinc-500">Khai vị, Món chính, Đồ uống, Tráng miệng</div>
              </div>
            </label>
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-5 py-6">
          <h2 className="text-xl font-bold text-white">Thiết lập bàn ăn</h2>
          <p className="text-sm text-zinc-400">Bạn muốn tạo bao nhiêu bàn cho chi nhánh này?</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Số lượng bàn</label>
              <input type="number" min={1} max={100} value={tableCount} onChange={e => setTableCount(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Tiền tố tên bàn</label>
              <input value={tablePrefix} onChange={e => setTablePrefix(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-5 py-6">
          <h2 className="text-xl font-bold text-white">Thêm nhân viên</h2>
          <p className="text-sm text-zinc-400">Bạn có thể thêm nhân viên đầu tiên hoặc bỏ qua bước này.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Email nhân viên</label>
              <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} placeholder="nhanvien@example.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Tên nhân viên</label>
              <input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Nguyễn Văn A"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">Vai trò</label>
              <div className="flex gap-2">
                <button onClick={() => setStaffRole('CASHIER')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    staffRole === 'CASHIER' ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  }`}>
                  Thu ngân
                </button>
                <button onClick={() => setStaffRole('KITCHEN')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    staffRole === 'KITCHEN' ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                  }`}>
                  Bếp
                </button>
              </div>
            </div>
          </div>
        </div>
      );
      case 5: return (
        <div className="text-center space-y-6 py-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Sẵn sàng khởi động! 🚀</h2>
            <p className="text-zinc-400 mt-2 max-w-md mx-auto">
              Bạn đã hoàn tất các bước thiết lập cơ bản. Hãy bấm "Hoàn tất" để bắt đầu!
            </p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 max-w-sm mx-auto text-left space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-zinc-300">Chi nhánh: <strong>{branchName}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-zinc-300">
                {addSampleMenu ? 'Danh mục mẫu (4 danh mục)' : 'Không tạo danh mục mẫu'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-zinc-300">{tableCount} bàn ăn</span>
            </div>
            {staffEmail && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-zinc-300">Nhân viên: {staffName} ({staffRole})</span>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px] pointer-events-none" />
      
      <div className="w-full max-w-lg">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                idx <= currentStep ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {idx < currentStep ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`h-0.5 w-12 sm:w-16 transition-all ${
                  idx < currentStep ? 'bg-violet-600' : 'bg-zinc-800'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 shadow-xl backdrop-blur-sm">
          {renderStep()}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-zinc-800">
            <button
              onClick={currentStep === 0 ? () => router.push('/admin/dashboard') : handleBack}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {currentStep === 0 ? 'Bỏ qua' : 'Quay lại'}
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-violet-600/20">
                Tiếp theo
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button onClick={handleComplete} disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-600/20">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Hoàn tất
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
