import { Scheduler } from "@/components/Scheduler";
import { authConfig } from "@/lib/auth";

export default function Home() {
  // Only show the Sign out control when the login gate is actually configured.
  return <Scheduler authEnabled={authConfig().enabled} />;
}
