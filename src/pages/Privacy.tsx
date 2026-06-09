import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background p-6">
      <Helmet>
        <title>Privacy Policy — Junkyard Surf Club</title>
        <meta name="description" content="How Junkyard Surf Club collects, uses and protects member personal information including name, email, mobile and state." />
        <link rel="canonical" href="/privacy" />
        <meta property="og:title" content="Privacy Policy — Junkyard Surf Club" />
        <meta property="og:description" content="How Junkyard Surf Club handles your personal information." />
        <meta property="og:url" content="/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-display tracking-tight text-foreground">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: May 2026</p>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect your name, email, mobile number and state to manage your membership and contact you regarding giveaways and partner offers.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Data</h2>
          <p className="text-muted-foreground">
            Your information is used to provide membership services, process payments, run giveaways and send you updates you have opted in to receive.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">3. Sharing</h2>
          <p className="text-muted-foreground">
            We do not sell your personal data. We only share information with trusted service providers necessary to operate the club (e.g. payment processing).
          </p>
        </section>
      </div>
    </div>
  );
}
