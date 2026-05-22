import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { TransactionEntity } from '../../db/models';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { hapticFeedback } from '../../core/utils/haptics';

interface Props {
  transaction: TransactionEntity;
  onClose: () => void;
}

export function TransactionEditModal({ transaction, onClose }: Props) {
  const [formData, setFormData] = useState({
    amount: transaction.amount,
    note: transaction.note || '',
    merchantName: transaction.merchantName || '',
    categoryId: transaction.categoryId
  });

  const handleSave = async () => {
    try {
      await transactionRepo.update(transaction.id, formData);
      hapticFeedback.success();
      onClose();
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="bg-surface border border-white/10 p-6 rounded-3xl w-full max-w-sm"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Edit Transaction</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <input
              type="number"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Amount"
            />
            <input
              type="text"
              value={formData.merchantName}
              onChange={e => setFormData({ ...formData, merchantName: e.target.value })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Merchant"
            />
            <input
              type="text"
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Note"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full mt-6 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Check size={20} />
            Save Changes
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
