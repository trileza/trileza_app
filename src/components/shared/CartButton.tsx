import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { motion, AnimatePresence } from 'framer-motion';

export const CartButton: React.FC = () => {
  const { items, setIsOpen } = useCartStore();
  const count = items.length;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="relative flex items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-green-500 dark:hover:border-green-500 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-300 select-none group"
    >
      <ShoppingCart size={18} className="text-slate-600 dark:text-slate-400 group-hover:text-green-600 dark:group-hover:text-green-500 transition-colors" />
      
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-black text-white shadow-md shadow-green-500/20"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
