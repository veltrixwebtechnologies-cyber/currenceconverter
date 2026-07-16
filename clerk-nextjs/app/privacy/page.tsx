import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | HoverConvert",
  description: "Read the HoverConvert Privacy Policy. Learn how we handle your currency conversion preferences and secure your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-4">
            🛡️ Privacy First
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-100 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm">
            Effective Date: <span className="font-semibold text-zinc-900 dark:text-zinc-100">July 16, 2026</span>
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-1">Local Processing</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Currency detection and conversion runs entirely on your device. We do not inspect your browsing history.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">🚫</div>
            <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-1">No Data Selling</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We never collect, sell, rent, or lease your personal information or web history to anyone.
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-1">Secure APIs</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Exchange rate updates and premium subscription status checks utilize secure, encrypted HTTPS protocols.
            </p>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-md p-6 sm:p-10 space-y-8">
          
          {/* Section 1: Introduction */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">01.</span> Introduction
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Welcome to HoverConvert (hosted at <a href="https://www.currenceconverter.me" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">currenceconverter.me</a>). 
              We are committed to protecting your privacy. This Privacy Policy explain how we collect, protect, store, and use information when you visit our website, register an account, purchase our subscription services, and use our browser extension.
            </p>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              HoverConvert is designed to detect currency values on web pages and convert them locally in your browser. We prioritize your privacy and data security above all else.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 2: Information We Collect */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">02.</span> Information We Collect
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We collect information in the following ways depending on your interaction with our service:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Account Details:</strong> When you register an account, we collect your email address and authentication credentials.
              </li>
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Payment Information:</strong> When upgrading to HoverConvert Pro, payment transactions are processed securely through our payment provider.
              </li>
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Configuration Preferences:</strong> Your currency preferences, custom rates offsets, and tooltip behaviors are stored locally on your device.
              </li>
            </ul>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 3: Authentication & Account Information */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">03.</span> Authentication & Account Information
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              To provide premium capabilities (such as unlimited conversions and custom rates offsets), HoverConvert supports optional user authentication. 
              We utilize <strong className="text-zinc-900 dark:text-zinc-200">Clerk</strong> as our authentication service provider. 
              When you log in, Clerk handles the session token exchange and provides your unique User ID, email, and subscription metadata. 
              This information is used to securely check and verify your active subscription status with our server.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 4: Exchange Rate Services */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">04.</span> Exchange Rate Services
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              To fetch correct and current currency rates, the extension connects to a secure public API (such as ExchangeRate-API) over encrypted HTTPS connections. 
              This request contains only the chosen base currency code in the URL (e.g., <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-xs text-blue-600 dark:text-blue-400">/v6/latest/USD</code>). 
              Our extension <strong className="text-zinc-900 dark:text-zinc-100">does not send</strong> any selected text, conversion calculations, target currency preferences, browsing history, or analytical tracking metrics during exchange rate retrieval.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 5: Website Content Processing */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">05.</span> Website Content Processing
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              HoverConvert detects currency values on web pages and displays conversion tooltips. 
              This scanning, matching, and calculation happens <strong className="text-zinc-900 dark:text-zinc-100">entirely locally</strong> inside your web browser. 
              We <strong className="text-zinc-900 dark:text-zinc-100">never</strong> collect, monitor, or transmit your browsing history, page contents, URLs visited, or selected text. 
              The extension also does not execute any remote JavaScript, ensuring your system remains secure and isolated from third-party scripts.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 6: Local Storage & Preferences */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">06.</span> Local Storage & Preferences
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We store your settings locally on your device (using standard browser local storage API) so you do not have to configure them repeatedly:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>Your Clerk session token (if logged in)</li>
              <li>Your logged-in user email and user ID (if logged in)</li>
              <li>Your active subscription status (Pro verification status)</li>
              <li>Your preferred base currency and target currency</li>
              <li>Manual exchange rate offsets, if entered</li>
              <li>Latest fetched exchange rates and refresh timestamps</li>
              <li>Page tooltip enablement preferences</li>
            </ul>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This data remains strictly on your device and is not synced unless you use a browser-level sync feature (such as Chrome Sync) outside of our extension.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 7: How We Use Information */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">07.</span> How We Use Information
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              The information we process is used exclusively to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>Provide and support the currency conversion features.</li>
              <li>Verify and activate HoverConvert Pro subscriptions.</li>
              <li>Process transactions and issue license keys.</li>
              <li>Maintain your local configurations and display preferences.</li>
              <li>Address support queries and technical emails.</li>
            </ul>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 8: Data Sharing */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">08.</span> Data Sharing
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We <strong className="text-zinc-900 dark:text-zinc-100">do not sell, trade, rent, or share</strong> your personal information or browsing data with third-party advertisers or data brokers.
            </p>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We only share information with trustworthy sub-processors required to deliver core functionality, specifically:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Clerk:</strong> For user sign-in management and secure sessions.
              </li>
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Dodo Payments:</strong> For handling secure payment processing and invoices.
              </li>
            </ul>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 9: Data Security */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">09.</span> Data Security
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We implement strict industry-standard security measures. 
              All communications between the extension, backend APIs, Clerk authentication endpoints, and Dodo Payments checkout portals are encrypted using <strong className="text-zinc-900 dark:text-zinc-100">secure HTTPS (TLS)</strong> protocols. 
              Furthermore, we routinely perform local-token cleanup to ensure outdated session data is systematically discarded from your storage.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 10: Third-Party Services */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">10.</span> Third-Party Services
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Our service integrates with the following third-party platforms which maintain their own privacy policies:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>
                <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Clerk Privacy Policy</a> (User Management)
              </li>
              <li>
                <a href="https://dodopayments.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Dodo Payments Privacy Policy</a> (Billing)
              </li>
              <li>
                <a href="https://www.exchangerate-api.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">ExchangeRate-API Privacy Policy</a> (Currency Sync)
              </li>
            </ul>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 11: Your Rights */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">11.</span> Your Rights
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You retain full control over your preferences and data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed pl-2">
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Preference Control:</strong> You can disable tooltip detections or adjust currency pairings at any time in the extension popup menu.
              </li>
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Local Storage Deletion:</strong> You can wipe all extension configurations by clearing your browser cache or uninstalling the extension.
              </li>
              <li>
                <strong className="text-zinc-900 dark:text-zinc-200">Account Erasure:</strong> You can request full account deletion via your profile management dashboard or by emailing our support desk.
              </li>
            </ul>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 12: Changes to this Privacy Policy */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">12.</span> Changes to this Privacy Policy
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We may update our Privacy Policy periodically. 
              Any revisions will be published directly on this page with an updated "Effective Date" at the top. 
              We encourage you to review this policy occasionally to stay informed about how we safeguard your information.
            </p>
          </section>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Section 13: Contact Information */}
          <section className="space-y-3">
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white flex items-center gap-2">
              <span className="text-blue-500 font-mono text-base">13.</span> Contact Information
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              If you have any questions, suggestions, or concerns regarding this Privacy Policy or our security practices, please contact us:
            </p>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 inline-block space-y-1.5 text-sm">
              <div>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400">Website:</span>{" "}
                <a href="https://www.currenceconverter.me" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  https://www.currenceconverter.me
                </a>
              </div>
              <div>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400">Support Email:</span>{" "}
                <a href="mailto:support@currenceconverter.me" className="text-blue-600 dark:text-blue-400 hover:underline">
                  support@currenceconverter.me
                </a>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
