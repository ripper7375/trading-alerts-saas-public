import RenewalReminderEmail from "@/emails/renewal-reminder-email"

export default function PreviewRenewalEmail() {
  return (
    <div style={{ padding: "40px", backgroundColor: "#f3f4f6" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ textAlign: "center", marginBottom: "32px", fontSize: "32px", fontWeight: "bold" }}>
          Renewal Reminder Email Preview
        </h1>
        <RenewalReminderEmail
          expiryDate="December 5, 2024"
          daysRemaining={3}
          price="$29.00"
          priceInr="₹2,407"
          paymentMethod="UPI (dLocal)"
          userName="Valued Customer"
        />
      </div>
    </div>
  )
}
