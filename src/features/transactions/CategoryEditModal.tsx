import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Paintbrush, Smile } from 'lucide-react';
import { CategoryEntity } from '../../db/models';
import { categoryRepo } from '../../db/repositories/CategoryRepository';
import { hapticFeedback } from '../../core/utils/haptics';

interface Props {
  category: CategoryEntity;
  onClose: () => void;
}

export function CategoryEditModal({ category, onClose }: Props) {
  const [formData, setFormData] = useState({
    name: category.name,
    icon: category.icon,
    color: category.color
  });

  const handleSave = async () => {
    try {
      await categoryRepo.update(category.id, formData);
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
            <h2 className="text-xl font-bold text-white">Edit Category: {category.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Name"
            />
            <input
              type="text"
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Icon (e.g. Coffee)"
            />
            <input
              type="text"
              value={formData.color}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
              className="w-full bg-background border border-white/10 rounded-xl p-3 text-white"
              placeholder="Color (hex)"
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
