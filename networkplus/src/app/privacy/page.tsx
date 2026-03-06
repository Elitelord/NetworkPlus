import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Privacy Policy | NetworkPlus",
    description: "Privacy Policy for NetworkPlus",
}

export default function PrivacyPolicy() {
    return (
        <div className="container mx-auto max-w-3xl py-12 px-4 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>

            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">1. Introduction</h2>
                    <p>
                        Welcome to NetworkPlus. We respect your privacy and are committed to protecting your personal data.
                        This Privacy Policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">2. The Data We Collect</h2>
                    <p>
                        We may collect, use, store and transfer different kinds of personal data about you, including:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Identity Data:</strong> includes first name, last name, username or similar identifier.</li>
                        <li><strong>Contact Data:</strong> includes email address.</li>
                        <li><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version.</li>
                        <li><strong>Profile Data:</strong> includes your username and password, connections, network graphs, and settings.</li>
                        <li><strong>Integration Data:</strong> data synced from external services (e.g., Google Calendar, Outlook Calendar, LinkedIn) that you authorize.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">3. How We Use Your Data</h2>
                    <p>
                        We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>To register you as a new user.</li>
                        <li>To provide and maintain our service, including visualizing your network.</li>
                        <li>To manage our relationship with you.</li>
                        <li>To improve our website, products/services, marketing or customer relationships.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">4. Google API Services User Data Policy</h2>
                    <p>
                        NetworkPlus's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            Google API Services User Data Policy
                        </a>
                        , including the Limited Use requirements.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">5. Data Security</h2>
                    <p>
                        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">6. Your Legal Rights</h2>
                    <p>
                        Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, or to object to processing.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">7. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy or our privacy practices, please contact us.
                    </p>
                </section>
            </div>
        </div>
    )
}
