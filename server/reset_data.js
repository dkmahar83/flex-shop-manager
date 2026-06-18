// reset_data.js — Run from server/ folder: node reset_data.js
const db = require('./db/database');

setTimeout(() => {
  db.serialize(() => {
    // Clear all financial transactions
    db.run(`DELETE FROM payments`,              () => console.log('✅ payments cleared'));
    db.run(`DELETE FROM cash_income`,           () => console.log('✅ cash_income cleared'));
    db.run(`DELETE FROM upi_transactions`,      () => console.log('✅ upi_transactions cleared'));
    db.run(`DELETE FROM cheques`,               () => console.log('✅ cheques cleared'));
    db.run(`DELETE FROM expenses`,              () => console.log('✅ expenses cleared'));
    db.run(`DELETE FROM daily_records`,         () => console.log('✅ daily_records cleared'));
    db.run(`DELETE FROM vendor_transactions`,   () => console.log('✅ vendor_transactions cleared'));
    db.run(`DELETE FROM employee_salary_credits`, () => console.log('✅ salary_credits cleared'));

    // Reset order balances
    db.run(`UPDATE orders SET advance_paid = 0, balance_due = total_amount`,
      () => console.log('✅ orders reset (balance_due = total_amount)'));

    // Reset vendor balances
    db.run(`UPDATE vendors SET total_paid = 0, balance_due = 0, total_purchased = 0`,
      () => console.log('✅ vendor balances reset'));

    setTimeout(() => {
      console.log('\n🎉 All financial data cleared successfully!');
      process.exit(0);
    }, 1000);
  });
}, 1500);