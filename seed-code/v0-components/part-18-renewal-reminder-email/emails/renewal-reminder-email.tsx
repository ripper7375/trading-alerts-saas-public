import type React from "react"
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Link,
  Row,
  Column,
} from "@react-email/components"

interface RenewalReminderEmailProps {
  expiryDate?: string
  daysRemaining?: number
  price?: string
  priceInr?: string
  paymentMethod?: string
  userName?: string
}

export default function RenewalReminderEmail({
  expiryDate = "December 5, 2024",
  daysRemaining = 3,
  price = "$29.00",
  priceInr = "₹2,407",
  paymentMethod = "UPI (dLocal)",
  userName = "Valued Customer",
}: RenewalReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header Section */}
          <Section style={headerStyle}>
            <Heading style={logoStyle}>Trading Alerts SaaS</Heading>
          </Section>

          {/* Hero Section */}
          <Section style={heroStyle}>
            <Text style={iconStyle}>⏰</Text>
            <Heading style={headlineStyle}>Your PRO Subscription Expires Soon</Heading>
            <Text style={subheadlineStyle}>Renew now to keep your PRO features</Text>
          </Section>

          {/* Expiry Notice Card */}
          <Section style={expiryNoticeContainerStyle}>
            <Section style={expiryNoticeStyle}>
              <Row>
                <Column>
                  <Text style={noticeTextStyle}>
                    <strong>Expiry Date:</strong> {expiryDate}
                  </Text>
                  <Text style={noticeTextStyle}>
                    <strong>Days Remaining:</strong> {daysRemaining} days
                  </Text>
                </Column>
              </Row>
              <Row style={{ marginTop: "16px" }}>
                <Column align="center">
                  <div style={badgeStyle}>{daysRemaining} Days Left</div>
                </Column>
              </Row>
            </Section>
          </Section>

          {/* Subscription Details Table */}
          <Section style={detailsContainerStyle}>
            <Section style={detailsStyle}>
              <Text style={detailRowStyle}>
                <strong>Current Plan:</strong> PRO Monthly
              </Text>
              <Text style={detailRowStyle}>
                <strong>Price:</strong> {price} ({priceInr} INR)
              </Text>
              <Text style={detailRowStyle}>
                <strong>Payment Method:</strong> {paymentMethod}
              </Text>
              <Text style={detailRowStyle}>
                <strong>Next Renewal:</strong> Manual renewal required
              </Text>
            </Section>
          </Section>

          {/* Features Reminder */}
          <Section style={featuresContainerStyle}>
            <Heading style={featuresHeadingStyle}>What You'll Lose Without PRO:</Heading>
            <Text style={featureItemStyle}>
              <span style={iconRedStyle}>✗</span> Access to 15 symbols (downgrade to 5)
            </Text>
            <Text style={featureItemStyle}>
              <span style={iconRedStyle}>✗</span> Access to 9 timeframes (downgrade to 3)
            </Text>
            <Text style={featureItemStyle}>
              <span style={iconRedStyle}>✗</span> 20 alerts capacity (downgrade to 5)
            </Text>
            <Text style={featureItemStyle}>
              <span style={iconRedStyle}>✗</span> Priority support
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={ctaContainerStyle}>
            <Button style={buttonStyle} href="https://tradingalerts.com/checkout">
              Renew Subscription Now
            </Button>
            <Text style={alternativeTextStyle}>
              <Link href="https://tradingalerts.com/settings/billing" style={alternativeLinkStyle}>
                Or switch to Stripe Auto-Renewal
              </Link>
            </Text>
          </Section>

          <Hr style={hrStyle} />

          {/* Footer Section */}
          <Section style={footerStyle}>
            <Text style={warningStyle}>
              <span style={{ fontSize: "16px", marginRight: "8px" }}>⚠️</span>
              dLocal payments require manual renewal (no auto-billing)
            </Text>

            <Text style={supportTextStyle}>
              <Link href="mailto:support@tradingalerts.com" style={supportLinkStyle}>
                Need help? Contact Support
              </Link>
            </Text>

            <Text style={unsubscribeStyle}>
              <Link href="https://tradingalerts.com/unsubscribe" style={unsubscribeLinkStyle}>
                Unsubscribe from renewal reminders
              </Link>
            </Text>

            <Hr style={footerHrStyle} />

            <Text style={companyStyle}>Trading Alerts SaaS Inc.</Text>
            <Text style={addressStyle}>123 Trading Street, New York, NY 10001</Text>

            {/* Social Media Icons */}
            <Section style={socialContainerStyle}>
              <Row>
                <Column align="center">
                  <Link href="https://twitter.com/tradingalerts" style={socialLinkStyle}>
                    <span style={socialIconStyle}>🐦</span>
                  </Link>
                  <Link href="https://facebook.com/tradingalerts" style={socialLinkStyle}>
                    <span style={socialIconStyle}>📘</span>
                  </Link>
                  <Link href="https://linkedin.com/company/tradingalerts" style={socialLinkStyle}>
                    <span style={socialIconStyle}>💼</span>
                  </Link>
                </Column>
              </Row>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Inline Styles (Email-Safe)
const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: 0,
  padding: "20px 0",
}

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
}

const headerStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #2563eb 0%, #9333ea 100%)",
  padding: "40px 32px",
  textAlign: "center",
}

const logoStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "bold",
  margin: 0,
  lineHeight: "1.2",
}

const heroStyle: React.CSSProperties = {
  padding: "40px 32px",
  textAlign: "center",
}

const iconStyle: React.CSSProperties = {
  fontSize: "48px",
  marginBottom: "16px",
  display: "block",
}

const headlineStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 16px 0",
  lineHeight: "1.2",
}

const subheadlineStyle: React.CSSProperties = {
  fontSize: "20px",
  color: "#4b5563",
  margin: 0,
  lineHeight: "1.5",
}

const expiryNoticeContainerStyle: React.CSSProperties = {
  padding: "0 32px 24px 32px",
}

const expiryNoticeStyle: React.CSSProperties = {
  border: "2px solid #fbbf24",
  backgroundColor: "#fef3c7",
  borderRadius: "8px",
  padding: "24px",
}

const noticeTextStyle: React.CSSProperties = {
  fontSize: "18px",
  color: "#111827",
  margin: "0 0 8px 0",
  lineHeight: "1.5",
}

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#f59e0b",
  color: "#ffffff",
  borderRadius: "9999px",
  padding: "8px 16px",
  fontSize: "18px",
  fontWeight: "bold",
}

const detailsContainerStyle: React.CSSProperties = {
  padding: "0 32px 24px 32px",
}

const detailsStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "24px",
}

const detailRowStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  margin: "0 0 12px 0",
  lineHeight: "1.5",
}

const featuresContainerStyle: React.CSSProperties = {
  padding: "0 32px 24px 32px",
}

const featuresHeadingStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 16px 0",
}

const featureItemStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#374151",
  margin: "0 0 12px 0",
  lineHeight: "1.5",
}

const iconRedStyle: React.CSSProperties = {
  color: "#dc2626",
  marginRight: "8px",
  fontWeight: "bold",
}

const ctaContainerStyle: React.CSSProperties = {
  padding: "0 32px 32px 32px",
  textAlign: "center",
}

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  maxWidth: "400px",
  background: "linear-gradient(135deg, #2563eb 0%, #9333ea 100%)",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "20px",
  padding: "16px 32px",
  borderRadius: "8px",
  textDecoration: "none",
  textAlign: "center",
}

const alternativeTextStyle: React.CSSProperties = {
  marginTop: "16px",
  textAlign: "center",
}

const alternativeLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: "16px",
  textDecoration: "underline",
}

const hrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "0",
}

const footerStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  padding: "32px",
  borderTop: "1px solid #e5e7eb",
  textAlign: "center",
}

const warningStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  margin: "0 0 16px 0",
  lineHeight: "1.5",
}

const supportTextStyle: React.CSSProperties = {
  fontSize: "14px",
  margin: "0 0 16px 0",
}

const supportLinkStyle: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
}

const unsubscribeStyle: React.CSSProperties = {
  fontSize: "12px",
  margin: "0 0 24px 0",
}

const unsubscribeLinkStyle: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
}

const footerHrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "16px 0",
}

const companyStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 4px 0",
}

const addressStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 16px 0",
}

const socialContainerStyle: React.CSSProperties = {
  marginTop: "16px",
}

const socialLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  margin: "0 8px",
}

const socialIconStyle: React.CSSProperties = {
  fontSize: "24px",
  color: "#4b5563",
}
