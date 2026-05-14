import { Redirect } from "expo-router";

import { getLaunchRoute } from "@/data/appLaunchService";

export default function Index() {
  return <Redirect href={getLaunchRoute()} />;
}
