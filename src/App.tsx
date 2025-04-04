// firebase deploy --only hosting:shoppingoflist
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Check } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from './lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NewItemState {
  name: string;
  quantity: number;
  unitPrice: string;
}

// Online/offline detection
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

function App() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<NewItemState>({
    name: '',
    quantity: 1,
    unitPrice: '',
  });
  const [pendingChanges, setPendingChanges] = useState<ShoppingItem[]>([]);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (isOnline && pendingChanges.length > 0) {
      syncPendingChanges();
    }
  }, [isOnline]);

  const loadItems = async () => {
    try {
      const localItems = localStorage.getItem('shopping-items');
      const localData = localItems ? JSON.parse(localItems) : [];

      if (navigator.onLine) {
        try {
          const querySnapshot = await getDocs(collection(db, 'items'));
          const fetchedItems = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
          })) as ShoppingItem[];
          
          // Update localStorage and state only if we got data from Firebase
          if (fetchedItems.length > 0) {
            setItems(fetchedItems);
            localStorage.setItem('shopping-items', JSON.stringify(fetchedItems));
          } else if (localData.length > 0) {
            // Only use local data if Firebase returned empty results
            setItems(localData);
          }
        } catch (error) {
          console.error('Error loading from Firebase:', error);
          // Fallback to local data on Firebase error
          if (localData.length > 0) {
            setItems(localData);
          }
        }
      } else if (localData.length > 0) {
        // Offline mode - use local data
        setItems(localData);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      // Final fallback
      const localItems = localStorage.getItem('shopping-items');
      if (localItems) {
        setItems(JSON.parse(localItems));
      }
    }
  };

  const syncPendingChanges = async () => {
    if (pendingChanges.length === 0) return;
    
    const updatedPendingChanges = [...pendingChanges];
    const failedChanges: ShoppingItem[] = [];
    
    try {
      for (let i = 0; i < updatedPendingChanges.length; i++) {
        const item = updatedPendingChanges[i];
        
        try {
          if (!item.id.includes('local-')) {
            // Update existing document
            const { id, ...itemWithoutId } = item;
            await updateDoc(doc(db, 'items', id), itemWithoutId);
          } else {
            // Add new document
            const { id, ...itemData } = item;
            const docRef = await addDoc(collection(db, 'items'), itemData);
            
            // Update local items with the new Firebase ID
            setItems(prevItems => 
              prevItems.map(prevItem => 
                prevItem.id === item.id ? { ...prevItem, id: docRef.id } : prevItem
              )
            );
            
            // Update localStorage with the new ID
            const currentItems = JSON.parse(localStorage.getItem('shopping-items') || '[]');
            const updatedItems = currentItems.map((localItem: ShoppingItem) => 
              localItem.id === item.id ? { ...localItem, id: docRef.id } : localItem
            );
            localStorage.setItem('shopping-items', JSON.stringify(updatedItems));
          }
        } catch (error) {
          console.error('Error syncing item:', error);
          failedChanges.push(item);
        }
      }
      
      setPendingChanges(failedChanges);
      
    } catch (error) {
      console.error('Error in sync process:', error);
    }
  };

  const saveToStorage = (updatedItems: ShoppingItem[]) => {
    setItems(updatedItems);
    localStorage.setItem('shopping-items', JSON.stringify(updatedItems));
  };

  const parseCurrency = (value: string): number => {
    // Handle empty string
    if (!value) return 0;
    
    // Replace comma with dot for proper float parsing
    const cleanValue = value.replace(/[^0-9,]/g, '').replace(/,/g, '.');
    return parseFloat(cleanValue) || 0;
  };

  const formatCurrency = (value: number): string => {
    return value.toFixed(2).replace('.', ',');
  };

  const handleAddItem = async () => {
    if (!newItem.name || newItem.quantity <= 0) return;
  
    const parsedPrice = parseCurrency(newItem.unitPrice);
    let newItemData: ShoppingItem;
    let updatedItems: ShoppingItem[];
  
    try {
      if (isOnline) {
        // Tenta salvar diretamente no Firebase primeiro
        const docRef = await addDoc(collection(db, 'items'), {
          name: newItem.name,
          quantity: newItem.quantity,
          unitPrice: parsedPrice,
          total: newItem.quantity * parsedPrice,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
  
        // Cria o item com ID do Firebase
        newItemData = {
          id: docRef.id,
          name: newItem.name,
          quantity: newItem.quantity,
          unitPrice: parsedPrice,
          total: newItem.quantity * parsedPrice,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
  
        // Atualiza o estado local com o ID real do Firebase
        updatedItems = [...items, newItemData];
        saveToStorage(updatedItems);
  
      } else {
        // Offline: usa ID local temporário
        const newItemId = `local-${Date.now()}`;
        newItemData = {
          id: newItemId,
          name: newItem.name,
          quantity: newItem.quantity,
          unitPrice: parsedPrice,
          total: newItem.quantity * parsedPrice,
          completed: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
  
        updatedItems = [...items, newItemData];
        saveToStorage(updatedItems);
        setPendingChanges(prev => [...prev, newItemData]);
      }
  
    } catch (error) {
      // Fallback para local se falhar o Firebase
      const newItemId = `local-${Date.now()}`;
      newItemData = {
        id: newItemId,
        name: newItem.name,
        quantity: newItem.quantity,
        unitPrice: parsedPrice,
        total: newItem.quantity * parsedPrice,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  
      updatedItems = [...items, newItemData];
      saveToStorage(updatedItems);
      setPendingChanges(prev => [...prev, newItemData]);
    }
  
    // Reset do formulário
    setNewItem({ name: '', quantity: 1, unitPrice: '' });
    setIsAddingItem(false);
  };

  const handleUpdateItem = async (itemId: string) => {
    const parsedPrice = parseCurrency(newItem.unitPrice);
    const itemToUpdate = items.find(item => item.id === itemId);
    
    if (!itemToUpdate) return;

    const newData = {
      ...itemToUpdate,
      name: newItem.name,
      quantity: newItem.quantity,
      unitPrice: parsedPrice,
      total: newItem.quantity * parsedPrice,
      updatedAt: new Date().toISOString()
    };

    // Update local state first
    const updatedItems = items.map(item => item.id === itemId ? newData : item);
    saveToStorage(updatedItems);

    // Reset editing state
    setIsEditingItem(null);
    setNewItem({ name: '', quantity: 1, unitPrice: '' });

    // Try to sync with Firebase if online
    if (isOnline && !itemId.includes('local-')) {
      try {
        const { id, ...itemWithoutId } = newData;
        await updateDoc(doc(db, 'items', id), itemWithoutId);
      } catch (error) {
        console.error('Error updating item in Firebase:', error);
        setPendingChanges(prev => [...prev, newData]);
      }
    } else {
      // Add to pending changes for later sync
      setPendingChanges(prev => [...prev, newData]);
    }
  };

  const handleRemoveItem = async (id: string) => {
    // Update local state first
    const updatedItems = items.filter(item => item.id !== id);
    saveToStorage(updatedItems);

    // Try to delete from Firebase if online
    if (isOnline && !id.includes('local-')) {
      try {
        await deleteDoc(doc(db, 'items', id));
      } catch (error) {
        console.error('Error removing item from Firebase:', error);
      }
    }
    
    // Remove from pending changes if present
    setPendingChanges(prev => prev.filter(item => item.id !== id));
  };

  const toggleItemCompletion = async (id: string) => {
    const itemToUpdate = items.find(item => item.id === id);
    if (!itemToUpdate) return;
    
    const updatedItem = {
      ...itemToUpdate,
      completed: !itemToUpdate.completed,
      updatedAt: new Date().toISOString()
    };
    
    // Update local state first
    const updatedItems = items.map(item => 
      item.id === id ? updatedItem : item
    );
    saveToStorage(updatedItems);
    
    // Try to sync with Firebase if online
    if (isOnline && !id.includes('local-')) {
      try {
        const { id: docId, ...itemData } = updatedItem;
        await updateDoc(doc(db, 'items', docId), itemData);
      } catch (error) {
        console.error('Error updating item completion in Firebase:', error);
        setPendingChanges(prev => [...prev, updatedItem]);
      }
    } else {
      // Add to pending changes for later sync
      setPendingChanges(prev => [...prev, updatedItem]);
    }
  };

  const calculateTotal = () => items
    .filter(item => !item.completed)
    .reduce((sum, item) => sum + item.total, 0);

  // Animation variants
  const listItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (index: number) => ({ 
      opacity: 1, 
      y: 0,
      transition: { 
        delay: index * 0.05,
        type: "spring",
        stiffness: 300,
        damping: 24
      }
    }),
    exit: { 
      opacity: 0, 
      x: -100,
      scale: 0.8,
      transition: { type: "tween", duration: 0.2 }
    },
    completed: { 
      backgroundColor: "#FDF0F4",
      opacity: 1,
      y: 0,
    },
    uncompleted: { 
      backgroundColor: "#FFFFFF",
      opacity: 1,
      y: 0,
    }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { 
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    },
    exit: { 
      opacity: 0, 
      y: 50,
      scale: 0.9,
      transition: { duration: 0.2 }
    }
  };

  const fabVariants = {
    rest: { 
      scale: 1,
      rotate: 0,
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)"
    },
    hover: { 
      scale: 1.1,
      rotate: 45,
      boxShadow: "0px 8px 20px rgba(0, 0, 0, 0.2)",
      transition: { type: "spring", stiffness: 400, damping: 10 }
    },
    tap: { 
      scale: 0.9,
      rotate: 45,
      transition: { type: "spring", stiffness: 400, damping: 17 }
    }
  };

  const headerTotalVariants = {
    update: (value: number) => ({
      scale: [1, 1.2, 1],
      color: ["#111827", "#3B82F6", "#111827"],
      transition: { 
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
        stiffness: 100,
        damping: 10
      }
    })
  };

  const onlineStatusVariants = {
    online: { 
      backgroundColor: "#10B981", 
      scale: [1, 1.5, 1],
      transition: { duration: 0.5 }
    },
    offline: { 
      backgroundColor: "#EF4444",
      scale: [1, 1.5, 1],
      transition: { duration: 0.5 }
    }
  };

  const checkboxVariants = {
    checked: { 
      scale: [1, 1.2, 1],
      backgroundColor: "#3B82F6",
      borderColor: "#3B82F6",
      transition: { duration: 0.3 }
    },
    unchecked: { 
      scale: 1,
      backgroundColor: "#FFFFFF",
      borderColor: "#D1D5DB",
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto px-4 py-6 max-w-3xl">
        <motion.header 
          className="mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <motion.h1 
            className="text-2xl font-bold text-gray-900"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Lista de Compras
          </motion.h1>
          <div className="mt-2 flex justify-between items-center">
            <motion.p 
              className="text-gray-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {items.length} itens na lista
            </motion.p>
            <motion.p 
              className="text-lg font-semibold text-gray-900"
              variants={headerTotalVariants}
              initial="update"
              animate="update"
              key={calculateTotal()} 
              custom={calculateTotal()}
            >
              Total: R$ {calculateTotal().toFixed(2)}
            </motion.p>
          </div>
          <div className="mt-1 flex items-center">
            <motion.div 
              className="w-3 h-3 rounded-full mr-2"
              variants={onlineStatusVariants}
              initial={isOnline ? "online" : "offline"}
              animate={isOnline ? "online" : "offline"}
            ></motion.div>
            <span className="text-sm text-gray-500">{isOnline ? 'Online' : 'Offline'}</span>
            {!isOnline && pendingChanges.length > 0 && (
              <motion.span 
                className="text-sm text-amber-600 ml-2"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ 
                  opacity: 1, 
                  scale: [1, 1.1, 1],
                  transition: { 
                    scale: { repeat: Infinity, repeatType: "reverse", duration: 1.5 }
                  }
                }}
              >
                ({pendingChanges.length} alterações pendentes)
              </motion.span>
            )}
          </div>
        </motion.header>

        <main>
          {/* Lista de Itens */}
          <div className="mb-24">
            <AnimatePresence>
              {items.length > 0 ? (
                <motion.div 
                  className="bg-white rounded-2xl shadow-md overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  key="items-list"
                >
                  <div className="divide-y divide-gray-100">
                      {items.map((item, index) => (
                        isEditingItem === item.id ? (
                          <motion.div 
                            key={`editing-${item.id}`}
                            initial={{ backgroundColor: "#FFFFFF" }}
                            animate={{ backgroundColor: "#EFF6FF" }}
                            transition={{ duration: 0.3 }}
                            className="p-4"
                          >
                            <div className="flex flex-col gap-3">
                              <motion.input
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.3 }}
                                type="text"
                                placeholder="Nome do item"
                                className="w-full p-3 rounded-lg border border-gray-200"
                                value={newItem.name}
                                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                              />
                              
                              <div className="grid grid-cols-2 gap-3">
                                <motion.div 
                                  className="relative"
                                  initial={{ scale: 0.95, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: 0.2, duration: 0.3 }}
                                >
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Quantidade"
                                    className="w-full p-3 rounded-lg border border-gray-200 pr-10"
                                    value={newItem.quantity || ""}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/\D/g, "");
                                      setNewItem({ 
                                        ...newItem, 
                                        quantity: value ? parseInt(value) : 1
                                      });
                                    }}
                                  />
                                  <span className="absolute right-3 top-3 text-gray-400">un</span>
                                </motion.div>
                                
                                <motion.div 
                                  className="relative"
                                  initial={{ scale: 0.95, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ delay: 0.3, duration: 0.3 }}
                                >
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Preço"
                                    className="w-full p-3 rounded-lg border border-gray-200 pr-10"
                                    value={newItem.unitPrice}
                                    onChange={(e) => {
                                      let value = e.target.value
                                        .replace(/[^0-9,]/g, '')
                                        .replace(/(,.*?),/g, '$1');

                                      if (value.startsWith(',')) {
                                        value = '0' + value;
                                      }

                                      setNewItem({ 
                                        ...newItem, 
                                        unitPrice: value
                                      });
                                    }}
                                    onBlur={() => {
                                      const parsedValue = parseCurrency(newItem.unitPrice);
                                      const formattedValue = formatCurrency(parsedValue);

                                      setNewItem(prev => ({
                                        ...prev,
                                        unitPrice: formattedValue
                                      }));
                                    }}
                                  />
                                  <span className="absolute right-3 top-3 text-gray-400">R$</span>
                                </motion.div>
                              </div>
                              
                              <div className="flex gap-2 mt-1">
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => handleUpdateItem(item.id)}
                                  className="flex-1 p-3 bg-blue-500 text-white rounded-lg flex items-center justify-center gap-1"
                                >
                                  <Check size={18} />
                                  <span>Salvar</span>
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => {
                                    setIsEditingItem(null);
                                    setNewItem({ name: '', quantity: 1, unitPrice: '' });
                                  }}
                                  className="p-3 bg-gray-200 text-gray-700 rounded-lg"
                                >
                                  <X size={18} />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            key={item.id}
                            variants={listItemVariants}
                            custom={index}
                            initial="hidden"
                            animate={item.completed ? ["visible", "completed"] : ["visible", "uncompleted"]}
                            exit="exit"
                            layout
                            className="p-4 hover:bg-gray-50"
                            style={{ position: 'relative', zIndex: 1 }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center flex-1">
                                <div className="mr-3">
                                  <label className="inline-flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      className="sr-only"
                                      checked={item.completed}
                                      onChange={() => toggleItemCompletion(item.id)}
                                    />
                                    <motion.div 
                                      variants={checkboxVariants}
                                      initial={item.completed ? "checked" : "unchecked"}
                                      animate={item.completed ? "checked" : "unchecked"}
                                      className="w-6 h-6 rounded-md flex items-center justify-center border-2"
                                    >
                                      {item.completed && (
                                        <motion.div
                                          initial={{ scale: 0, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          exit={{ scale: 0, opacity: 0 }}
                                        >
                                          <Check size={16} className="text-white" />
                                        </motion.div>
                                      )}
                                    </motion.div>
                                  </label>
                                </div>
                                <div className="flex-1">
                                  <motion.h4 
                                    layout
                                    className={`font-medium ${item.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}
                                  >
                                    {item.name}
                                  </motion.h4>
                                  <div className="flex gap-4 mt-1 text-sm text-gray-500">
                                    <span>{item.quantity} un</span>
                                    <span>
                                      {item.unitPrice.toLocaleString('pt-BR', {
                                        style: 'currency',
                                        currency: 'BRL'
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <motion.span 
                                  className="font-medium text-gray-900"
                                  key={item.total}
                                  initial={{ scale: 1 }}
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 0.4 }}
                                >
                                  R$ {item.total.toFixed(2)}
                                </motion.span>
                                <div className="flex space-x-1">
                                  <motion.button
                                    whileHover={{ scale: 1.2, color: "#2563EB" }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      setIsEditingItem(item.id);
                                      setNewItem({
                                        name: item.name,
                                        quantity: item.quantity,
                                        unitPrice: formatCurrency(item.unitPrice)
                                      });
                                    }}
                                    className="p-2 text-blue-500 active:scale-95"
                                  >
                                    <Edit size={18} />
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.2, color: "#DC2626" }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-2 text-red-500 active:scale-95"
                                  >
                                    <Trash2 size={18} />
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  className="bg-white rounded-2xl shadow-md p-8 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  key="empty-list"
                >
                  <motion.div 
                    className="flex flex-col items-center text-gray-400"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                  >
                    <motion.span 
                      className="text-4xl mb-3"
                      animate={{ 
                        rotate: [0, 10, -10, 0],
                        y: [0, -5, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                    >
                      🛒
                    </motion.span>
                    <p className="font-medium">Lista vazia</p>
                    <p className="text-sm mt-1">Adicione itens para começar</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
      
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          variants={fabVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          onClick={() => setIsAddingItem(true)}
          className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center 
                   shadow-lg transition-transform"
        >
          <Plus size={28} className="stroke-2" />
        </motion.button>
      </div>
      
      {/* Add New Item Modal */}
      <AnimatePresence>
        {isAddingItem && (
          <motion.div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div 
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex justify-between items-center mb-4">
                <motion.h2 
                  className="text-xl font-bold text-gray-900"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Adicionar Item
                </motion.h2>
                <motion.button
                  whileHover={{ scale: 1.1, backgroundColor: "#E5E7EB" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsAddingItem(false)}
                  className="p-2 rounded-full bg-gray-100"
                >
                  <X size={20} className="text-gray-600" />
                </motion.button>
              </div>
              
              <div className="space-y-4">
                <motion.input
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  type="text"
                  placeholder="Nome do item"
                  className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 
                       focus:border-transparent placeholder:text-gray-400 text-gray-900"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <motion.div 
                    className="relative"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Quantidade"
                      className="w-full p-4 rounded-xl border border-gray-200 pr-10
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={newItem.quantity || ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setNewItem({ 
                          ...newItem, 
                          quantity: value ? parseInt(value) : 1
                        });
                      }}
                    />
                    <span className="absolute right-4 top-4 text-gray-400">un</span>
                  </motion.div>
                  
                  <motion.div 
                    className="relative"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
<input
  type="text"
  inputMode="decimal"
  placeholder="Preço"
  className="w-full p-3 rounded-lg border border-gray-200 pr-10"
  value={newItem.unitPrice}
  onChange={(e) => {
    let value = e.target.value
      .replace(/[^0-9,]/g, '') // Permite apenas números e vírgulas
      .replace(/(,.*?),/g, '$1'); // Remove múltiplas vírgulas

    // Permite vírgula inicial convertendo para "0,"
    if (value.startsWith(',')) {
      value = '0' + value;
    }

    setNewItem({ 
      ...newItem, 
      unitPrice: value
    });
  }}
  onBlur={() => {
    const parsedValue = parseCurrency(newItem.unitPrice);
    const formattedValue = parsedValue
      .toFixed(2)
      .replace('.', ',');

    setNewItem(prev => ({
      ...prev,
      unitPrice: formattedValue
    }));
  }}
/>
                    <span className="absolute right-4 top-4 text-gray-400">R$</span>
                  </motion.div>
                </div>
                
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.03, backgroundColor: "#2563EB" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddItem}
                  disabled={!newItem.name}
                  className="w-full p-4 bg-blue-500 text-white rounded-xl flex items-center justify-center 
                         gap-2 disabled:opacity-50 transition-transform"
                >
                  <Check size={20} className="stroke-2" />
                  <span className="font-medium">Salvar</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;