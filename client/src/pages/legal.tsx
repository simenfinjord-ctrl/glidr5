export default function Legal() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold mb-6" data-testid="heading-legal">Terms of Service & Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">1. Data Ownership</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          All data entered into Glidr — including but not limited to test results, product information, weather logs, athlete profiles, race ski records, grinding data, and any other content — is and remains the exclusive property of the team (organization) that entered it.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          Glidr does not claim any ownership, license, or usage rights over your data. Your data will never be sold, shared with third parties, or used for purposes other than providing the Glidr service to your team.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Upon termination of your account, you may request a full export of all your data. We will retain your data for 30 days after termination to allow for export, after which it will be permanently deleted.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">2. Data Isolation & Multi-Tenancy</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          Glidr operates as a multi-tenant platform. Each team's data is logically isolated and cannot be accessed by other teams. Team Admins can only view and manage data within their own team. Super Admins have cross-team access only when explicitly granted.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Users belong to specific teams and groups. Access to data is controlled through a granular permission system that restricts visibility and editing rights per functional area.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">3. User Accounts & Access</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          Team Admins are responsible for managing user accounts within their team, including creating users, assigning permissions, and deactivating accounts. Admins should ensure that users only have access to the data and features necessary for their role.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Users are responsible for keeping their login credentials secure. Shared accounts are discouraged. Activity logging tracks user actions for accountability and audit purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">4. Confidentiality & Trade Secrets</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          We recognize that ski testing data, product formulations, grinding parameters, and performance results may constitute trade secrets and proprietary competitive information. We commit to treating all such data with the highest level of confidentiality.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          The "Blind Tester" feature allows teams to restrict testers from seeing product names and methodologies, ensuring unbiased testing while protecting proprietary information even from internal users.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">5. Data Security</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          All data is transmitted over encrypted connections (HTTPS/TLS). Passwords are stored securely. Session management uses server-side sessions with configurable expiry.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          While we implement industry-standard security measures, no system is completely immune to risks. We recommend that teams regularly export backups of their critical data using the built-in PDF, Excel, or Google Sheets backup features.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">6. Service Availability</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          We strive to maintain high availability but do not guarantee uninterrupted service. Glidr includes offline capabilities that allow data entry to continue without an internet connection, with automatic synchronization when connectivity is restored.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Scheduled maintenance will be communicated in advance when possible. We are not liable for data loss resulting from service interruptions beyond our reasonable control.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">7. Acceptable Use</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          Glidr is designed for ski testing, product development, and performance documentation. Users agree not to use the platform for any unlawful purpose, to attempt to gain unauthorized access to other teams' data, or to interfere with the proper functioning of the service.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">8. Limitation of Liability</h2>
        <p className="text-sm text-foreground/80 leading-relaxed mb-2">
          Glidr is provided "as is" without warranties of any kind, express or implied. To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or competitive advantage, arising from your use of the service.
        </p>
        <p className="text-sm text-foreground/80 leading-relaxed">
          Our total liability for any claim arising from the service shall not exceed the amount paid by your team for the service during the 12 months preceding the claim.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">9. Changes to Terms</h2>
        <p className="text-sm text-foreground/80 leading-relaxed">
          We reserve the right to update these terms at any time. Material changes will be communicated to team administrators via email or in-app notification. Continued use of Glidr after changes constitutes acceptance of the updated terms.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">10. Governing Law</h2>
        <p className="text-sm text-foreground/80 leading-relaxed">
          These terms shall be governed by and construed in accordance with applicable law. Any disputes shall be resolved through good-faith negotiation before pursuing formal legal proceedings.
        </p>
      </section>

      <div className="mt-10 pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground">
          For questions about these terms or your data, contact your Glidr account administrator.
        </p>
      </div>
    </div>
  );
}
