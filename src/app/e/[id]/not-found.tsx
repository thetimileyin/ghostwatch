import Link from "next/link";

export default function EventNotFound() {
  return (
    <main id="main" className="wrap ev">
      <div className="idx">[ 404 ]</div>
      <h1>No ghost here.</h1>
      <p className="sub">
        We don&apos;t have an event with this ID. Event links look like <code className="mono">/e/9d5d67169a372227</code>.
      </p>
      <p className="mt-6">
        <Link className="btn" href="/feed">Back to the ghost feed</Link>
      </p>
    </main>
  );
}
