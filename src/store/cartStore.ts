import { create } from 'zustand';
import api from '../services/api';
import Swal from 'sweetalert2';

interface CartItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    price: number;
    stock: number;
    mainImage: string;
    brand?: string;
    description?: string;
  };
  quantity: number;
  status: 'pending' | 'confirmed';
}

interface CartStore {
  cartItems: CartItem[];
  fetchCart: () => Promise<void>;
  addToCart: (productId: string) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  confirmPickup: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
}

const saveCartToLocalStorage = (cartItems: CartItem[]) => {
  localStorage.setItem('cartItems', JSON.stringify(cartItems));
};

const loadCartFromLocalStorage = (): CartItem[] => {
  try {
    const storedCart = localStorage.getItem('cartItems');
    return storedCart ? JSON.parse(storedCart) : [];
  } catch (error) {
    console.error('Error loading cart:', error);
    return [];
  }
};

export const useCartStore = create<CartStore>((set) => ({
  cartItems: loadCartFromLocalStorage(),

  fetchCart: async () => {
    try {
      const response = await api.get<CartItem[]>('/api/cart');
      
      // Validar y limpiar datos
      const validatedData = response.data
        .filter(item => item?.product?._id && item?.product?.price)
        .map(item => ({
          ...item,
          product: {
            _id: item.product._id,
            name: item.product.name || 'Producto sin nombre',
            price: item.product.price,
            stock: item.product.stock,
            mainImage: item.product.mainImage || '/default-product.png',
            brand: item.product.brand,
            description: item.product.description
          }
        }));

      set({ cartItems: validatedData });
      saveCartToLocalStorage(validatedData);
    } catch (error) {
      console.error('Error fetching cart:', error);
      const localCart = loadCartFromLocalStorage();
      set({ cartItems: localCart });
    }
  },

  addToCart: async (productId) => {
    try {
      const response = await api.post<CartItem[]>('/api/cart/add', { productId });
      set({ cartItems: response.data });
      saveCartToLocalStorage(response.data);
    } catch (error) {
      await Swal.fire('Error', 'No se pudo agregar el producto', 'error');
    }
  },

  removeFromCart: async (itemId) => {
    try {
      await api.delete(`/api/cart/remove/${itemId}`);
      set((state) => {
        const updatedCart = state.cartItems.filter(item => item._id !== itemId);
        saveCartToLocalStorage(updatedCart);
        return { cartItems: updatedCart };
      });
    } catch (error) {
      console.error('Error removing item:', error);
    }
  },

  updateQuantity: async (itemId, quantity) => {
    try {
      await api.put(`/api/cart/update/${itemId}`, { quantity });
      await useCartStore.getState().fetchCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      if ((error as any).response?.data?.message === 'Stock insuficiente') {
        await Swal.fire('Stock insuficiente', 'No hay suficientes unidades disponibles', 'warning');
      }
    }
  },

  confirmPickup: async (itemId) => {
    try {
      await api.put(`/api/cart/confirm/${itemId}`);
      await useCartStore.getState().fetchCart();
    } catch (error) {
      console.error('Error confirming pickup:', error);
    }
  }
}));