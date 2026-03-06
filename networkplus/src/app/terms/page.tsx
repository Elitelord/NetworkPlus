import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Terms of Service | NetworkPlus",
    description: "Terms of Service for NetworkPlus",
}

export default function TermsOfService() {
    return (
        <div className="container mx-auto max-w-3xl py-12 px-4 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>

            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using NetworkPlus ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">2. Description of Service</h2>
                    <p>
                        NetworkPlus is a personal network management and visualization tool. The Service allows you to import, sync, and visualize your connections from various platforms. We reserve the right to modify or discontinue, temporarily or permanently, the Service with or without notice.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">3. User Accounts</h2>
                    <p>
                        When you create an account with us, you must provide accurate, complete, and current information at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
                    </p>
                    <p>
                        You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">4. User Content and Integrations</h2>
                    <p>
                        Our Service allows you to sync data from third-party services like Google and Outlook. You retain all rights to your data. By linking these services, you grant us permission to access and process this data solely for the purpose of providing the Service to you.
                    </p>
                    <p>
                        We do not share your synced data with any third parties except as necessary to provide the Service or as required by law.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">5. Acceptable Use</h2>
                    <p>
                        You agree not to use the Service to:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Violate any local, state, national, or international law.</li>
                        <li>Infringe upon the rights of others.</li>
                        <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
                        <li>Attempt to gain unauthorized access to any portion of the Service.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">6. Limitation of Liability</h2>
                    <p>
                        In no event shall NetworkPlus, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">7. Changes to Terms</h2>
                    <p>
                        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any significant changes.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">8. Contact Us</h2>
                    <p>
                        If you have any questions about these Terms, please contact us.
                    </p>
                </section>
            </div>
        </div>
    )
}
