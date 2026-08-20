import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Tag, CreditCard, ShoppingBag, CheckCircle, Zap } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import type { CartItem } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useCheckout } from '../../lib/services/paystack';
import { nexus } from '../../lib/nexus';
import { libraryService } from '../../lib/services/libraryService';

import { cn, formatCurrency } from '../../utils';
import { Toast } from '../ui/Toast';

export const CartDrawer: React.FC = () => {
  const { items, isOpen, setIsOpen, fetchCart, removeItem, clearCart, getTotal } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user?.id) {
      fetchCart(user.id);
    }
  }, [user?.id, fetchCart]);
  
  // Coupon state
  const [couponInput, setCouponInput] = useState('');
  const [activeCoupon, setActiveCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // UI states
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const subtotal = getTotal();
  const discount = activeCoupon ? (subtotal * activeCoupon.discountPercent) / 100 : 0;
  const finalTotal = Math.max(0, subtotal - discount);

  // Apply Coupon
  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();

    if (code === 'TRILEZA20') {
      setActiveCoupon({ code, discountPercent: 20 });
      setToast({ message: '20% off coupon applied!', type: 'success' });
    } else if (code === 'TRILEZA50') {
      setActiveCoupon({ code, discountPercent: 50 });
      setToast({ message: '50% off coupon applied!', type: 'success' });
    } else if (code === 'TRILEZAFREE') {
      setActiveCoupon({ code, discountPercent: 100 });
      setToast({ message: '100% FREE access coupon applied!', type: 'success' });
    } else {
      setCouponError('Invalid coupon code.');
    }
  };

  // Safe database operations upon checkout success
  const recordSuccessfulTransactions = async () => {
    if (!user?.id) return;
    setIsProcessing(true);

    try {
      // Execute all inserts sequentially or in parallel
      const enrollmentsToInsert = items
        .filter(item => item.type === 'course' || item.type === 'mentorship')
        .map(item => ({
          user_id: user.id,
          item_id: item.id,
          item_type: item.type === 'mentorship' ? 'mentorship' : 'course',
          item_title: item.title,
          item_thumbnail: item.thumbnail,
          status: 'enrolled',
          tier: item.tier ? (item.tier === 'standard' ? 'Standard' : 'Elite') : undefined,
          amount: item.price
        }));

      if (enrollmentsToInsert.length > 0) {
        // Insert into enrollments table
        const { error } = await nexus.database.from('enrollments').insert(enrollmentsToInsert);
        if (error) throw error;
      }

      // Upsert book access with cumulative rent triggers & borrow timers
      const booksToUpsert = items.filter(item => item.type === 'book_buy' || item.type === 'book_rent');
      for (const book of booksToUpsert) {
        if (book.type === 'book_rent') {
          await libraryService.borrowBook(user.id, book.id, book.price);
        } else {
          await libraryService.buyBook(user.id, book.id);
        }
      }

      // 3. Create real-time notification alert rows in DB
      const notificationsToInsert = items.map(item => ({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: user.id,
        title: 'Checkout Successful',
        message: `Successfully checked out "${item.title}" for ${formatCurrency(item.price)}!`,
        type: 'success',
        is_read: false
      }));

      if (notificationsToInsert.length > 0) {
        await nexus.database.from('notifications').insert(notificationsToInsert);
      }

      // Notify the application to refresh states
      window.dispatchEvent(new CustomEvent('trileza-payment-success'));
      
      setToast({ message: 'Checkout successful! Enjoy your new items! 🎉', type: 'success' });
      
      // Reset cart and navigate
      setTimeout(() => {
        const hasBooks = booksToUpsert.length > 0;
        if (user?.id) clearCart(user.id);
        setIsOpen(false);
        setActiveCoupon(null);
        setCouponInput('');
        setIsProcessing(false);
        if (hasBooks) {
          navigate('/library?tab=bought');
        }
      }, 1500);

    } catch (err) {
      console.error('[Checkout DB Sync Error]:', err);
      setToast({ message: 'Failed to record purchases to database.', type: 'info' });
      setIsProcessing(false);
    }
  };

  // Paystack checkout hook
  const { pay } = useCheckout({
    email: user?.email || 'test@trileza.com',
    amount: finalTotal,
    metadata: {
      type: 'cart_checkout',
      student_id: user?.id,
      items: items.map(i => ({ id: i.id, type: i.type, price: i.price, tier: i.tier }))
    },
    onSuccess: (ref) => {
      recordSuccessfulTransactions();
    },
    onClose: () => {
      setIsProcessing(false);
      setToast({ message: 'Payment cancelled.', type: 'info' });
    }
  });

  const handleCheckoutClick = () => {
    if (items.length === 0) return;
    setIsProcessing(true);

    if (finalTotal === 0) {
      // 100% free checkout bypasses Paystack gateway
      recordSuccessfulTransactions();
    } else {
      // Open Paystack popup
      pay();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Slide-over panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-[101] w-full max-w-lg bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={20} className="text-green-600" />
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Your Atelier Cart</h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                      <ShoppingBag size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">Your cart is empty</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-[240px]">
                        Add items from Courses, Programs, or the Public Library to checkout.
                      </p>
                    </div>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={`${item.id}-${item.type}`} className="relative overflow-hidden rounded-2xl">
                      {/* Swipe Delete Background Indicator */}
                      <div className="absolute inset-0 bg-red-650 flex items-center justify-end px-6 text-white rounded-2xl">
                        <Trash2 size={18} className="animate-pulse" />
                      </div>

                      <motion.div
                        drag="x"
                        dragConstraints={{ left: -100, right: 0 }}
                        dragElastic={{ left: 0.15, right: 0 }}
                        onDragEnd={(e, info) => {
                          if (info.offset.x < -75 && user?.id) {
                            removeItem(item.id, item.type, user.id);
                            setToast({ message: `${item.title} removed from cart.`, type: 'info' });
                          }
                        }}
                        className="flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 relative z-10 touch-pan-y"
                      >
                        <img
                          src={item.thumbnail || 'https://api.dicebear.com/7.x/initials/svg?seed=Book'}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
                          alt={item.title}
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{item.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                              {item.type === 'course' ? 'Course' :
                               item.type === 'mentorship' ? 'Mentor' :
                               item.type === 'book_rent' ? 'Rent' : 'Buy'}
                            </span>
                            {item.tier && (
                              <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">• {item.tier}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white">{formatCurrency(item.price)}</p>
                          <button
                            onClick={() => { if (user?.id) removeItem(item.id, item.type, user.id); }}
                            className="mt-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  ))
                )}
              </div>

              {items.length > 0 && (
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 space-y-4 shrink-0">
                  {/* Coupon Form */}
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="COUPON CODE (e.g. TRILEZA50)"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="w-full pl-9 pr-3 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white uppercase outline-none focus:ring-1 focus:ring-green-500/30"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-black text-white uppercase tracking-wider transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                  {couponError && <p className="text-red-500 text-[10px] font-bold text-left">{couponError}</p>}
                  {activeCoupon && (
                    <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400 font-black uppercase tracking-wider">
                      <CheckCircle size={10} /> Active Coupon: {activeCoupon.code} ({activeCoupon.discountPercent}% OFF)
                    </div>
                  )}

                  {/* Summary */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Discount</span>
                        <span>-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                    <div className="flex justify-between text-sm text-slate-900 dark:text-white font-black">
                      <span>Grand Total</span>
                      <span className="text-green-600 dark:text-green-400 text-base">{formatCurrency(finalTotal)}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handleCheckoutClick}
                    disabled={isProcessing}
                    className={cn(
                      "w-full h-12 rounded-2xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 border-none transition-all shadow-lg shadow-green-500/10",
                      isProcessing
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700 active:scale-98"
                    )}
                  >
                    {isProcessing ? (
                      <>Processing...</>
                    ) : finalTotal === 0 ? (
                      <>
                        <Zap size={14} /> Claim Free Checkout
                      </>
                    ) : (
                      <>
                        <CreditCard size={14} /> Pay & Checkout
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
};
