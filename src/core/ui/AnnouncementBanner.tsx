import { useState, useEffect } from 'react';
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { adminService, AppAnnouncement } from '../../features/admin/AdminService';

const TYPE_META = {
  info:    { icon: Info,          className: 'bg-blue-500/10   border-blue-500/25   text-blue-300'   },
  success: { icon: CheckCircle,   className: 'bg-green-500/10  border-green-500/25  text-green-300'  },
  warning: { icon: AlertTriangle, className: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-300' },
  error:   { icon: AlertCircle,   className: 'bg-red-500/10    border-red-500/25    text-red-300'    },
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<AppAnnouncement>(adminService.getAnnouncement());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return adminService.subscribeAnnouncement(() => {
      const next = adminService.getAnnouncement();
      setAnnouncement(next);
      // Reset dismiss when a new announcement is pushed
      if (next.updatedAt !== announcement.updatedAt) setDismissed(false);
    });
  }, [announcement.updatedAt]);

  const visible = announcement.active && announcement.title && !dismissed;

  const { icon: Icon, className } = TYPE_META[announcement.type] ?? TYPE_META.info;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className={`flex items-start gap-3 mx-4 mt-3 px-4 py-3 rounded-2xl border ${className}`}>
            <Icon size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">{announcement.title}</p>
              {announcement.message && (
                <p className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{announcement.message}</p>
              )}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
