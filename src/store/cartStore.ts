import { create } from 'zustand';
import { nexus } from '../lib/nexus';

export interface CartItem {
  id: string; // Course ID, Book ID, or Mentorship Program ID
  dbId?: string; // Database primary key
  type: 'course' | 'mentorship' | 'book_buy' | 'book_rent';
  title: string;
  thumbnail: string;
  price: number;
  tier?: 'standard' | 'elite'; // Only for courses
  tutorName?: string;
  tutorId?: string;
  tutorSubaccount?: string; // Splitting info if available
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  fetchCart: (userId: string) => Promise<void>;
  addItem: (item: Omit<CartItem, 'dbId'>, userId: string) => Promise<void>;
  removeItem: (itemId: string, type: CartItem['type'], userId: string) => Promise<void>;
  clearCart: (userId: string) => Promise<void>;
  setIsOpen: (isOpen: boolean) => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  isOpen: false,

  fetchCart: async (userId) => {
    if (!userId) return;
    try {
      const { data, error } = await nexus.database.from('cart_items').select('*').eq('user_id', userId);
      if (data && !error) {
        set({
          items: data.map((d: any) => ({
            id: d.item_id,
            dbId: d.id,
            type: d.item_type as any,
            price: Number(d.price),
            tier: d.tier as any,
            title: d.title,
            thumbnail: d.thumbnail
          }))
        });
      }
    } catch (e) {
      console.error('[Cart DB Fetch Error]:', e);
    }
  },

  addItem: async (item, userId) => {
    // Prevent adding exact duplicate of same item ID and access type
    const exists = get().items.some(i => i.id === item.id && i.type === item.type);
    if (exists) {
      set({ isOpen: true });
      return;
    }

    set({ isOpen: true });

    if (userId) {
      try {
        const { data, error } = await nexus.database.from('cart_items').insert({
          user_id: userId,
          item_id: item.id,
          item_type: item.type,
          price: item.price,
          tier: item.tier || null,
          title: item.title,
          thumbnail: item.thumbnail
        }).select();

        if (data && data[0] && !error) {
          const newItem: CartItem = {
            ...item,
            dbId: data[0].id
          };
          set({ items: [...get().items, newItem] });
        }
      } catch (e) {
        console.error('[Cart DB Add Error]:', e);
      }
    }
  },

  removeItem: async (itemId, type, userId) => {
    const updatedItems = get().items.filter(i => !(i.id === itemId && i.type === type));
    set({ items: updatedItems });

    if (userId) {
      try {
        await nexus.database
          .from('cart_items')
          .delete()
          .eq('user_id', userId)
          .eq('item_id', itemId)
          .eq('item_type', type);
      } catch (e) {
        console.error('[Cart DB Remove Error]:', e);
      }
    }
  },

  clearCart: async (userId) => {
    set({ items: [] });
    if (userId) {
      try {
        await nexus.database.from('cart_items').delete().eq('user_id', userId);
      } catch (e) {
        console.error('[Cart DB Clear Error]:', e);
      }
    }
  },

  setIsOpen: (isOpen) => set({ isOpen }),
  
  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price, 0);
  }
}));
