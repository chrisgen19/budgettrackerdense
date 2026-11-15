import { redirect } from "next/navigation";

/** The app has no landing page: signed in goes to Overview, otherwise the proxy sends you to `/login`. */
export default function Home() {
  redirect("/overview");
}
