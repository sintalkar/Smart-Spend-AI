import { parseSMS, SMSParsedResult } from './smsParser';

interface TestCase {
  sms: string;
  sender: string;
  expected: Partial<SMSParsedResult>;
}

const testCases: TestCase[] = [
  // 1. HDFC Bank
  {
    sms: "Alert: Rs 500.00 debited from A/C **1234 to paytm@hdfcbank on 2026-05-25. RRN: 612345678901. Bal: Rs 15430.00",
    sender: "AD-HDFCBK",
    expected: { amount: 500, type: 'DEBIT', merchant: 'Paytm@hdfcbank', bankName: 'HDFC Bank', balance: 15430, refNo: '612345678901' }
  },
  {
    sms: "Your A/C ending **1234 has been credited with Rs.15000.00 on 25-05-26. Info: SALARY. Avl Bal: Rs.45000.00",
    sender: "BP-HDFCBK",
    expected: { amount: 15000, type: 'CREDIT', merchant: 'Salary', bankName: 'HDFC Bank', balance: 45000 }
  },
  {
    sms: "Spent Rs 2500.00 on HDFC Bank Card ending 5678 at AMAZON INDIA. Bal: Rs. 12000.00",
    sender: "HDFCCRD",
    expected: { amount: 2500, type: 'DEBIT', merchant: 'Amazon India', bankName: 'HDFC Bank Credit Card', balance: 12000 }
  },

  // 2. SBI
  {
    sms: "Your A/C *1234 debited by Rs.120.00 on 25May26 at SWIGGY. Ref No 611223344556. Bal: Rs.540.20",
    sender: "SBI-UPI",
    expected: { amount: 120, type: 'DEBIT', merchant: 'Swiggy', bankName: 'SBI', balance: 540.2, refNo: '611223344556' }
  },
  {
    sms: "Dear Customer, A/C *4567 credited by Rs 2500.00 on 24May26 by UPI:GPay:raj@okaxis. Ref 609988776655.",
    sender: "SBIUPI",
    expected: { amount: 2500, type: 'CREDIT', merchant: 'Upi:gpay:raj@okaxis', bankName: 'SBI', refNo: '609988776655' }
  },
  {
    sms: "Txn in SBI Card ending 9876: Rs.4500.00 spent at FLIPKART. Avl Limit: Rs.40000.00",
    sender: "SBICRD",
    expected: { amount: 4500, type: 'DEBIT', merchant: 'Flipkart', bankName: 'SBI Card', balance: 40000 }
  },

  // 3. ICICI Bank
  {
    sms: "Dear Customer, your ICICI Bank A/C ending 4321 has been debited for INR 1,500.00 at ZOMATO. RRN 601293810293. Bal: INR 12,400.00",
    sender: "VM-ICICIB",
    expected: { amount: 1500, type: 'DEBIT', merchant: 'Zomato', bankName: 'ICICI Bank', balance: 12400, refNo: '601293810293' }
  },
  {
    sms: "Dear Customer, ICICI Bank A/C ending 4321 has been credited with INR 3,500.00 from SHARMA TRADERS. Bal: INR 15,900.00",
    sender: "AD-ICICIB",
    expected: { amount: 3500, type: 'CREDIT', merchant: 'Sharma Traders', bankName: 'ICICI Bank', balance: 15900 }
  },
  {
    sms: "ICICI Bank Credit Card ending 2234 spent INR 800.00 at UBER INDIA. Limit Avail: INR 25,000.00",
    sender: "ICICICRD",
    expected: { amount: 800, type: 'DEBIT', merchant: 'Uber India', bankName: 'ICICI Bank Credit Card', balance: 25000 }
  },

  // 4. Axis Bank
  {
    sms: "Axis Bank A/C ending 7890 debited for Rs 350.00 at STARBUCKS. RRN 611223344556. Avl Bal: Rs 8900.00",
    sender: "AD-AXISBK",
    expected: { amount: 350, type: 'DEBIT', merchant: 'Starbucks', bankName: 'Axis Bank', balance: 8900, refNo: '611223344556' }
  },
  {
    sms: "Your Axis Bank A/C ending 7890 has been credited with Rs.1000.00. RRN 622334455667. Avl Bal: Rs.9900.00",
    sender: "AXISBK",
    expected: { amount: 1000, type: 'CREDIT', merchant: 'Axis Bank', bankName: 'Axis Bank', balance: 9900, refNo: '622334455667' }
  },

  // 5. Kotak Mahindra Bank
  {
    sms: "Your Kotak Bank A/C ending 8821 debited for Rs.420.00 at CHAI POINT. UPI Ref 633445566778. Bal: Rs.4200.00",
    sender: "KOTAKB",
    expected: { amount: 420, type: 'DEBIT', merchant: 'Chai Point', bankName: 'Kotak Mahindra Bank', balance: 4200, refNo: '633445566778' }
  },
  {
    sms: "Rs. 2500.00 credited to Kotak Bank A/C ending 8821 from RAJESH. Bal: Rs. 6700.00",
    sender: "KOTAKC",
    expected: { amount: 2500, type: 'CREDIT', merchant: 'Rajesh', bankName: 'Kotak Mahindra Bank', balance: 6700 }
  },

  // 6. Yes Bank
  {
    sms: "YES BANK A/C ending 0912 debited for Rs.1200.00. Transferred to MAKEMYTRIP. Ref 609876543210. Avl Bal Rs.24300.00",
    sender: "YESBNK",
    expected: { amount: 1200, type: 'DEBIT', merchant: 'Makemytrip', bankName: 'Yes Bank', balance: 24300, refNo: '609876543210' }
  },

  // 7. PhonePe
  {
    sms: "Sent Rs.500 to RAMAN KUMAR. Ref: UPI 612345678901 using PhonePe",
    sender: "PHONEPE",
    expected: { amount: 500, type: 'DEBIT', merchant: 'Raman Kumar', bankName: 'PhonePe', refNo: '612345678901' }
  },

  // 8. Paytm
  {
    sms: "Paid Rs.45.00 to CHAI WALA at Paytm. Txn Ref: 611223344. Bal Rs 150.00",
    sender: "PAYTM",
    expected: { amount: 45, type: 'DEBIT', merchant: 'Chai Wala', bankName: 'Paytm', balance: 150, refNo: '611223344' }
  },

  // 9. Google Pay
  {
    sms: "Paid Rs.350.00 at BIG BAZAAR using Google Pay. Ref: 611223344556",
    sender: "GPAY",
    expected: { amount: 350, type: 'DEBIT', merchant: 'Big Bazaar', bankName: 'Google Pay', refNo: '611223344556' }
  },

  // 10. Amazon Pay
  {
    sms: "Paid Rs.120.00 to BOOKMYSHOW via Amazon Pay. Ref: 622334455",
    sender: "AMZPAY",
    expected: { amount: 120, type: 'DEBIT', merchant: 'Bookmyshow', bankName: 'Amazon Pay', refNo: '622334455' }
  },

  // 11. Generic/Fallback Bank Cases
  {
    sms: "Your A/C has been debited with USD 25.00 for NETFLIX on 25-05-2026. Ref: 611223344",
    sender: "UNKNOWN-BANK",
    expected: { amount: 25, type: 'DEBIT', merchant: 'Netflix', bankName: 'BANK', refNo: '611223344' }
  },
  {
    sms: "Dear Customer, A/C debited Rs. 50.00 at CANTEEN. Bal Rs 120.00",
    sender: "UNIONB",
    expected: { amount: 50, type: 'DEBIT', merchant: 'Canteen', bankName: 'Union Bank', balance: 120 }
  },
  {
    sms: "Your A/C ending 3321 has been credited with Rs.2000.00 from PAYTM. RRN: 611223344556",
    sender: "BARODA",
    expected: { amount: 2000, type: 'CREDIT', merchant: 'Paytm', bankName: 'Bank of Baroda', refNo: '611223344556' }
  },
  {
    sms: "Rs 100.00 spent at OLA CABS on A/C 9912. Bal: Rs.450.00",
    sender: "FEDBNK",
    expected: { amount: 100, type: 'DEBIT', merchant: 'Ola Cabs', bankName: 'Federal Bank', balance: 450 }
  },
  {
    sms: "Debited Rs 25000.00 to HOME LOAN EMI. Ref RRN 633221144.",
    sender: "IDFCFB",
    expected: { amount: 25000, type: 'DEBIT', merchant: 'Home Loan EMI', bankName: 'IDFC First Bank', refNo: '633221144' }
  },
  {
    sms: "RBL Bank A/C ending 1122 credited Rs.8500.00. Info: Int. Credit. Bal Rs 98500.00",
    sender: "RBLBNK",
    expected: { amount: 8500, type: 'CREDIT', merchant: 'Int Credit', bankName: 'RBL Bank', balance: 98500 }
  },
  {
    sms: "INR 180.00 debited from Canara Bank A/C 9012 at MEDPLUS. RRN 611223344.",
    sender: "CANARA",
    expected: { amount: 180, type: 'DEBIT', merchant: 'Medplus', bankName: 'Canara Bank', refNo: '611223344' }
  },
  {
    sms: "Union Bank A/C 4455 debited Rs 320.00 to pay to zomato@unionbank on 25-05-26.",
    sender: "UNIONB",
    expected: { amount: 320, type: 'DEBIT', merchant: 'Zomato@unionbank', bankName: 'Union Bank' }
  },
  {
    sms: "Your A/C credited with Rs 500.00 on 25-05-26. RRN 609128371. Avl Bal Rs 5200.00",
    sender: "PNBSMS",
    expected: { amount: 500, type: 'CREDIT', bankName: 'Punjab National Bank', balance: 5200, refNo: '609128371' }
  },
  {
    sms: "Rs.90.00 spent at TAPRI TEA via BHIM. Ref: 611223344",
    sender: "BHIM",
    expected: { amount: 90, type: 'DEBIT', merchant: 'Tapri Tea', bankName: 'BHIM UPI', refNo: '611223344' }
  },
  {
    sms: "Debited Rs 400.00 for AMAZON SUBSCRIPTION. Ref 6012931238.",
    sender: "AD-BOISMS",
    expected: { amount: 400, type: 'DEBIT', merchant: 'Amazon Subscription', bankName: 'Bank of India', refNo: '6012931238' }
  },
  {
    sms: "Dear Customer, Rs 1500.00 debited for ATM CASH WITHDRAWAL.",
    sender: "UNIONB",
    expected: { amount: 1500, type: 'DEBIT', merchant: 'Atm Cash Withdrawal', bankName: 'Union Bank' }
  }
];

function runTests() {
  console.log("Starting SMS Regex Parser validation checks...");
  let failed = 0;

  testCases.forEach((tc, idx) => {
    const result = parseSMS(tc.sms, tc.sender);
    if (!result) {
      console.error(`❌ Test #${idx + 1} Failed: parseSMS returned null. Message: "${tc.sms}"`);
      failed++;
      return;
    }

    // Verify key fields
    const failures: string[] = [];
    Object.keys(tc.expected).forEach(k => {
      const key = k as keyof SMSParsedResult;
      if (result[key] !== tc.expected[key]) {
        failures.push(`${key}: expected "${tc.expected[key]}", got "${result[key]}"`);
      }
    });

    if (failures.length > 0) {
      console.error(`❌ Test #${idx + 1} Failed on sender "${tc.sender}"`);
      console.error(`   Message: "${tc.sms}"`);
      failures.forEach(f => console.error(`   -> ${f}`));
      failed++;
    } else {
      console.log(`✅ Test #${idx + 1} Passed (Bank: ${result.bankName}, Amt: ₹${result.amount}, Merchant: "${result.merchant}")`);
    }
  });

  if (failed > 0) {
    console.error(`\nTest completed: ${testCases.length - failed}/${testCases.length} passed. (${failed} failed)`);
    process.exit(1);
  } else {
    console.log(`\n🎉 SUCCESS! All ${testCases.length} Indian SMS Regex Parser test cases passed flawlessly! ✅\n`);
  }
}

// If executed directly
runTests();
