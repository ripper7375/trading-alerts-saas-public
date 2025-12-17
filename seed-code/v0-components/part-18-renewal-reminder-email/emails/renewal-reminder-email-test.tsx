import RenewalReminderEmail from "./renewal-reminder-email"

// Test with different scenarios
export function RenewalReminderEmail7Days() {
  return (
    <RenewalReminderEmail
      expiryDate="December 10, 2024"
      daysRemaining={7}
      price="$29.00"
      priceInr="₹2,407"
      paymentMethod="UPI (dLocal)"
    />
  )
}

export function RenewalReminderEmail1Day() {
  return (
    <RenewalReminderEmail
      expiryDate="December 2, 2024"
      daysRemaining={1}
      price="$29.00"
      priceInr="₹2,407"
      paymentMethod="UPI (dLocal)"
    />
  )
}

export function RenewalReminderEmailAnnual() {
  return (
    <RenewalReminderEmail
      expiryDate="January 15, 2025"
      daysRemaining={14}
      price="$290.00"
      priceInr="₹24,070"
      paymentMethod="Bank Transfer (dLocal)"
    />
  )
}

export default RenewalReminderEmail
