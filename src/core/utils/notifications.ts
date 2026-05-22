
export const NOTIFICATION_MESSAGES = [
  "Track your cash, keep it from a crash!",
  "Save a bit more, stay away from poverty's door.",
  "Check your spend, make your budget your best friend.",
  "Little savings grow tall, so don't let your balance fall.",
  "Managing expense is true sense, savings brings you defense."
];

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function showNotification(message: string) {
  if (Notification.permission === "granted") {
    new Notification("Smart Spend", {
      body: message,
      icon: "/favicon.ico"
    });
  }
}

export async function checkAndNotifyHighSpending(categoryId: string) {
  if (categoryId !== 'food_dining' && categoryId !== 'transportation') return;
  
  try {
    const { db } = await import('../../db');
    const transactions = await db.transactions
      .where('isDeleted').equals(0)
      .toArray();
      
    // Filter for current month and matching category/debit type
    const now = new Date();
    const currentMonthTx = transactions.filter(t => {
      try {
        const dt = new Date(t.dateTime);
        return t.type === 'DEBIT' && 
          t.categoryId === categoryId &&
          dt.getFullYear() === now.getFullYear() && 
          dt.getMonth() === now.getMonth();
      } catch (e) {
        return false;
      }
    });
    
    const totalSpent = currentMonthTx.reduce((acc, t) => acc + t.amount, 0);
    
    // Check if there is a budget set for this category
    const budgets = await db.budgets.toArray();
    const catBudget = budgets.find(b => b.categoryId === categoryId);
    
    let threshold = 5000; // default absolute threshold of ₹5000
    let isHigh = false;
    let message = '';
    
    if (catBudget && catBudget.amount > 0) {
      threshold = catBudget.amount * 0.8; // 80% of budget
      if (totalSpent >= threshold) {
        isHigh = true;
        const percentage = ((totalSpent / catBudget.amount) * 100).toFixed(0);
        const name = categoryId === 'food_dining' ? 'Dining' : 'Transport';
        message = `High spend alert! You have reached ${percentage}% of your ${name} budget (₹${totalSpent} spent of ₹${catBudget.amount}).`;
      }
    } else {
      if (totalSpent >= threshold) {
        isHigh = true;
        const name = categoryId === 'food_dining' ? 'Dining' : 'Transport';
        message = `High spending alert! You've spent ₹${totalSpent} on ${name} this month. Consider tracking this closely!`;
      }
    }
    
    if (isHigh && message) {
      // First ensure permission is requested
      const granted = await requestNotificationPermission();
      if (granted) {
        showNotification(message);
      }
    }
  } catch (error) {
    console.error("Failed to check high spending notification:", error);
  }
}
